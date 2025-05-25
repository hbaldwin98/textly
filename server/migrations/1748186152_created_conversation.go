package migrations

import (
	"encoding/json"

	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
	m.Register(func(app core.App) error {
		jsonData := `{
			"createRule": null,
			"deleteRule": null,
			"fields": [
				{
					"autogeneratePattern": "[a-z0-9]{15}",
					"hidden": false,
					"id": "text3208210256",
					"max": 15,
					"min": 15,
					"name": "id",
					"pattern": "^[a-z0-9]+$",
					"presentable": false,
					"primaryKey": true,
					"required": true,
					"system": true,
					"type": "text"
				},
				{
					"cascadeDelete": false,
					"collectionId": "_pb_users_auth_",
					"hidden": false,
					"id": "relation2375276105",
					"maxSelect": 1,
					"minSelect": 0,
					"name": "user",
					"presentable": false,
					"required": false,
					"system": false,
					"type": "relation"
				},
				{
					"cascadeDelete": false,
					"collectionId": "pbc_3709231855",
					"hidden": false,
					"id": "relation3260161009",
					"maxSelect": 1,
					"minSelect": 0,
					"name": "conversations",
					"presentable": false,
					"required": false,
					"system": false,
					"type": "relation"
				},
				{
					"autogeneratePattern": "",
					"hidden": false,
					"id": "text4004523637",
					"max": 0,
					"min": 0,
					"name": "user_message",
					"pattern": "",
					"presentable": false,
					"primaryKey": false,
					"required": false,
					"system": false,
					"type": "text"
				},
				{
					"autogeneratePattern": "",
					"hidden": false,
					"id": "text487028225",
					"max": 0,
					"min": 0,
					"name": "response_message",
					"pattern": "",
					"presentable": false,
					"primaryKey": false,
					"required": false,
					"system": false,
					"type": "text"
				},
				{
					"hidden": false,
					"id": "number1726912723",
					"max": null,
					"min": null,
					"name": "input_tokens",
					"onlyInt": false,
					"presentable": false,
					"required": false,
					"system": false,
					"type": "number"
				},
				{
					"hidden": false,
					"id": "number2122787687",
					"max": null,
					"min": null,
					"name": "output_tokens",
					"onlyInt": false,
					"presentable": false,
					"required": false,
					"system": false,
					"type": "number"
				},
				{
					"hidden": false,
					"id": "autodate2990389176",
					"name": "created",
					"onCreate": true,
					"onUpdate": false,
					"presentable": false,
					"system": false,
					"type": "autodate"
				}
			],
			"id": "pbc_37092318552",
			"indexes": [
				"CREATE INDEX ` + "`" + `idx_eZcjDgn38S` + "`" + ` ON ` + "`" + `conversation` + "`" + ` (\n  ` + "`" + `user` + "`" + `,\n  ` + "`" + `conversations` + "`" + `\n)",
				"CREATE INDEX ` + "`" + `idx_bpJT2J4zo1` + "`" + ` ON ` + "`" + `conversation` + "`" + ` (` + "`" + `conversations` + "`" + `)",
				"CREATE INDEX ` + "`" + `idx_2BwbxAtT9A` + "`" + ` ON ` + "`" + `conversation` + "`" + ` (` + "`" + `user` + "`" + `)"
			],
			"listRule": null,
			"name": "conversation",
			"system": false,
			"type": "base",
			"updateRule": null,
			"viewRule": null
		}`

		collection := &core.Collection{}
		if err := json.Unmarshal([]byte(jsonData), &collection); err != nil {
			return err
		}

		return app.Save(collection)
	}, func(app core.App) error {
		collection, err := app.FindCollectionByNameOrId("pbc_37092318552")
		if err != nil {
			return err
		}

		return app.Delete(collection)
	})
}
