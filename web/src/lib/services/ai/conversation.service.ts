import { AuthorizationService } from '../authorization/authorization.service';

export interface ConversationMessage {
  id: string;
  user_message: string;
  response_message: string;
  thinking_content?: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  reasoning_tokens?: number;
  cost: number;
  active: boolean;
  created: string;
}

export interface Conversation {
  id: string;
  title: string;
  type: string;
  total_requests: number;
  input_tokens: number;
  output_tokens: number;
  cost: number;
  messages: ConversationMessage[];
  created: string;
  updated: string;
}

export interface CreateConversationRequest {
  message: string;
  title?: string;
}

export interface CreateConversationResponse {
  conversation_id: string;
  message_id: string;
  response: string;
}

export interface AddMessageRequest {
  conversation_id: string;
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
}

export interface AddMessageResponse {
  message_id: string;
  response: string;
}

export interface EditMessageRequest {
  conversation_id: string;
  message_id: string;
  new_message: string;
}

class ConversationService {
  private static instance: ConversationService;
  private baseUrl: string;

  private constructor() {
    this.baseUrl = import.meta.env.VITE_POCKETBASE_URL || 'http://localhost:8080';
  }

  public static getInstance(): ConversationService {
    if (!ConversationService.instance) {
      ConversationService.instance = new ConversationService();
    }
    return ConversationService.instance;
  }

  private getAuthHeaders(): HeadersInit {
    const token = AuthorizationService.getInstance().token;
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  }

  public async createConversation(request: CreateConversationRequest): Promise<CreateConversationResponse> {
    const response = await fetch(`${this.baseUrl}/conversations/create`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Failed to create conversation');
    }

    return response.json();
  }

  public async addMessage(request: AddMessageRequest): Promise<AddMessageResponse> {
    const response = await fetch(`${this.baseUrl}/conversations/message`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Failed to add message');
    }

    return response.json();
  }

  public async editMessage(request: EditMessageRequest): Promise<AddMessageResponse> {
    const response = await fetch(`${this.baseUrl}/conversations/edit`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Failed to edit message');
    }

    return response.json();
  }

  public async getConversation(conversationId: string): Promise<Conversation> {
    const response = await fetch(`${this.baseUrl}/conversations/${conversationId}`, {
      method: 'GET',
      headers: this.getAuthHeaders()
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Failed to get conversation');
    }

    return response.json();
  }

  public async getConversations(type?: string, includeMessages?: boolean): Promise<Conversation[]> {
    const url = new URL(`${this.baseUrl}/conversations/`);
    if (type) {
      url.searchParams.append('type', type);
    }

    if (includeMessages) {
      url.searchParams.append('include_messages', 'true');
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: this.getAuthHeaders()
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Failed to get conversations');
    }

    return response.json();
  }

  // Helper method to build message history for API calls
  public buildMessageHistory(messages: ConversationMessage[]): Array<{role: 'user' | 'assistant'; content: string}> {
    const history: Array<{role: 'user' | 'assistant'; content: string}> = [];
    
    for (const message of messages) {
      if (message.active) {
        history.push({ role: 'user', content: message.user_message });
        history.push({ role: 'assistant', content: message.response_message });
      }
    }
    
    return history;
  }
}

export default ConversationService; 