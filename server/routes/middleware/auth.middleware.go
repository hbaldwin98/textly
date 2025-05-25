package middleware

import (
	"net/http"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/hook"
)

func AuthMiddleware() *hook.Handler[*core.RequestEvent] {
	return &hook.Handler[*core.RequestEvent]{
		Id: "auth",
		Func: func(e *core.RequestEvent) error {
			if e.Auth == nil {
				return e.Error(http.StatusUnauthorized, "Authentication required", nil)
			}
			return e.Next()
		},
	}
}
