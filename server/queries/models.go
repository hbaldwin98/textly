package queries

import (
	"encoding/json"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
)

type Conversation struct {
	Id              string                `db:"id"`
	UserId          string                `db:"user"`
	Title           string                `db:"title"`
	Type            string                `db:"type"`
	TotalRequests   string                `db:"total_requests"`
	InputTokens     string                `db:"input_tokens"`
	OutputTokens    string                `db:"output_tokens"`
	ReasoningTokens string                `db:"reasoning_tokens"`
	Cost            string                `db:"cost"`
	Active          bool                  `db:"active"`
	Created         string                `db:"created"`
	Updated         string                `db:"updated"`
	Messages        []ConversationMessage `db:"-"`
}

type ConversationMessage struct {
	Id              string `db:"id"`
	UserId          string `db:"user"`
	ConversationId  string `db:"conversation"`
	UserMessage     string `db:"user_message"`
	ResponseMessage string `db:"response_message"`
	ThinkingContent string `db:"thinking_content"`
	Model           string `db:"model"`
	InputTokens     string `db:"input_tokens"`
	OutputTokens    string `db:"output_tokens"`
	ReasoningTokens string `db:"reasoning_tokens"`
	Cost            string `db:"cost"`
	Active          bool   `db:"active"`
	Created         string `db:"created"`
}

type Document struct {
	Id       string `db:"id"`
	Parent   string `db:"parent"`
	IsFolder bool   `db:"is_folder"`
	Created  string `db:"created"`
	Updated  string `db:"updated"`
}

type AIModel struct {
	Id           string `db:"id" json:"id"`
	Identifier   string `db:"identifier" json:"identifier"`
	Name         string `db:"name" json:"name"`
	Description  string `db:"description" json:"description"`
	Icon         string `db:"icon" json:"icon"`
	Capabilities string `db:"capabilities" json:"capabilities"`
	Provider     string `db:"provider" json:"provider"`
	Default      bool   `db:"default" json:"default"`
	Created      string `db:"created" json:"created"`
	Updated      string `db:"updated" json:"updated"`
}

func (m *AIModel) GetCapabilities() ([]string, error) {
	var capabilities []string
	if m.Capabilities == "" {
		return nil, nil
	}

	if err := json.Unmarshal([]byte(m.Capabilities), &capabilities); err != nil {
		return nil, err
	}
	return capabilities, nil
}

func CreateAIModel(e *core.RequestEvent, model *AIModel) (*AIModel, error) {
	collection, err := e.App.FindCollectionByNameOrId("ai_models")
	if err != nil {
		return nil, err
	}

	record := core.NewRecord(collection)
	record.Set("identifier", model.Identifier)
	record.Set("name", model.Name)
	record.Set("description", model.Description)
	record.Set("icon", model.Icon)
	record.Set("capabilities", model.Capabilities)
	record.Set("provider", model.Provider)
	record.Set("default", model.Default)

	if err := e.App.Save(record); err != nil {
		return nil, err
	}

	return &AIModel{
		Id:           record.Id,
		Identifier:   record.GetString("identifier"),
		Name:         model.Name,
		Description:  model.Description,
		Icon:         model.Icon,
		Capabilities: model.Capabilities,
		Provider:     model.Provider,
		Default:      model.Default,
		Created:      record.GetString("created"),
		Updated:      record.GetString("updated"),
	}, nil
}

func seedDefaultAIModel(se *core.ServeEvent, model *AIModel) (*AIModel, error) {
	collection, err := se.App.FindCollectionByNameOrId("ai_models")
	if err != nil {
		return nil, err
	}

	record := core.NewRecord(collection)
	record.Set("identifier", model.Identifier)
	record.Set("name", model.Name)
	record.Set("description", model.Description)
	record.Set("icon", model.Icon)
	record.Set("capabilities", model.Capabilities)
	record.Set("provider", model.Provider)
	record.Set("default", model.Default)

	if err := se.App.Save(record); err != nil {
		return nil, err
	}

	return &AIModel{
		Id:           record.Id,
		Name:         model.Name,
		Description:  model.Description,
		Icon:         model.Icon,
		Capabilities: model.Capabilities,
		Provider:     model.Provider,
		Default:      model.Default,
		Created:      record.GetString("created"),
		Updated:      record.GetString("updated"),
	}, nil
}

func GetAIModelByIdentifier(e *core.RequestEvent, identifier string) (*AIModel, error) {
	query := e.App.DB().Select("*").From("ai_models").Where(dbx.HashExp{"identifier": identifier})

	var model AIModel
	if err := query.One(&model); err != nil {
		return nil, err
	}

	return &model, nil
}

func getAIModelByIdentifier(se *core.ServeEvent, identifier string) (*AIModel, error) {
	query := se.App.DB().Select("*").From("ai_models").Where(dbx.HashExp{"identifier": identifier})

	var model AIModel
	if err := query.One(&model); err != nil {
		return nil, err
	}

	return &model, nil
}

func GetAllAIModels(e *core.RequestEvent) ([]*AIModel, error) {
	query := e.App.DB().Select("*").From("ai_models").OrderBy("provider DESC")

	var models []*AIModel
	if err := query.All(&models); err != nil {
		return nil, err
	}

	return models, nil
}

func UpdateAIModel(e *core.RequestEvent, identifier string, fields dbx.Params) error {
	query := e.App.DB().Update("ai_models", fields, dbx.HashExp{"identifier": identifier})
	_, err := query.Execute()
	return err
}

func updateDefaultAIModel(e *core.ServeEvent, identifier string, fields dbx.Params) error {
	query := e.App.DB().Update("ai_models", fields, dbx.HashExp{"identifier": identifier})
	_, err := query.Execute()
	return err
}

func DeleteAIModel(e *core.RequestEvent, identifier string) error {
	query := e.App.DB().Delete("ai_models", dbx.HashExp{"identifier": identifier})
	_, err := query.Execute()
	return err
}

func SeedDefaultModels(e *core.ServeEvent) error {
	defaultModels := []*AIModel{
		{
			Identifier:   "openai/gpt-4.1",
			Name:         "GPT-4.1",
			Description:  "Most capable model with advanced reasoning",
			Icon:         "🤖",
			Capabilities: `["internet"]`,
			Provider:     "OpenAI",
			Default:      false,
		},
		{
			Identifier:   "openai/gpt-4.1-mini",
			Name:         "GPT-4.1 Mini",
			Description:  "Fast and efficient for everyday tasks",
			Icon:         "🚀",
			Capabilities: `["internet"]`,
			Provider:     "OpenAI",
			Default:      false,
		},
		{
			Identifier:   "openai/gpt-4o",
			Name:         "GPT-4o",
			Description:  "More capable model with advanced reasoning",
			Icon:         "🤖",
			Capabilities: `["internet"]`,
			Provider:     "OpenAI",
			Default:      false,
		},
		{
			Identifier:   "openai/gpt-4o-mini",
			Name:         "GPT-4o Mini",
			Description:  "Fast and efficient for everyday tasks",
			Icon:         "⚡",
			Capabilities: `["internet"]`,
			Provider:     "OpenAI",
			Default:      false,
		},
		{
			Identifier:   "anthropic/claude-sonnet-4",
			Name:         "Claude Sonnet 4",
			Description:  "Anthropic's latest and most capable model",
			Icon:         "🎭",
			Capabilities: `["reasoning"]`,
			Provider:     "Anthropic",
			Default:      false,
		},
		{
			Identifier:   "anthropic/claude-3.5-sonnet",
			Name:         "Claude 3.5 Sonnet",
			Description:  "Anthropic's older but reliable model",
			Icon:         "🎪",
			Capabilities: "",
			Provider:     "Anthropic",
			Default:      false,
		},
		{
			Identifier:   "meta-llama/llama-4-maverick",
			Name:         "Llama 4 Maverick",
			Description:  "Meta's latest and most capable model",
			Icon:         "🦙",
			Capabilities: "",
			Provider:     "Meta",
			Default:      false,
		},
		{
			Identifier:   "meta-llama/llama-3.1-70b-instruct",
			Name:         "Llama 3.1 70B Instruct",
			Description:  "Meta's latest and most capable model",
			Icon:         "🐐",
			Capabilities: "",
			Provider:     "Meta",
			Default:      true,
		},
		{
			Identifier:   "perplexity/sonar-reasoning",
			Name:         "Perplexity Sonar Reasoning",
			Description:  "Perplexity's reasoning model powered by DeepSeek R1",
			Icon:         "🔬",
			Capabilities: `["reasoning", "internet"]`,
			Provider:     "Perplexity",
			Default:      false,
		},
		{
			Identifier:   "perplexity/sonar-reasoning-pro",
			Name:         "Perplexity Sonar Reasoning Pro",
			Description:  "Perplexity's advanced reasoning model powered by DeepSeek R1",
			Icon:         "🔭",
			Capabilities: `["reasoning", "internet"]`,
			Provider:     "Perplexity",
			Default:      false,
		},
		{
			Identifier:   "perplexity/sonar",
			Name:         "Perplexity Sonar",
			Description:  "Perplexity's affordable Q&A model",
			Icon:         "🔍",
			Capabilities: `["internet"]`,
			Provider:     "Perplexity",
			Default:      false,
		},
		{
			Identifier:   "google/gemini-2.5-pro-preview",
			Name:         "Gemini 2.5 Pro Preview",
			Description:  "Google's latest and most capable model",
			Icon:         "✨",
			Capabilities: `["reasoning"]`,
			Provider:     "Google",
			Default:      false,
		},
		{
			Identifier:   "google/gemini-2.5-flash-preview-05-20",
			Name:         "Gemini 2.5 Flash Preview",
			Description:  "Google's latest and most capable flash model",
			Icon:         "💎",
			Capabilities: `["reasoningsuffix"]`,
			Provider:     "Google",
			Default:      false,
		},
		{
			Identifier:   "qwen/qwen3-235b-a22b",
			Name:         "Qwen 3.235B",
			Description:  "Qwen's latest and most capable model",
			Icon:         "🐉",
			Capabilities: `["reasoning"]`,
			Provider:     "Qwen",
			Default:      false,
		},
		{
			Identifier:   "deepseek/deepseek-r1-0528",
			Name:         "DeepSeek R1 0528",
			Description:  "DeepSeek's latest and most capable model (Updated)",
			Icon:         "🌊",
			Capabilities: `["reasoning"]`,
			Provider:     "DeepSeek",
			Default:      false,
		},

		{
			Identifier:   "deepseek/deepseek-r1",
			Name:         "DeepSeek R1",
			Description:  "DeepSeek's latest and most capable model",
			Icon:         "🌌",
			Capabilities: `["reasoning"]`,
			Provider:     "DeepSeek",
			Default:      false,
		},
	}

	modelsToCreate := []*AIModel{}
	modelsToUpdate := []*AIModel{}
	for _, model := range defaultModels {
		databaseModel, err := getAIModelByIdentifier(e, model.Identifier)
		if err != nil || databaseModel == nil {
			modelsToCreate = append(modelsToCreate, model)
		} else {
			modelsToUpdate = append(modelsToUpdate, model)
		}
	}

	for _, model := range modelsToCreate {
		if _, err := seedDefaultAIModel(e, model); err != nil {
			return err
		}
	}

	for _, model := range modelsToUpdate {
		if err := updateDefaultAIModel(e, model.Identifier, dbx.Params{
			"name":         model.Name,
			"description":  model.Description,
			"icon":         model.Icon,
			"capabilities": model.Capabilities,
			"provider":     model.Provider,
			"default":      model.Default,
		}); err != nil {
			return err
		}
	}

	return nil
}
