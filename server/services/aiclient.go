package services

import (
	"github.com/openai/openai-go"
	"github.com/openai/openai-go/option"
)

var openAiClient openai.Client

func InitializeOpenAI(baseURL, apiKey string) {
	openAiClient = openai.NewClient(
		option.WithBaseURL(baseURL),
		option.WithAPIKey(apiKey),
	)
}

func GetOpenAiClient() openai.Client {
	return openAiClient
}
