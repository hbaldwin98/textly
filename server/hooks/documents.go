package hooks

import (
	"fmt"
	"textly/queries"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
)

func PreventCircularReference(app core.App, record *core.Record) error {
	// If parent field isn't in the request, skip the check
	if _, ok := record.FieldsData()["parent"]; !ok {
		return nil
	}

	parentID := record.Get("parent")
	if parentID == "" {
		return nil // No parent, no circular reference
	}

	// Get the current record ID
	currentID := record.Id

	// We're creating a new record, so we don't need to check for circular references
	if currentID == "" {
		return nil
	}

	visited := make(map[string]bool)
	currentParentID := parentID.(string)

	for currentParentID != "" {
		if currentParentID == currentID {
			return fmt.Errorf("circular reference detected: item cannot reference itself")
		}

		if visited[currentParentID] {
			return fmt.Errorf("circular reference detected in parent chain")
		}

		visited[currentParentID] = true

		query := app.DB().Select("id", "parent").From("documents").Where(dbx.HashExp{"id": currentParentID})
		var parentRecord queries.Document
		if err := query.One(&parentRecord); err != nil {
			return fmt.Errorf("failed to fetch parent: %v", err)
		}

		if parentRecord.Id == "" {
			return nil
		}

		currentParentID = parentRecord.Parent
	}

	return nil
}
