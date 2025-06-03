package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
	m.Register(func(app core.App) error {
		collection, err := app.FindCollectionByNameOrId("pbc_2249708725")
		if err != nil {
			return err
		}

		// update field
		if err := collection.Fields.AddMarshaledJSONAt(5, []byte(`{
			"hidden": false,
			"id": "select490417661",
			"maxSelect": 2,
			"name": "capabilities",
			"presentable": false,
			"required": false,
			"system": false,
			"type": "select",
			"values": [
				"reasoning",
				"internet",
				"reasoningsuffix"
			]
		}`)); err != nil {
			return err
		}

		return app.Save(collection)
	}, func(app core.App) error {
		collection, err := app.FindCollectionByNameOrId("pbc_2249708725")
		if err != nil {
			return err
		}

		// update field
		if err := collection.Fields.AddMarshaledJSONAt(5, []byte(`{
			"hidden": false,
			"id": "select490417661",
			"maxSelect": 2,
			"name": "capabilities",
			"presentable": false,
			"required": false,
			"system": false,
			"type": "select",
			"values": [
				"reasoning",
				"internet",
				"reasoning-suffix"
			]
		}`)); err != nil {
			return err
		}

		return app.Save(collection)
	})
}
