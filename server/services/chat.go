package services

import (
	"context"
	"strings"

	"github.com/openai/openai-go"
	"github.com/openai/openai-go/packages/param"
	"github.com/openai/openai-go/packages/ssestream"
)

var rules = []string{
	"You are a helpful AI assistant integrated into a markdown text editor called Textly.",
	"You can help users with writing, editing, research, and general questions.",
	"Be concise but helpful, and format your responses in markdown when appropriate.",
	"If the user asks about text editing or writing, you can provide specific suggestions.",
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

func getMessages(messages []Message) []openai.ChatCompletionMessageParamUnion {
	var openaiMessages []openai.ChatCompletionMessageParamUnion
	openaiMessages = append(openaiMessages, openai.SystemMessage(strings.Join(rules, "\n")))
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

func Chat(messages []Message) *ssestream.Stream[openai.ChatCompletionChunk] {
	var client = GetOpenAiClient()
	stream := client.Chat.Completions.NewStreaming(context.TODO(), openai.ChatCompletionNewParams{
		Messages:    getMessages(messages),
		Temperature: param.NewOpt(0.7),
		// StreamOptions: openai.ChatCompletionStreamOptionsParam{
		// 	IncludeUsage: param.NewOpt(true),
		// },
		Model: "meta-llama/llama-3.1-70b-instruct",
	})

	return stream
}
