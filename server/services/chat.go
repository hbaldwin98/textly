package services

import (
	"context"
	"errors"
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

type TextAssistRequest struct {
	Type    string `json:"type"`
	Text    string `json:"text"`
	Context string `json:"context"`
}

type TextAssistResponse struct {
	Suggestion string `json:"suggestion"`
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
		StreamOptions: openai.ChatCompletionStreamOptionsParam{
			IncludeUsage: param.NewOpt(true),
		},
		Model: "meta-llama/llama-3.1-70b-instruct",
	})

	return stream
}

func TextAssist(req TextAssistRequest) (string, error) {
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

	completion, err := client.Chat.Completions.New(context.TODO(), openai.ChatCompletionNewParams{
		Messages: messages,
		Model:    "meta-llama/llama-3.1-70b-instruct",
	})

	if err != nil {
		return "", err
	}

	if len(completion.Choices) == 0 || completion.Choices[0].Message.Content == "" {
		return "", errors.New("failed to get response")
	}

	suggestion := strings.ReplaceAll(completion.Choices[0].Message.Content, "\\n", "\n")
	return suggestion, nil
}
