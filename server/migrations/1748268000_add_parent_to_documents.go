package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
	m.Register(func(app core.App) error {
		collection, err := app.FindCollectionByNameOrId("pbc_3332084752")
		if err != nil {
			return err
		}

		// add parent field (self-referencing relation)
		if err := collection.Fields.AddMarshaledJSONAt(5, []byte(`{
			"cascadeDelete": false,
			"collectionId": "pbc_3332084752",
			"hidden": false,
			"id": "relation_parent",
			"maxSelect": 1,
			"minSelect": 0,
			"name": "parent",
			"presentable": false,
			"required": false,
			"system": false,
			"type": "relation"
		}`)); err != nil {
			return err
		}

		// add is_folder field to distinguish folders from documents
		if err := collection.Fields.AddMarshaledJSONAt(6, []byte(`{
			"hidden": false,
			"id": "bool_is_folder",
			"name": "is_folder",
			"presentable": false,
			"required": false,
			"system": false,
			"type": "bool"
		}`)); err != nil {
			return err
		}

		return app.Save(collection)
	}, func(app core.App) error {
		collection, err := app.FindCollectionByNameOrId("pbc_3332084752")
		if err != nil {
			return err
		}

		// remove fields
		collection.Fields.RemoveById("relation_parent")
		collection.Fields.RemoveById("bool_is_folder")

		return app.Save(collection)
	})
}
