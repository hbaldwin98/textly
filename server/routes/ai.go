package routes

import (
	"encoding/json"
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
	Messages []services.Message `json:"messages"`
}

func RegisterAIRoutes(s *core.ServeEvent) *router.RouterGroup[*core.RequestEvent] {
	aiGroup := s.Router.Group("/ai")
	aiGroup.Bind(middleware.AuthMiddleware())

	aiGroup.POST("/chat", ChatHandler)

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
	stream := services.Chat(req.Messages)
	return handleStream(e, stream)
}

func setStreamHeaders(e *core.RequestEvent) {
	e.Response.Header().Set("Content-Type", "text/event-stream")
	e.Response.Header().Set("Cache-Control", "no-cache")
	e.Response.Header().Set("Connection", "keep-alive")
	e.Response.Header().Set("Access-Control-Allow-Origin", "*")
}

func handleStream(e *core.RequestEvent, stream *ssestream.Stream[openai.ChatCompletionChunk]) error {
	for stream.Next() {
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
