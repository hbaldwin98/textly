package queries

type Conversation struct {
	Id              string                `db:"id"`
	UserId          string                `db:"user"`
	Title           string                `db:"title"`
	Type            string                `db:"type"`
	TotalRequests   string                `db:"total_requests"`
	InputTokens     string                `db:"input_tokens"`
	OutputTokens    string                `db:"output_tokens"`
	ReasoningTokens string                `db:"reasoning_tokens"`
	Cost            string                `db:"cost"`
	Active          bool                  `db:"active"`
	Created         string                `db:"created"`
	Updated         string                `db:"updated"`
	Messages        []ConversationMessage `db:"-"`
}

type ConversationMessage struct {
	Id              string `db:"id"`
	UserId          string `db:"user"`
	ConversationId  string `db:"conversation"`
	UserMessage     string `db:"user_message"`
	ResponseMessage string `db:"response_message"`
	ThinkingContent string `db:"thinking_content"`
	Model           string `db:"model"`
	InputTokens     string `db:"input_tokens"`
	OutputTokens    string `db:"output_tokens"`
	ReasoningTokens string `db:"reasoning_tokens"`
	Cost            string `db:"cost"`
	Active          bool   `db:"active"`
	Created         string `db:"created"`
}

type Document struct {
	Id       string `db:"id"`
	Parent   string `db:"parent"`
	IsFolder bool   `db:"is_folder"`
	Created  string `db:"created"`
	Updated  string `db:"updated"`
}
