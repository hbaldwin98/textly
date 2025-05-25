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
				"CREATE INDEX ` + "`" + `idx_eZcjDgn38S` + "`" + ` ON ` + "`" + `conversation_messages` + "`" + ` (\n  ` + "`" + `user` + "`" + `,\n  ` + "`" + `conversations` + "`" + `\n)",
				"CREATE INDEX ` + "`" + `idx_bpJT2J4zo1` + "`" + ` ON ` + "`" + `conversation_messages` + "`" + ` (` + "`" + `conversations` + "`" + `)",
				"CREATE INDEX ` + "`" + `idx_2BwbxAtT9A` + "`" + ` ON ` + "`" + `conversation_messages` + "`" + ` (` + "`" + `user` + "`" + `)"
			],
			"name": "conversation_messages"
		}`), &collection); err != nil {
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
				"CREATE INDEX ` + "`" + `idx_eZcjDgn38S` + "`" + ` ON ` + "`" + `conversation_message` + "`" + ` (\n  ` + "`" + `user` + "`" + `,\n  ` + "`" + `conversations` + "`" + `\n)",
				"CREATE INDEX ` + "`" + `idx_bpJT2J4zo1` + "`" + ` ON ` + "`" + `conversation_message` + "`" + ` (` + "`" + `conversations` + "`" + `)",
				"CREATE INDEX ` + "`" + `idx_2BwbxAtT9A` + "`" + ` ON ` + "`" + `conversation_message` + "`" + ` (` + "`" + `user` + "`" + `)"
			],
			"name": "conversation_message"
		}`), &collection); err != nil {
			return err
		}

		return app.Save(collection)
	})
}
