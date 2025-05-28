package routes

import (
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"strings"
	"textly/routes/middleware"
	"textly/services"

	"github.com/openai/openai-go"
	"github.com/openai/openai-go/packages/ssestream"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/router"
)

type ChatRequest struct {
	Messages       []services.Message `json:"messages"`
	ConversationId string             `json:"conversation_id,omitempty"`
}

func RegisterAIRoutes(s *core.ServeEvent) *router.RouterGroup[*core.RequestEvent] {
	aiGroup := s.Router.Group("/ai")

	// Add OPTIONS handlers for CORS preflight (without auth middleware)
	aiGroup.OPTIONS("/chat", OptionsHandler)
	aiGroup.OPTIONS("/assist", OptionsHandler)
	aiGroup.OPTIONS("/models", OptionsHandler)

	// Add auth middleware for actual endpoints
	aiGroup.Bind(middleware.AuthMiddleware())
	aiGroup.POST("/chat", ChatHandler)
	aiGroup.POST("/assist", TextAssistHandler)
	aiGroup.GET("/models", ModelsHandler)

	return aiGroup
}

func PlatformStatusHandler(e *core.RequestEvent) error {
	return e.JSON(http.StatusOK, "AI is working")
}

func ChatHandler(e *core.RequestEvent) error {
	setStreamHeaders(e)

	var req ChatRequest
	bodyBytes, err := io.ReadAll(e.Request.Body)
	if err != nil {
		return e.Error(http.StatusBadRequest, "Failed to read request body", err)
	}

	if err := json.Unmarshal(bodyBytes, &req); err != nil {
		return e.Error(http.StatusBadRequest, "Invalid request body", err)
	}

	log.Println("Received messages: ", req.Messages)

	// If conversation ID is provided, this is a legacy streaming request
	// For now, just handle it as before
	stream := services.Chat(req.Messages, "", false)
	if err := handleStream(e, stream); err != nil {
		log.Println("Stream error: ", err)
		return e.Error(http.StatusInternalServerError, "AI processing failed", err)
	}

	return nil
}

func setStreamHeaders(e *core.RequestEvent) {
	e.Response.Header().Set("Content-Type", "text/event-stream")
	e.Response.Header().Set("Cache-Control", "no-cache")
	e.Response.Header().Set("Connection", "keep-alive")
	e.Response.Header().Set("Access-Control-Allow-Origin", "*")
	e.Response.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	e.Response.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
}

func setCORSHeaders(e *core.RequestEvent) {
	e.Response.Header().Set("Access-Control-Allow-Origin", "*")
	e.Response.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	e.Response.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
}

func OptionsHandler(e *core.RequestEvent) error {
	setCORSHeaders(e)
	return e.NoContent(http.StatusOK)
}

func TextAssistHandler(e *core.RequestEvent) error {
	setCORSHeaders(e)

	var req services.TextAssistRequest
	bodyBytes, err := io.ReadAll(e.Request.Body)
	if err != nil {
		return e.Error(http.StatusBadRequest, "Failed to read request body", err)
	}

	if err := json.Unmarshal(bodyBytes, &req); err != nil {
		return e.Error(http.StatusBadRequest, "Invalid request body", err)
	}

	log.Println("Received text assist request: ", req)

	suggestion, err := services.TextAssist(e, req, e.Auth.Id)
	if err != nil {
		log.Println("Text assist error:", err)
		return e.Error(http.StatusInternalServerError, "AI processing failed", err)
	}

	response := services.TextAssistResponse{
		Suggestion: suggestion,
	}

	return e.JSON(http.StatusOK, response)
}

func handleStream(e *core.RequestEvent, stream *ssestream.Stream[openai.ChatCompletionChunk]) error {
	if stream == nil {
		return e.Error(http.StatusInternalServerError, "AI processing failed", errors.New("stream is nil"))
	}

	if stream.Err() != nil {
		return stream.Err()
	}

	for stream.Next() {
		if stream.Err() != nil {
			return stream.Err()
		}

		chunk := stream.Current()
		content := chunk.Choices[0].Delta.Content

		log.Println("Usage: ", chunk.Usage)
		escapedContent := strings.ReplaceAll(content, "\n", "\\n")

		sseData := "data: " + escapedContent + "\n\n"
		e.Response.Write([]byte(sseData))

		if flusher, ok := e.Response.(http.Flusher); ok {
			flusher.Flush()
		}
	}

	// Send completion event
	e.Response.Write([]byte("data: [DONE]\n\n"))

	return nil
}

func ModelsHandler(e *core.RequestEvent) error {
	setCORSHeaders(e)

	// Default model configuration
	models := map[string]interface{}{
		"models": []map[string]interface{}{
			{
				"id":          "openai/gpt-4.1",
				"name":        "GPT-4.1",
				"description": "Most capable model with advanced reasoning",
				"icon":        "🤖",
				"capabilities": map[string]bool{
					"reasoning": false,
					"internet":  true,
					"standard":  true,
				},
				"provider": "OpenAI",
				"default":  false,
			},

			{
				"id":          "openai/gpt-4o",
				"name":        "GPT-4o",
				"description": "More capable model with advanced reasoning",
				"icon":        "🤖",
				"capabilities": map[string]bool{
					"reasoning": false,
					"internet":  true,
					"standard":  true,
				},
				"provider": "OpenAI",
				"default":  false,
			},
			{
				"id":          "openai/gpt-4o-mini",
				"name":        "GPT-4o Mini",
				"description": "Fast and efficient for everyday tasks",
				"icon":        "⚡",
				"capabilities": map[string]bool{
					"reasoning": false,
					"internet":  true,
					"standard":  true,
				},
				"provider": "OpenAI",
				"default":  false,
			},
			{
				"id":          "openai/gpt-4.1-mini",
				"name":        "GPT-4.1 Mini",
				"description": "Fast and efficient for everyday tasks",
				"icon":        "🚀",
				"capabilities": map[string]bool{
					"reasoning": false,
					"internet":  true,
					"standard":  true,
				},
				"provider": "OpenAI",
				"default":  false,
			},
			{
				"id":          "anthropic/claude-sonnet-4",
				"name":        "Claude Sonnet 4",
				"description": "Anthropic's latest and most capable model",
				"icon":        "🎭",
				"capabilities": map[string]bool{
					"reasoning": true,
					"internet":  false,
					"standard":  true,
				},
				"provider": "Anthropic",
				"default":  false,
			},
			{
				"id":          "anthropic/claude-3-5-sonnet",
				"name":        "Claude 3.5 Sonnet",
				"description": "Anthropic's older but reliable model",
				"icon":        "🎪",
				"capabilities": map[string]bool{
					"reasoning": false,
					"internet":  false,
					"standard":  true,
				},
				"provider": "Anthropic",
				"default":  false,
			},
			{
				"id":          "meta-llama/llama-4-maverick",
				"name":        "Llama 4 Maverick",
				"description": "Meta's latest and most capable model",
				"icon":        "🦙",
				"capabilities": map[string]bool{
					"reasoning": false,
					"internet":  false,
					"standard":  true,
				},
				"provider": "Meta",
				"default":  false,
			},
			{
				"id":          "meta-llama/llama-3.1-70b-instruct",
				"name":        "Llama 3.1 70B Instruct",
				"description": "Meta's latest and most capable model",
				"icon":        "🐐",
				"capabilities": map[string]bool{
					"reasoning": false,
					"internet":  false,
					"standard":  true,
				},
				"provider": "Meta",
				"default":  true,
			},
			{
				"id":          "perplexity/sonar",
				"name":        "Perplexity Sonar",
				"description": "Perplexity's affordable Q&A model",
				"icon":        "🔍",
				"capabilities": map[string]bool{
					"reasoning": false,
					"internet":  true,
					"standard":  true,
				},
				"provider": "Perplexity",
				"default":  false,
			},
			{
				"id":          "google/gemini-2.5-flash-preview-05-20",
				"name":        "Gemini 2.5 Flash Preview",
				"description": "Google's latest and most capable model",
				"icon":        "💎",
				"capabilities": map[string]bool{
					"reasoning": true,
					"internet":  false,
					"standard":  true,
				},
				"provider": "Google",
				"default":  false,
			},
			{
				"id":          "qwen/qwen3-235b-a22b",
				"name":        "Qwen 3.235B",
				"description": "Qwen's latest and most capable model",
				"icon":        "🐉",
				"capabilities": map[string]bool{
					"reasoning": true,
					"internet":  false,
					"standard":  true,
				},
				"provider": "Qwen",
				"default":  false,
			},
			{
				"id":          "deepseek/deepseek-r1",
				"name":        "DeepSeek R1",
				"description": "DeepSeek's latest and most capable model",
				"icon":        "🌊",
				"capabilities": map[string]bool{
					"reasoning": true,
					"internet":  false,
					"standard":  true,
				},
				"provider": "DeepSeek",
				"default":  false,
			},
		},
	}

	return e.JSON(http.StatusOK, models)
}
