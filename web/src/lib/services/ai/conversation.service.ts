import { AuthorizationService } from '../authorization/authorization.service';
import { PocketBaseService } from '../pocketbase.service';

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
  private readonly pb = PocketBaseService.getInstance().client;
  private readonly pbService = PocketBaseService.getInstance();
  private authService = AuthorizationService.getInstance();

  private constructor() {}

  public static getInstance(): ConversationService {
    if (!ConversationService.instance) {
      ConversationService.instance = new ConversationService();
    }

    return ConversationService.instance;
  }

  private getAuthHeaders(): HeadersInit {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.pb.authStore.token}`
    };
  }

  public async createConversation(request: CreateConversationRequest): Promise<CreateConversationResponse> {
    if (!this.authService.user) {
      throw new Error('User not authenticated');
    }

    const response = await fetch(`${this.pb.baseUrl}/conversations/create`, {
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
    if (!this.authService.user) {
      throw new Error('User not authenticated');
    }

    const response = await fetch(`${this.pb.baseUrl}/conversations/message`, {
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
    if (!this.authService.user) {
      throw new Error('User not authenticated');
    }

    const response = await fetch(`${this.pb.baseUrl}/conversations/edit`, {
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
    if (!this.authService.user) {
      throw new Error('User not authenticated');
    }

    const response = await fetch(`${this.pb.baseUrl}/conversations/${conversationId}`, {
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
    if (!this.authService.user) {
      throw new Error('User not authenticated');
    }

    const url = new URL(`${this.pb.baseUrl}/conversations/`);
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
  public buildMessageHistory(messages: ConversationMessage[]): Array<{ role: 'user' | 'assistant'; content: string }> {
    const history: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    for (const message of messages) {
      if (message.active) {
        history.push({ role: 'user', content: message.user_message });
        history.push({ role: 'assistant', content: message.response_message });
      }
    }

    return history;
  }

  public subscribeToConversations(callback: (conversation: Conversation) => void): () => void {
    if (!this.authService.user) {
      throw new Error('User not authenticated');
    }

    // Subscribe to changes for the current user's conversations with retry
    return this.pbService.subscribeWithRetry('conversations', async (data: any) => {
      if (data.record) {
        try {
          const conversation = await this.getConversation(data.record.id);
          callback(conversation);
        } catch (error) {
          console.error('Error fetching updated conversation:', error);
        }
      }
    }, {
      filter: `user = "${this.authService.user.id}"`
    });
  }
}

export default ConversationService; 