package routes

import (
	"net/http"
	"textly/routes/middleware"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/router"
)

func RegisterAIRoutes(s *core.ServeEvent) *router.RouterGroup[*core.RequestEvent] {
	aiGroup := s.Router.Group("/ai")
	aiGroup.Bind(middleware.AuthMiddleware())

	return aiGroup
}

func PlatformStatusHandler(e *core.RequestEvent) error {
	return e.JSON(http.StatusOK, "AI is working")
}
