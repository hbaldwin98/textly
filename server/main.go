package main

import (
	"log"
	"textly/application"
	//	_ "textly/migrations"
)

func main() {
	app := application.InitializeApp()

	// Start the server with HTTPS
	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}
