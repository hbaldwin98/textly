package routes

import (
	"net/http"
	"textly/routes/middleware"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/router"
)

func RegisterAuthRoutes(s *core.ServeEvent) *router.RouterGroup[*core.RequestEvent] {
	authGroup := s.Router.Group("")
	authGroup.Bind(middleware.AuthMiddleware())

	// Auth-required routes
	authGroup.GET("/is_authenticated", isAuthenticatedHandler)
	return authGroup
}

func isAuthenticatedHandler(e *core.RequestEvent) error {
	return e.JSON(http.StatusOK, map[string]interface{}{
		"authenticated": true,
	})
}
