package application

import (
	"context"
	"crypto/tls"
	"log"
	"net/http"
	"os"
	"strings"
	"textly/routes"

	"github.com/joho/godotenv"
	"github.com/openai/openai-go"
	"github.com/openai/openai-go/option"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/plugins/migratecmd"
)

func InitializeApp() *pocketbase.PocketBase {
	err := godotenv.Load()
	if err != nil {
		log.Println("Error loading .env file")
	}

	app := pocketbase.New()
	BindAppHooks(app.App, true)
	isGoRun := strings.HasPrefix(os.Args[0], os.TempDir())

	migratecmd.MustRegister(app, app.RootCmd, migratecmd.Config{
		Automigrate: isGoRun,
	})

	client := openai.NewClient(
		option.WithBaseURL(os.Getenv("OPENAI_BASE_URL")),
		option.WithAPIKey(os.Getenv("OPENAI_API_KEY")), // defaults to os.LookupEnv("OPENAI_API_KEY")
	)
	chatCompletion, err := client.Chat.Completions.New(context.TODO(), openai.ChatCompletionNewParams{
		Messages: []openai.ChatCompletionMessageParamUnion{
			openai.UserMessage("Say this is a test"),
		},
		Model: "meta-llama/llama-3.1-70b-instruct",
	})
	if err != nil {
		panic(err.Error())
	}
	println(chatCompletion.Choices[0].Message.Content)

	return app
}

func BindAppHooks(app core.App, loadCerts bool) {
	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		se.Router.GET("/", StatusHandler)

		routes.RegisterAuthRoutes(se)
		routes.RegisterAIRoutes(se)

		// Load TLS certificate
		if loadCerts {
			cert, err := tls.LoadX509KeyPair("server.crt", "server.key")
			if err != nil {
				log.Fatalf("Failed to load TLS certificate: %v", err)
			}

			// Configure TLS
			se.Server.TLSConfig = &tls.Config{
				Certificates: []tls.Certificate{cert},
			}
		}

		return se.Next()
	})
}

func StatusHandler(e *core.RequestEvent) error {
	return e.JSON(http.StatusOK, map[string]interface{}{
		"status": "ok",
	})
}
