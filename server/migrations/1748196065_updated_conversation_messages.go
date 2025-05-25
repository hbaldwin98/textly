package migrations

import (
	"encoding/json"

	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
	m.Register(func(app core.App) error {
		collection, err := app.FindCollectionByNameOrId("pbc_37092318552")
		if err != nil {
			return err
		}

		// update collection data
		if err := json.Unmarshal([]byte(`{
			"indexes": [
				"CREATE INDEX ` + "`" + `idx_eZcjDgn38S` + "`" + ` ON ` + "`" + `conversation_messages` + "`" + ` (\n  ` + "`" + `user` + "`" + `,\n  ` + "`" + `conversation` + "`" + `\n)",
				"CREATE INDEX ` + "`" + `idx_bpJT2J4zo1` + "`" + ` ON ` + "`" + `conversation_messages` + "`" + ` (` + "`" + `conversation` + "`" + `)",
				"CREATE INDEX ` + "`" + `idx_2BwbxAtT9A` + "`" + ` ON ` + "`" + `conversation_messages` + "`" + ` (` + "`" + `user` + "`" + `)"
			]
		}`), &collection); err != nil {
			return err
		}

		// update field
		if err := collection.Fields.AddMarshaledJSONAt(2, []byte(`{
			"cascadeDelete": false,
			"collectionId": "pbc_3709231855",
			"hidden": false,
			"id": "relation3260161009",
			"maxSelect": 1,
			"minSelect": 0,
			"name": "conversation",
			"presentable": false,
			"required": false,
			"system": false,
			"type": "relation"
		}`)); err != nil {
			return err
		}

		return app.Save(collection)
	}, func(app core.App) error {
		collection, err := app.FindCollectionByNameOrId("pbc_37092318552")
		if err != nil {
			return err
		}

		// update collection data
		if err := json.Unmarshal([]byte(`{
			"indexes": [
				"CREATE INDEX ` + "`" + `idx_eZcjDgn38S` + "`" + ` ON ` + "`" + `conversation_messages` + "`" + ` (\n  ` + "`" + `user` + "`" + `,\n  ` + "`" + `conversations` + "`" + `\n)",
				"CREATE INDEX ` + "`" + `idx_bpJT2J4zo1` + "`" + ` ON ` + "`" + `conversation_messages` + "`" + ` (` + "`" + `conversations` + "`" + `)",
				"CREATE INDEX ` + "`" + `idx_2BwbxAtT9A` + "`" + ` ON ` + "`" + `conversation_messages` + "`" + ` (` + "`" + `user` + "`" + `)"
			]
		}`), &collection); err != nil {
			return err
		}

		// update field
		if err := collection.Fields.AddMarshaledJSONAt(2, []byte(`{
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
		}`)); err != nil {
			return err
		}

		return app.Save(collection)
	})
}
