package routes

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strconv"
	"strings"
	"textly/queries"
	"textly/routes/middleware"
	"textly/services"
	"time"

	"github.com/openai/openai-go"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/router"
)

type StartConversationRequest struct {
	Message      string `json:"message"`
	Title        string `json:"title,omitempty"`
	Model        string `json:"model,omitempty"`
	UseReasoning bool   `json:"use_reasoning,omitempty"`
}

type ContinueConversationRequest struct {
	ConversationId string `json:"conversation_id"`
	Message        string `json:"message"`
	Model          string `json:"model,omitempty"`
	UseReasoning   bool   `json:"use_reasoning,omitempty"`
}

type EditConversationRequest struct {
	ConversationId string `json:"conversation_id"`
	MessageId      string `json:"message_id"`
	NewMessage     string `json:"new_message"`
	Model          string `json:"model,omitempty"`
	UseReasoning   bool   `json:"use_reasoning,omitempty"`
}

type DeactivateConversationRequest struct {
	ConversationId string `json:"conversation_id"`
}

type ConversationResponse struct {
	Id              string                        `json:"id"`
	Title           string                        `json:"title"`
	Type            string                        `json:"type"`
	TotalRequests   int                           `json:"total_requests"`
	InputTokens     int64                         `json:"input_tokens"`
	OutputTokens    int64                         `json:"output_tokens"`
	ReasoningTokens int64                         `json:"reasoning_tokens"`
	Cost            float64                       `json:"cost"`
	Messages        []ConversationMessageResponse `json:"messages"`
	Created         string                        `json:"created"`
	Updated         string                        `json:"updated"`
}

type ConversationMessageResponse struct {
	Id              string  `json:"id"`
	UserMessage     string  `json:"user_message"`
	ResponseMessage string  `json:"response_message"`
	ThinkingContent string  `json:"thinking_content"`
	Model           string  `json:"model"`
	InputTokens     int64   `json:"input_tokens"`
	OutputTokens    int64   `json:"output_tokens"`
	ReasoningTokens int64   `json:"reasoning_tokens"`
	Cost            float64 `json:"cost"`
	Active          bool    `json:"active"`
	Created         string  `json:"created"`
}

func RegisterConversationRoutes(s *core.ServeEvent) *router.RouterGroup[*core.RequestEvent] {
	conversationGroup := s.Router.Group("/conversations")

	// Add OPTIONS handlers for CORS preflight (without auth middleware)
	conversationGroup.OPTIONS("/start", conversationOptionsHandler)
	conversationGroup.OPTIONS("/continue", conversationOptionsHandler)
	conversationGroup.OPTIONS("/edit", conversationOptionsHandler)
	conversationGroup.OPTIONS("/deactivate", conversationOptionsHandler)
	conversationGroup.OPTIONS("/{id}", conversationOptionsHandler)
	conversationGroup.OPTIONS("/", conversationOptionsHandler)

	// Add auth middleware for actual endpoints
	conversationGroup.Bind(middleware.AuthMiddleware())
	conversationGroup.POST("/start", StartConversationHandler)
	conversationGroup.POST("/continue", ContinueConversationHandler)
	conversationGroup.POST("/edit", EditConversationHandler)
	conversationGroup.POST("/deactivate", DeactivateConversationHandler)
	conversationGroup.GET("/{id}", GetConversationHandler)
	conversationGroup.GET("/", GetConversationsHandler)

	return conversationGroup
}

// StartConversationHandler creates a new conversation and streams the response
func StartConversationHandler(e *core.RequestEvent) error {
	setConversationStreamHeaders(e)

	var req StartConversationRequest
	bodyBytes, err := io.ReadAll(e.Request.Body)
	if err != nil {
		return e.Error(http.StatusBadRequest, "Failed to read request body", err)
	}

	if err := json.Unmarshal(bodyBytes, &req); err != nil {
		return e.Error(http.StatusBadRequest, "Invalid request body", err)
	}

	userId := e.Auth.Id
	now := time.Now().Format(time.RFC3339)

	// Generate title if not provided
	title := req.Title
	if title == "" {
		title = req.Message
		if len(title) > 50 {
			title = title[:47] + "..."
		}
	}

	// Create conversation
	conversation := &queries.Conversation{
		UserId:          userId,
		Title:           title,
		Type:            "chat",
		TotalRequests:   "0",
		InputTokens:     "0",
		OutputTokens:    "0",
		ReasoningTokens: "0",
		Cost:            "0.000000",
		Active:          true,
		Created:         now,
		Updated:         now,
	}

	createdConversation, err := queries.CreateConversation(e, conversation)
	if err != nil {
		return e.Error(http.StatusInternalServerError, "Failed to create conversation", err)
	}

	// Send conversation ID as first event
	conversationIdData := "data: {\"conversation_id\":\"" + createdConversation.Id + "\"}\n\n"
	e.Response.Write([]byte(conversationIdData))
	if flusher, ok := e.Response.(http.Flusher); ok {
		flusher.Flush()
	}

	// Generate AI response with streaming
	messages := []services.Message{
		{Role: services.MessageRoleUser, Content: req.Message},
	}

	return streamAndSaveConversation(e, createdConversation.Id, req.Message, messages, userId, now, req.Model, req.UseReasoning)
}

// ContinueConversationHandler adds a message to existing conversation and streams the response
func ContinueConversationHandler(e *core.RequestEvent) error {
	setConversationStreamHeaders(e)

	var req ContinueConversationRequest
	bodyBytes, err := io.ReadAll(e.Request.Body)
	if err != nil {
		return e.Error(http.StatusBadRequest, "Failed to read request body", err)
	}

	if err := json.Unmarshal(bodyBytes, &req); err != nil {
		return e.Error(http.StatusBadRequest, "Invalid request body", err)
	}

	userId := e.Auth.Id
	now := time.Now().Format(time.RFC3339)

	// Verify conversation exists and belongs to user
	conversation, err := queries.GetConversationById(e, req.ConversationId)
	if err != nil {
		return e.Error(http.StatusNotFound, "Conversation not found", err)
	}

	if conversation.UserId != userId {
		return e.Error(http.StatusForbidden, "Access denied", nil)
	}

	// Get conversation history
	messages, err := queries.GetActiveMessagesByConversationIdOrdered(e, req.ConversationId)
	if err != nil {
		return e.Error(http.StatusInternalServerError, "Failed to get conversation history", err)
	}

	// Build message history for AI
	var aiMessages []services.Message
	for _, msg := range messages {
		aiMessages = append(aiMessages, services.Message{Role: services.MessageRoleUser, Content: msg.UserMessage})
		aiMessages = append(aiMessages, services.Message{Role: services.MessageRoleAssistant, Content: msg.ResponseMessage})
	}
	// Add the new user message
	aiMessages = append(aiMessages, services.Message{Role: services.MessageRoleUser, Content: req.Message})

	return streamAndSaveConversation(e, req.ConversationId, req.Message, aiMessages, userId, now, req.Model, req.UseReasoning)
}

// EditConversationHandler edits a message and streams the new response
func EditConversationHandler(e *core.RequestEvent) error {
	setConversationStreamHeaders(e)

	var req EditConversationRequest
	bodyBytes, err := io.ReadAll(e.Request.Body)
	if err != nil {
		return e.Error(http.StatusBadRequest, "Failed to read request body", err)
	}

	if err := json.Unmarshal(bodyBytes, &req); err != nil {
		return e.Error(http.StatusBadRequest, "Invalid request body", err)
	}

	userId := e.Auth.Id
	now := time.Now().Format(time.RFC3339)

	// Verify conversation exists and belongs to user
	conversation, err := queries.GetConversationById(e, req.ConversationId)
	if err != nil {
		return e.Error(http.StatusNotFound, "Conversation not found", err)
	}

	if conversation.UserId != userId {
		return e.Error(http.StatusForbidden, "Access denied", nil)
	}

	// Get the message to edit
	log.Println("Getting message to edit: ", req.MessageId)
	messageToEdit, err := queries.GetConversationMessageById(e, req.MessageId)
	if err != nil {
		return e.Error(http.StatusNotFound, "Message not found", err)
	}

	if messageToEdit.ConversationId != req.ConversationId {
		return e.Error(http.StatusBadRequest, "Message does not belong to conversation", nil)
	}

	// Deactivate the edited message and all messages after it
	_, err = queries.DeactivateMessagesFromTimestamp(e, req.ConversationId, messageToEdit.Created)
	if err != nil {
		return e.Error(http.StatusInternalServerError, "Failed to deactivate messages", err)
	}

	// Get conversation history up to the edited message
	messages, err := queries.GetActiveMessagesByConversationIdOrdered(e, req.ConversationId)
	if err != nil {
		return e.Error(http.StatusInternalServerError, "Failed to get conversation history", err)
	}

	// Build message history for AI (edited message and subsequent messages are already deactivated)
	var aiMessages []services.Message
	for _, msg := range messages {
		aiMessages = append(aiMessages, services.Message{Role: services.MessageRoleUser, Content: msg.UserMessage})
		aiMessages = append(aiMessages, services.Message{Role: services.MessageRoleAssistant, Content: msg.ResponseMessage})
	}
	// Add the edited message
	aiMessages = append(aiMessages, services.Message{Role: services.MessageRoleUser, Content: req.NewMessage})

	return streamAndSaveConversation(e, req.ConversationId, req.NewMessage, aiMessages, userId, now, req.Model, req.UseReasoning)
}

// streamAndSaveConversation handles the streaming and saving logic
func streamAndSaveConversation(e *core.RequestEvent, conversationId, userMessage string, messages []services.Message, userId, timestamp, model string, useReasoning bool) error {
	// Send thinking state only when reasoning is explicitly enabled
	if useReasoning {
		thinkingData := "data: {\"thinking\": true}\n\n"
		e.Response.Write([]byte(thinkingData))
		if flusher, ok := e.Response.(http.Flusher); ok {
			flusher.Flush()
		}
	}

	// Start streaming
	stream := services.Chat(messages, model, useReasoning)

	var responseBuilder strings.Builder
	var thinkingBuilder strings.Builder
	var usage *openai.CompletionUsage
	var hasStartedContent bool

	if stream.Err() != nil {
		return e.Error(http.StatusInternalServerError, "Failed to stream response", stream.Err())
	}

	// Stream the response
	for stream.Next() {
		if stream.Err() != nil {
			return e.Error(http.StatusInternalServerError, "Failed to stream response", stream.Err())
		}

		chunk := stream.Current()

		// Check for reasoning content first (for models that support it)
		if len(chunk.Choices) > 0 {
			// Try to extract reasoning if available and reasoning is enabled
			if useReasoning {
				if chunkJSON := chunk.Choices[0].Delta.JSON.ExtraFields; chunkJSON != nil {
					if reasoningField, exists := chunkJSON["reasoning"]; exists {
						reasoningContent := reasoningField.Raw()
						if reasoningContent != "" && reasoningContent != "null" {
							// Remove quotes if present
							if strings.HasPrefix(reasoningContent, "\"") && strings.HasSuffix(reasoningContent, "\"") {
								reasoningContent = reasoningContent[1 : len(reasoningContent)-1]
							}
							thinkingBuilder.WriteString(reasoningContent)

							// Send thinking content to client
							escapedThinking := strings.ReplaceAll(reasoningContent, "\n", "\\n")
							escapedThinking = strings.ReplaceAll(escapedThinking, "\"", "\\\"")
							thinkingData := fmt.Sprintf("data: {\"thinking_content\": \"%s\"}\n\n", escapedThinking)
							e.Response.Write([]byte(thinkingData))
							if flusher, ok := e.Response.(http.Flusher); ok {
								flusher.Flush()
							}
						}
					}
				}
			}

			// Handle regular content
			if chunk.Choices[0].Delta.Content != "" {
				content := chunk.Choices[0].Delta.Content

				// If this is the first content and reasoning was enabled, send thinking end signal
				if !hasStartedContent && useReasoning {
					hasStartedContent = true
					thinkingEndData := "data: {\"thinking\": false}\n\n"
					e.Response.Write([]byte(thinkingEndData))
					if flusher, ok := e.Response.(http.Flusher); ok {
						flusher.Flush()
					}
				}

				// Accumulate response content
				responseBuilder.WriteString(content)

				// Send to client
				escapedContent := strings.ReplaceAll(content, "\n", "\\n")
				sseData := "data: " + escapedContent + "\n\n"
				e.Response.Write([]byte(sseData))

				if flusher, ok := e.Response.(http.Flusher); ok {
					flusher.Flush()
				}
			}
		}

		// Capture usage data when available
		if chunk.Usage.PromptTokens > 0 || chunk.Usage.CompletionTokens > 0 || chunk.Usage.CompletionTokensDetails.ReasoningTokens > 0 {
			usage = &chunk.Usage
		}
	}

	// Send completion event
	e.Response.Write([]byte("data: [DONE]\n\n"))

	// Save the conversation message to database
	response := responseBuilder.String()
	thinkingContent := thinkingBuilder.String()

	reasoningTokens := int64(0)
	inputTokens := int64(0)
	outputTokens := int64(0)
	totalCost := float64(0)

	if usage != nil {
		reasoningTokens = usage.CompletionTokensDetails.ReasoningTokens
		inputTokens = usage.PromptTokens
		outputTokens = usage.CompletionTokens

		if costField, exists := usage.JSON.ExtraFields["cost"]; exists {
			costStr := costField.Raw()
			if cost, err := strconv.ParseFloat(costStr, 64); err == nil {
				totalCost = cost
			}
		}
	}

	// Create conversation message
	message := &queries.ConversationMessage{
		UserId:          userId,
		ConversationId:  conversationId,
		UserMessage:     userMessage,
		ResponseMessage: response,
		ThinkingContent: thinkingContent,
		Model:           model,
		InputTokens:     strconv.FormatInt(inputTokens, 10),
		OutputTokens:    strconv.FormatInt(outputTokens, 10),
		ReasoningTokens: strconv.FormatInt(reasoningTokens, 10),
		Cost:            strconv.FormatFloat(totalCost, 'f', 6, 64),
		Active:          true,
		Created:         timestamp,
	}

	createdMessage, err := queries.CreateConversationMessage(e, message)
	if err != nil {
		log.Printf("Failed to save conversation message: %v", err)
		// Don't return error as the response was already streamed
	} else {
		// Send the message ID to the client
		messageIdData := fmt.Sprintf(`{"message_id": "%s"}`, createdMessage.Id)
		sseData := "data: " + messageIdData + "\n\n"
		e.Response.Write([]byte(sseData))

		if flusher, ok := e.Response.(http.Flusher); ok {
			flusher.Flush()
		}
	}

	// Update conversation totals
	err = queries.UpdateConversationTotals(e, conversationId, inputTokens, outputTokens, reasoningTokens, totalCost)
	if err != nil {
		log.Printf("Failed to update conversation totals: %v", err)
	}

	return nil
}

func DeactivateConversationHandler(e *core.RequestEvent) error {
	setConversationCORSHeaders(e)

	var req DeactivateConversationRequest
	bodyBytes, err := io.ReadAll(e.Request.Body)
	if err != nil {
		return e.Error(http.StatusBadRequest, "Failed to read request body", err)
	}

	if err := json.Unmarshal(bodyBytes, &req); err != nil {
		return e.Error(http.StatusBadRequest, "Invalid request body", err)
	}

	userId := e.Auth.Id

	// Verify conversation exists and belongs to user
	conversation, err := queries.GetConversationById(e, req.ConversationId)
	if err != nil {
		return e.Error(http.StatusNotFound, "Conversation not found", err)
	}

	if conversation.UserId != userId {
		return e.Error(http.StatusForbidden, "Access denied", nil)
	}

	// Deactivate the conversation
	err = queries.DeactivateConversation(e, req.ConversationId)
	if err != nil {
		return e.Error(http.StatusInternalServerError, "Failed to deactivate conversation", err)
	}

	return e.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Conversation deactivated successfully",
	})
}

func GetConversationHandler(e *core.RequestEvent) error {
	setConversationCORSHeaders(e)

	conversationId := e.Request.PathValue("id")
	userId := e.Auth.Id

	// Get conversation
	conversation, err := queries.GetConversationById(e, conversationId)
	if err != nil {
		return e.Error(http.StatusNotFound, "Conversation not found", err)
	}

	if conversation.UserId != userId {
		return e.Error(http.StatusForbidden, "Access denied", nil)
	}

	// Get messages
	messages, err := queries.GetActiveMessagesByConversationIdOrdered(e, conversationId)
	if err != nil {
		return e.Error(http.StatusInternalServerError, "Failed to get messages", err)
	}

	// Convert to response format
	messageResponses := make([]ConversationMessageResponse, 0)
	for _, msg := range messages {
		inputTokens, _ := strconv.ParseInt(msg.InputTokens, 10, 64)
		outputTokens, _ := strconv.ParseInt(msg.OutputTokens, 10, 64)
		reasoningTokens, _ := strconv.ParseInt(msg.ReasoningTokens, 10, 64)
		cost, _ := strconv.ParseFloat(msg.Cost, 64)

		messageResponses = append(messageResponses, ConversationMessageResponse{
			Id:              msg.Id,
			UserMessage:     msg.UserMessage,
			ResponseMessage: msg.ResponseMessage,
			ThinkingContent: msg.ThinkingContent,
			Model:           msg.Model,
			InputTokens:     inputTokens,
			OutputTokens:    outputTokens,
			ReasoningTokens: reasoningTokens,
			Cost:            cost,
			Active:          msg.Active,
			Created:         msg.Created,
		})
	}

	totalRequests, _ := strconv.Atoi(conversation.TotalRequests)
	inputTokens, _ := strconv.ParseInt(conversation.InputTokens, 10, 64)
	outputTokens, _ := strconv.ParseInt(conversation.OutputTokens, 10, 64)
	reasoningTokens, _ := strconv.ParseInt(conversation.ReasoningTokens, 10, 64)
	cost, _ := strconv.ParseFloat(conversation.Cost, 64)

	response := ConversationResponse{
		Id:              conversation.Id,
		Title:           conversation.Title,
		Type:            conversation.Type,
		TotalRequests:   totalRequests,
		InputTokens:     inputTokens,
		OutputTokens:    outputTokens,
		ReasoningTokens: reasoningTokens,
		Cost:            cost,
		Messages:        messageResponses,
		Created:         conversation.Created,
		Updated:         conversation.Updated,
	}

	return e.JSON(http.StatusOK, response)
}

func GetConversationsHandler(e *core.RequestEvent) error {
	setConversationCORSHeaders(e)

	userId := e.Auth.Id
	conversationType := e.Request.URL.Query().Get("type")
	includeMessages := e.Request.URL.Query().Get("include_messages")

	var conversations []*queries.Conversation
	var err error

	// Only get active conversations
	if conversationType != "" {
		conversations, err = queries.GetActiveConversationsByUserIdAndType(e, userId, conversationType, includeMessages == "true")
	} else {
		conversations, err = queries.GetActiveConversationsByUserId(e, userId, includeMessages == "true")
	}

	if err != nil {
		return e.Error(http.StatusInternalServerError, "Failed to get conversations", err)
	}

	// Initialize as empty slice to ensure JSON returns [] instead of null
	responses := make([]ConversationResponse, 0)
	for _, conv := range conversations {
		totalRequests, _ := strconv.Atoi(conv.TotalRequests)
		inputTokens, _ := strconv.ParseInt(conv.InputTokens, 10, 64)
		outputTokens, _ := strconv.ParseInt(conv.OutputTokens, 10, 64)
		reasoningTokens, _ := strconv.ParseInt(conv.ReasoningTokens, 10, 64)
		cost, _ := strconv.ParseFloat(conv.Cost, 64)

		messageResponses := make([]ConversationMessageResponse, 0)
		for _, msg := range conv.Messages {
			inputTokens, _ := strconv.ParseInt(msg.InputTokens, 10, 64)
			outputTokens, _ := strconv.ParseInt(msg.OutputTokens, 10, 64)
			reasoningTokens, _ := strconv.ParseInt(msg.ReasoningTokens, 10, 64)
			cost, _ := strconv.ParseFloat(msg.Cost, 64)

			messageResponses = append(messageResponses, ConversationMessageResponse{
				Id:              msg.Id,
				UserMessage:     msg.UserMessage,
				ResponseMessage: msg.ResponseMessage,
				ThinkingContent: msg.ThinkingContent,
				Model:           msg.Model,
				InputTokens:     inputTokens,
				OutputTokens:    outputTokens,
				ReasoningTokens: reasoningTokens,
				Cost:            cost,
				Active:          msg.Active,
				Created:         msg.Created,
			})
		}

		responses = append(responses, ConversationResponse{
			Id:              conv.Id,
			Title:           conv.Title,
			Type:            conv.Type,
			TotalRequests:   totalRequests,
			InputTokens:     inputTokens,
			OutputTokens:    outputTokens,
			ReasoningTokens: reasoningTokens,
			Cost:            cost,
			Messages:        messageResponses,
			Created:         conv.Created,
			Updated:         conv.Updated,
		})
	}

	return e.JSON(http.StatusOK, responses)
}

func setConversationStreamHeaders(e *core.RequestEvent) {
	e.Response.Header().Set("Content-Type", "text/event-stream")
	e.Response.Header().Set("Cache-Control", "no-cache")
	e.Response.Header().Set("Connection", "keep-alive")
	e.Response.Header().Set("Access-Control-Allow-Origin", "*")
	e.Response.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	e.Response.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
}

func setConversationCORSHeaders(e *core.RequestEvent) {
	e.Response.Header().Set("Access-Control-Allow-Origin", "*")
	e.Response.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	e.Response.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
}

func conversationOptionsHandler(e *core.RequestEvent) error {
	setConversationCORSHeaders(e)
	return e.NoContent(http.StatusOK)
}
