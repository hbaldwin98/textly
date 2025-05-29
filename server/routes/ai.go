package routes

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
	"textly/queries"
	"textly/routes/middleware"
	"textly/services"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/router"
)

// AIModelDTO represents the AI model data transfer object
type AIModelDTO struct {
	Id           string   `json:"id"`
	Identifier   string   `json:"identifier"`
	Name         string   `json:"name"`
	Description  string   `json:"description"`
	Icon         string   `json:"icon"`
	Capabilities []string `json:"capabilities"`
	Provider     string   `json:"provider"`
	Default      bool     `json:"default"`
	Created      string   `json:"created"`
	Updated      string   `json:"updated"`
}

// ToDTO converts an AIModel to AIModelDTO
func ToDTO(model *queries.AIModel) (*AIModelDTO, error) {
	capabilities, err := model.GetCapabilities()
	if err != nil {
		return nil, err
	}

	return &AIModelDTO{
		Id:           model.Id,
		Identifier:   model.Identifier,
		Name:         model.Name,
		Description:  model.Description,
		Icon:         model.Icon,
		Capabilities: capabilities,
		Provider:     model.Provider,
		Default:      model.Default,
		Created:      model.Created,
		Updated:      model.Updated,
	}, nil
}

func RegisterAIRoutes(s *core.ServeEvent) *router.RouterGroup[*core.RequestEvent] {
	aiGroup := s.Router.Group("/ai")

	// Add OPTIONS handlers for CORS preflight (without auth middleware)
	aiGroup.OPTIONS("/assist", OptionsHandler)
	aiGroup.OPTIONS("/models", OptionsHandler)
	aiGroup.OPTIONS("/models/:id", OptionsHandler)

	// Add auth middleware for actual endpoints
	aiGroup.Bind(middleware.AuthMiddleware())
	aiGroup.POST("/assist", TextAssistHandler)
	aiGroup.GET("/models", ModelsHandler)

	// Add model management routes
	aiGroup.POST("/models", CreateModelHandler)
	aiGroup.GET("/models/:id", GetModelHandler)
	aiGroup.PUT("/models/:id", UpdateModelHandler)
	aiGroup.DELETE("/models/:id", DeleteModelHandler)

	return aiGroup
}

func PlatformStatusHandler(e *core.RequestEvent) error {
	return e.JSON(http.StatusOK, "AI is working")
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

func ModelsHandler(e *core.RequestEvent) error {
	setCORSHeaders(e)

	models, err := queries.GetAllAIModels(e)
	if err != nil {
		log.Println("Failed to fetch models:", err)
		return e.Error(http.StatusInternalServerError, "Failed to fetch models", err)
	}

	// Convert models to DTOs
	modelDTOs := make([]*AIModelDTO, len(models))
	for i, model := range models {
		dto, err := ToDTO(model)
		if err != nil {
			return e.Error(http.StatusInternalServerError, "Failed to process model data", err)
		}
		modelDTOs[i] = dto
	}

	return e.JSON(http.StatusOK, map[string]interface{}{
		"models": modelDTOs,
	})
}

func CreateModelHandler(e *core.RequestEvent) error {
	setCORSHeaders(e)

	var model queries.AIModel
	bodyBytes, err := io.ReadAll(e.Request.Body)
	if err != nil {
		return e.Error(http.StatusBadRequest, "Failed to read request body", err)
	}

	if err := json.Unmarshal(bodyBytes, &model); err != nil {
		return e.Error(http.StatusBadRequest, "Invalid request body", err)
	}

	createdModel, err := queries.CreateAIModel(e, &model)
	if err != nil {
		return e.Error(http.StatusInternalServerError, "Failed to create model", err)
	}

	return e.JSON(http.StatusCreated, createdModel)
}

func GetModelHandler(e *core.RequestEvent) error {
	setCORSHeaders(e)

	id := e.Request.PathValue("id")
	if id == "" {
		return e.Error(http.StatusBadRequest, "Model ID is required", nil)
	}

	model, err := queries.GetAIModelByIdentifier(e, id)
	if err != nil {
		return e.Error(http.StatusNotFound, "Model not found", err)
	}

	dto, err := ToDTO(model)
	if err != nil {
		return e.Error(http.StatusInternalServerError, "Failed to process model data", err)
	}

	return e.JSON(http.StatusOK, dto)
}

func UpdateModelHandler(e *core.RequestEvent) error {
	setCORSHeaders(e)

	id := e.Request.PathValue("id")
	if id == "" {
		return e.Error(http.StatusBadRequest, "Model ID is required", nil)
	}

	var fields map[string]interface{}
	bodyBytes, err := io.ReadAll(e.Request.Body)
	if err != nil {
		return e.Error(http.StatusBadRequest, "Failed to read request body", err)
	}

	if err := json.Unmarshal(bodyBytes, &fields); err != nil {
		return e.Error(http.StatusBadRequest, "Invalid request body", err)
	}

	if err := queries.UpdateAIModel(e, id, fields); err != nil {
		return e.Error(http.StatusInternalServerError, "Failed to update model", err)
	}

	model, err := queries.GetAIModelByIdentifier(e, id)
	if err != nil {
		return e.Error(http.StatusInternalServerError, "Failed to fetch updated model", err)
	}

	return e.JSON(http.StatusOK, model)
}

func DeleteModelHandler(e *core.RequestEvent) error {
	setCORSHeaders(e)

	id := e.Request.PathValue("id")
	if id == "" {
		return e.Error(http.StatusBadRequest, "Model ID is required", nil)
	}

	if err := queries.DeleteAIModel(e, id); err != nil {
		return e.Error(http.StatusInternalServerError, "Failed to delete model", err)
	}

	return e.NoContent(http.StatusNoContent)
}
