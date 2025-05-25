package queries

import (
	"database/sql"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"
)

// Conversation queries

func CreateConversation(e *core.RequestEvent, conversation *Conversation) (*Conversation, error) {
	collection, err := e.App.FindCollectionByNameOrId("conversations")
	if err != nil {
		return nil, err
	}

	record := core.NewRecord(collection)
	record.Set("user", conversation.UserId)
	record.Set("title", conversation.Title)
	record.Set("total_requests", conversation.TotalRequests)
	record.Set("input_tokens", conversation.InputTokens)
	record.Set("output_tokens", conversation.OutputTokens)
	record.Set("cost", conversation.Cost)
	record.Set("created", conversation.Created)
	record.Set("updated", conversation.Updated)

	if err := e.App.Save(record); err != nil {
		return nil, err
	}

	return &Conversation{
		Id:            record.Id,
		UserId:        conversation.UserId,
		Title:         conversation.Title,
		TotalRequests: conversation.TotalRequests,
		InputTokens:   conversation.InputTokens,
		OutputTokens:  conversation.OutputTokens,
		Cost:          conversation.Cost,
		Created:       conversation.Created,
		Updated:       conversation.Updated,
	}, nil
}

func GetConversationById(e *core.RequestEvent, id string) (*Conversation, error) {
	query := e.App.DB().Select("id", "user", "title", "total_requests", "input_tokens", "output_tokens", "cost", "created", "updated").From("conversations").Where(dbx.HashExp{"id": id})

	var conversation Conversation
	if err := query.One(&conversation); err != nil {
		return nil, err
	}

	return &conversation, nil
}

func GetConversationsByUserId(e *core.RequestEvent, userId string) ([]*Conversation, error) {
	query := e.App.DB().Select("id", "user", "title", "total_requests", "input_tokens", "output_tokens", "cost", "created", "updated").
		From("conversations").
		Where(dbx.HashExp{"user": userId}).
		OrderBy("created DESC")

	var conversations []*Conversation
	if err := query.All(&conversations); err != nil {
		return nil, err
	}

	return conversations, nil
}

func UpdateConversation(e *core.RequestEvent, fields map[string]interface{}, where dbx.Expression) (sql.Result, error) {
	query := e.App.DB().Update("conversations", fields, where)
	return query.Execute()
}

func DeleteConversation(e *core.RequestEvent, id string) (sql.Result, error) {
	query := e.App.DB().Delete("conversations", dbx.HashExp{"id": id})
	return query.Execute()
}

// ConversationMessage queries

func CreateConversationMessage(e *core.RequestEvent, message *ConversationMessage) (*ConversationMessage, error) {
	collection, err := e.App.FindCollectionByNameOrId("conversation_messages")
	if err != nil {
		return nil, err
	}

	record := core.NewRecord(collection)
	record.Set("user", message.UserId)
	record.Set("conversation", message.ConversationId)
	record.Set("user_message", message.UserMessage)
	record.Set("response_message", message.ResponseMessage)
	record.Set("input_tokens", message.InputTokens)
	record.Set("output_tokens", message.OutputTokens)
	record.Set("cost", message.Cost)
	record.Set("active", message.Active)
	record.Set("created", message.Created)

	if err := e.App.Save(record); err != nil {
		return nil, err
	}

	return &ConversationMessage{
		Id:              record.Id,
		UserId:          message.UserId,
		ConversationId:  message.ConversationId,
		UserMessage:     message.UserMessage,
		ResponseMessage: message.ResponseMessage,
		InputTokens:     message.InputTokens,
		OutputTokens:    message.OutputTokens,
		Cost:            message.Cost,
		Active:          message.Active,
		Created:         message.Created,
	}, nil
}

func GetConversationMessageById(e *core.RequestEvent, id string) (*ConversationMessage, error) {
	query := e.App.DB().Select("id", "user", "conversations", "user_message", "response_message", "input_tokens", "output_tokens", "cost", "active", "created").
		From("conversation_messages").
		Where(dbx.HashExp{"id": id})

	var message ConversationMessage
	if err := query.One(&message); err != nil {
		return nil, err
	}

	return &message, nil
}

func GetConversationMessagesByConversationId(e *core.RequestEvent, conversationId string) ([]*ConversationMessage, error) {
	query := e.App.DB().Select("id", "user", "conversations", "user_message", "response_message", "input_tokens", "output_tokens", "cost", "active", "created").
		From("conversation_messages").
		Where(dbx.HashExp{"conversations": conversationId}).
		OrderBy("created ASC")

	var messages []*ConversationMessage
	if err := query.All(&messages); err != nil {
		return nil, err
	}

	return messages, nil
}

func GetConversationMessagesByUserId(e *core.RequestEvent, userId string) ([]*ConversationMessage, error) {
	query := e.App.DB().Select("id", "user", "conversations", "user_message", "response_message", "input_tokens", "output_tokens", "cost", "active", "created").
		From("conversation_messages").
		Where(dbx.HashExp{"user": userId}).
		OrderBy("created DESC")

	var messages []*ConversationMessage
	if err := query.All(&messages); err != nil {
		return nil, err
	}

	return messages, nil
}

func GetActiveConversationMessagesByConversationId(e *core.RequestEvent, conversationId string) ([]*ConversationMessage, error) {
	query := e.App.DB().Select("id", "user", "conversations", "user_message", "response_message", "input_tokens", "output_tokens", "cost", "active", "created").
		From("conversation_messages").
		Where(dbx.HashExp{"conversations": conversationId, "active": true}).
		OrderBy("created ASC")

	var messages []*ConversationMessage
	if err := query.All(&messages); err != nil {
		return nil, err
	}

	return messages, nil
}

func UpdateConversationMessage(e *core.RequestEvent, fields map[string]interface{}, where dbx.Expression) (sql.Result, error) {
	query := e.App.DB().Update("conversation_messages", fields, where)
	return query.Execute()
}

func DeleteConversationMessage(e *core.RequestEvent, id string) (sql.Result, error) {
	query := e.App.DB().Delete("conversation_messages", dbx.HashExp{"id": id})
	return query.Execute()
}

func DeleteConversationMessagesByConversationId(e *core.RequestEvent, conversationId string) (sql.Result, error) {
	query := e.App.DB().Delete("conversation_messages", dbx.HashExp{"conversations": conversationId})
	return query.Execute()
}
