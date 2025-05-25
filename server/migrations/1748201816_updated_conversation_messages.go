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
				"CREATE INDEX ` + "`" + `idx_2BwbxAtT9A` + "`" + ` ON ` + "`" + `conversation_messages` + "`" + ` (` + "`" + `user` + "`" + `)",
				"CREATE INDEX ` + "`" + `idx_mz5RzYTmpj` + "`" + ` ON ` + "`" + `conversation_messages` + "`" + ` (\n  ` + "`" + `user` + "`" + `,\n  ` + "`" + `active` + "`" + `\n)",
				"CREATE INDEX ` + "`" + `idx_XA3f0LY2pL` + "`" + ` ON ` + "`" + `conversation_messages` + "`" + ` (\n  ` + "`" + `conversation` + "`" + `,\n  ` + "`" + `active` + "`" + `\n)"
			]
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
				"CREATE INDEX ` + "`" + `idx_eZcjDgn38S` + "`" + ` ON ` + "`" + `conversation_messages` + "`" + ` (\n  ` + "`" + `user` + "`" + `,\n  ` + "`" + `conversation` + "`" + `\n)",
				"CREATE INDEX ` + "`" + `idx_bpJT2J4zo1` + "`" + ` ON ` + "`" + `conversation_messages` + "`" + ` (` + "`" + `conversation` + "`" + `)",
				"CREATE INDEX ` + "`" + `idx_2BwbxAtT9A` + "`" + ` ON ` + "`" + `conversation_messages` + "`" + ` (` + "`" + `user` + "`" + `)"
			]
		}`), &collection); err != nil {
			return err
		}

		return app.Save(collection)
	})
}
