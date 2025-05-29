package services

import (
	"context"
	"errors"
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"
	"textly/queries"
	"time"

	"github.com/openai/openai-go"
	"github.com/openai/openai-go/packages/param"
	"github.com/openai/openai-go/packages/ssestream"
	"github.com/pocketbase/pocketbase/core"
)

var rules = []string{
	"You are a helpful AI assistant integrated into a markdown text editor called Textly.",
	"You can help users with writing, editing, research, and general questions.",
	"Be concise but helpful, and format your responses in markdown when appropriate.",
	"If the user asks about text editing or writing, you can provide specific suggestions.",
	"Do not give suggestions or tips for using Textly except for the context provided by these rules.",
}

type MessageRole string

const (
	MessageRoleUser      MessageRole = "user"
	MessageRoleAssistant MessageRole = "assistant"
	MessageRoleSystem    MessageRole = "system"
)

type Message struct {
	Role    MessageRole `json:"role"`
	Content string      `json:"content"`
}

type TextAssistRequest struct {
	Type    string `json:"type"`
	Text    string `json:"text"`
	Context string `json:"context"`
}

type TextAssistResponse struct {
	Suggestion string `json:"suggestion"`
}

func Chat(messages []Message, model string, useReasoning bool) *ssestream.Stream[openai.ChatCompletionChunk] {
	var client = GetOpenAiClient()

	selectedModel := model
	if selectedModel == "" {
		selectedModel = os.Getenv("OPENAI_BASE_MODEL")
	}

	params := openai.ChatCompletionNewParams{
		Messages:    convertToChatMessage(messages, rules),
		Temperature: param.NewOpt(0.7),
		StreamOptions: openai.ChatCompletionStreamOptionsParam{
			IncludeUsage: param.NewOpt(true),
		},
		Model:     selectedModel,
		MaxTokens: param.NewOpt(int64(4000)),
	}

	params.SetExtraFields(map[string]any{
		"include_reasoning": param.NewOpt(useReasoning),
	})

	return client.Chat.Completions.NewStreaming(context.TODO(), params)
}

func convertToChatMessage(messages []Message, systemRules []string) []openai.ChatCompletionMessageParamUnion {
	var openaiMessages []openai.ChatCompletionMessageParamUnion
	openaiMessages = append(openaiMessages, openai.SystemMessage(strings.Join(systemRules, "\n")))
	for _, message := range messages {
		switch message.Role {
		case MessageRoleUser:
			openaiMessages = append(openaiMessages, openai.UserMessage(message.Content))
		case MessageRoleAssistant:
			openaiMessages = append(openaiMessages, openai.AssistantMessage(message.Content))
		case MessageRoleSystem:
			openaiMessages = append(openaiMessages, openai.SystemMessage(message.Content))
		}
	}
	return openaiMessages
}

func TextAssist(e *core.RequestEvent, req TextAssistRequest, userId string) (string, error) {
	var client = GetOpenAiClient()

	var systemPrompt string
	var userPrompts []openai.ChatCompletionMessageParamUnion

	switch req.Type {
	case "improvement":
		systemPrompt = `You are a helpful assistant that suggests improvements to text.
			Be concise and to the point.
			Do not include any other text other than the improved text.
			Do not include how you refined the text, just the improved text.
			Only give one improved text at a time. If it's a paragraph, give the whole paragraph.
			Do not explain the improvement, just give it.
			Do not show the before and after of the text, just the improved text.
			Do not include any other text other than the improved text. That includes quotations, citations, or symbols.
			Utilize the context if necessary but do not include it in the improved text.`

		if req.Context != "" {
			userPrompts = append(userPrompts, openai.UserMessage("This is the surrounding context for the selected text. Use it to improve the text, do not include it in the improved text unless it's necessary: "+req.Context))
		}

		if req.Text != "" {
			userPrompts = append(userPrompts, openai.UserMessage("Selected Text: "+req.Text))
		}

	case "synonyms":
		systemPrompt = `You are a helpful assistant that provides synonyms for words.
			Provide a list of synonyms for the given word, separated by commas.
			Be concise and only include relevant synonyms.
			Do not include any other text or explanations.
			Do not include any symbols such as quotes, citations, or symbols at the beginning or end of the text.`
		userPrompts = append(userPrompts, openai.UserMessage("Word: "+req.Text))

	case "description":
		systemPrompt = `You are a helpful assistant that provides descriptions for text.
			Provide a clear and concise description of the given text.
			Be informative but brief.
			Do not include any other text or explanations.
			Do not include any symbols such as quotes, citations, or symbols at the beginning or end of the text.`
		userPrompts = append(userPrompts, openai.UserMessage("Text: "+req.Text))

	default:
		return "", errors.New("invalid query type")
	}

	messages := append(userPrompts, openai.SystemMessage(systemPrompt))

	// Use streaming to get usage data with cost
	params := openai.ChatCompletionNewParams{
		Messages:  messages,
		Model:     os.Getenv("OPENAI_BASE_MODEL"),
		MaxTokens: param.NewOpt(int64(4000)),
		StreamOptions: openai.ChatCompletionStreamOptionsParam{
			IncludeUsage: param.NewOpt(true),
		},
	}

	params.SetExtraFields(map[string]any{
		"include_reasoning": param.NewOpt(false),
	})

	stream := client.Chat.Completions.NewStreaming(context.TODO(), params)

	var suggestion strings.Builder
	var usage *openai.CompletionUsage

	// Process the stream
	for stream.Next() {
		chunk := stream.Current()
		if len(chunk.Choices) > 0 && chunk.Choices[0].Delta.Content != "" {
			suggestion.WriteString(chunk.Choices[0].Delta.Content)
		}

		usage = &chunk.Usage
	}

	if err := stream.Err(); err != nil {
		return "", err
	}

	if suggestion.Len() == 0 {
		return "", errors.New("failed to get response")
	}

	suggestionText := strings.ReplaceAll(suggestion.String(), "\\n", "\n")

	log.Println("Usage: ", usage)
	if usage != nil {
		log.Println("Usage JSON: ", usage.JSON)
	}

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

	// Create conversation title based on request type and text
	title := fmt.Sprintf("%s: %s", strings.Title(req.Type), req.Text)
	if len(title) > 100 {
		title = title[:97] + "..."
	}

	// Create conversation
	now := time.Now().Format(time.RFC3339)
	conversation := &queries.Conversation{
		UserId:          userId,
		Title:           title,
		TotalRequests:   "1",
		Type:            req.Type,
		Active:          true,
		InputTokens:     strconv.FormatInt(inputTokens, 10),
		OutputTokens:    strconv.FormatInt(outputTokens, 10),
		ReasoningTokens: strconv.FormatInt(reasoningTokens, 10),
		Cost:            fmt.Sprintf("%.6f", totalCost),
		Created:         now,
		Updated:         now,
	}

	createdConversation, err := queries.CreateConversation(e, conversation)
	if err != nil {
		return "", fmt.Errorf("failed to create conversation: %w", err)
	}

	// Create user message content
	userMessage := fmt.Sprintf("Type: %s\nText: %s", req.Type, req.Text)
	if req.Context != "" {
		userMessage += fmt.Sprintf("\nContext: %s", req.Context)
	}

	// Create conversation message
	message := &queries.ConversationMessage{
		UserId:          userId,
		ConversationId:  createdConversation.Id,
		UserMessage:     userMessage,
		ResponseMessage: suggestionText,
		Model:           os.Getenv("OPENAI_BASE_MODEL"),
		InputTokens:     strconv.FormatInt(inputTokens, 10),
		OutputTokens:    strconv.FormatInt(outputTokens, 10),
		Cost:            fmt.Sprintf("%.6f", totalCost),
		Active:          true,
		Created:         now,
	}

	_, err = queries.CreateConversationMessage(e, message)
	if err != nil {
		return "", fmt.Errorf("failed to create conversation message: %w", err)
	}

	return suggestionText, nil
}
