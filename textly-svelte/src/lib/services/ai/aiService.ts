import { writable } from 'svelte/store';

export interface SuggestionHistory {
  original: string;
  suggestion: string;
  timestamp: number;
  type: 'improvement' | 'synonyms' | 'description';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface ChatConversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

interface AIState {
  suggestions: string[];
  isLoading: boolean;
  error: string | null;
  history: SuggestionHistory[];
  // Chat state
  currentConversation: ChatConversation | null;
  conversations: ChatConversation[];
  isChatLoading: boolean;
  chatError: string | null;
}

// Store for AI state
export const aiStore = writable<AIState>({
  suggestions: [],
  isLoading: false,
  error: null,
  history: [],
  currentConversation: null,
  conversations: [],
  isChatLoading: false,
  chatError: null
});

class AIService {
  private static instance: AIService;
  private store = aiStore;
  private readonly MAX_HISTORY = 10;
  private readonly MAX_CONVERSATIONS = 20;

  private constructor() {}

  public static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService();
    }
    return AIService.instance;
  }

  private addToHistory(historyItem: SuggestionHistory): void {
    this.store.update(state => ({
      ...state,
      history: [historyItem, ...state.history.slice(0, this.MAX_HISTORY - 1)]
    }));
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  private async makeAIRequest(type: 'improvement' | 'synonyms' | 'description', text: string, context?: string, cursorPosition?: { line: number; column: number }) {
    try {
      this.store.update(state => ({ ...state, isLoading: true, error: null }));

      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type,
          text,
          context,
          cursorPosition
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to get ${type}`);
      }

      const data = await response.json();
      
      this.store.update(state => ({
        ...state,
        suggestions: [data.suggestion],
        isLoading: false
      }));

      // Add to history with the correct type
      const historyItem: SuggestionHistory = {
        original: text,
        suggestion: data.suggestion,
        timestamp: Date.now(),
        type: type // Ensure we're using the passed type parameter
      };
      this.addToHistory(historyItem);

      return data.suggestion;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : `Failed to get ${type}`;
      this.store.update(state => ({
        ...state,
        error: errorMessage,
        isLoading: false,
        suggestions: []
      }));
      throw new Error(errorMessage);
    }
  }

  // Chat methods
  public async sendChatMessage(message: string, conversationId?: string): Promise<void> {
    try {
      this.store.update(state => ({ ...state, isChatLoading: true, chatError: null }));

      // Create user message
      const userMessage: ChatMessage = {
        id: this.generateId(),
        role: 'user',
        content: message,
        timestamp: Date.now()
      };

      // Prepare conversation for API call and update store
      let conversationForAPI: ChatConversation;
      
      // Get current state synchronously and prepare the conversation
      let currentState: AIState;
      const unsubscribe = this.store.subscribe(state => {
        currentState = state;
      });
      unsubscribe();

      let targetConversation: ChatConversation;
      
      if (conversationId) {
        const existing = currentState!.conversations.find(c => c.id === conversationId);
        if (!existing) throw new Error('Conversation not found');
        targetConversation = existing;
      } else if (currentState!.currentConversation) {
        targetConversation = currentState!.currentConversation;
      } else {
        // Create new conversation
        targetConversation = {
          id: this.generateId(),
          title: message.slice(0, 50) + (message.length > 50 ? '...' : ''),
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
      }

      // Add user message to conversation
      conversationForAPI = {
        ...targetConversation,
        messages: [...targetConversation.messages, userMessage],
        updatedAt: Date.now()
      };

      // Update store with user message
      this.store.update(state => {
        // Update conversations array
        const updatedConversations = conversationId || state.conversations.some(c => c.id === conversationForAPI.id)
          ? state.conversations.map(c => c.id === conversationForAPI.id ? conversationForAPI : c)
          : [conversationForAPI, ...state.conversations.slice(0, this.MAX_CONVERSATIONS - 1)];

        return {
          ...state,
          currentConversation: conversationForAPI,
          conversations: updatedConversations
        };
      });

      // Send to API
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          conversationHistory: conversationForAPI.messages.slice(-10) // Send last 10 messages for context
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to send message');
      }

      // Create assistant message with empty content initially
      const assistantMessage: ChatMessage = {
        id: this.generateId(),
        role: 'assistant',
        content: '',
        timestamp: Date.now()
      };

      // Add empty assistant message to conversation
      conversationForAPI = {
        ...conversationForAPI,
        messages: [...conversationForAPI.messages, assistantMessage],
        updatedAt: Date.now()
      };

      // Update store with empty assistant message
      this.store.update(state => {
        const updatedConversations = state.conversations.map(c => 
          c.id === conversationForAPI.id ? conversationForAPI : c
        );

        return {
          ...state,
          currentConversation: state.currentConversation?.id === conversationForAPI.id ? conversationForAPI : state.currentConversation,
          conversations: updatedConversations,
          isChatLoading: false
        };
      });

      // Handle streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = '';

      if (reader) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n').filter(line => line.trim());

            for (const line of lines) {
              try {
                const data = JSON.parse(line);
                if (data.content) {
                  accumulatedContent += data.content;
                  
                  // Update the assistant message content
                  const updatedAssistantMessage = {
                    ...assistantMessage,
                    content: accumulatedContent
                  };

                  // Update conversation with streaming content
                  const updatedConversation = {
                    ...conversationForAPI,
                    messages: [
                      ...conversationForAPI.messages.slice(0, -1),
                      updatedAssistantMessage
                    ],
                    updatedAt: Date.now()
                  };

                  // Update store with streaming content
                  this.store.update(state => {
                    const updatedConversations = state.conversations.map(c => 
                      c.id === updatedConversation.id ? updatedConversation : c
                    );

                    return {
                      ...state,
                      currentConversation: state.currentConversation?.id === updatedConversation.id ? updatedConversation : state.currentConversation,
                      conversations: updatedConversations
                    };
                  });

                  // Update conversationForAPI for next iteration
                  conversationForAPI = updatedConversation;
                } else if (data.done) {
                  break;
                }
              } catch (parseError) {
                console.warn('Failed to parse streaming chunk:', parseError);
              }
            }
          }
        } finally {
          reader.releaseLock();
        }
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
      this.store.update(state => ({
        ...state,
        chatError: errorMessage,
        isChatLoading: false
      }));
      throw new Error(errorMessage);
    }
  }

  public createNewConversation(): void {
    this.store.update(state => ({
      ...state,
      currentConversation: null
    }));
  }

  public loadConversation(conversationId: string): void {
    this.store.update(state => {
      const conversation = state.conversations.find(c => c.id === conversationId);
      return {
        ...state,
        currentConversation: conversation || null
      };
    });
  }

  public deleteConversation(conversationId: string): void {
    this.store.update(state => ({
      ...state,
      conversations: state.conversations.filter(c => c.id !== conversationId),
      currentConversation: state.currentConversation?.id === conversationId ? null : state.currentConversation
    }));
  }

  // Existing methods
  public async getImprovement(text: string, context: string, cursorPosition: { line: number; column: number }): Promise<string> {
    return this.makeAIRequest('improvement', text, context, cursorPosition);
  }

  public async getSynonyms(text: string): Promise<string> {
    return this.makeAIRequest('synonyms', text);
  }

  public async getDescription(text: string): Promise<string> {
    return this.makeAIRequest('description', text);
  }

  public clearError(): void {
    this.store.update(state => ({
      ...state,
      error: null
    }));
  }

  public clearChatError(): void {
    this.store.update(state => ({
      ...state,
      chatError: null
    }));
  }

  public clearSuggestions(): void {
    this.store.update(state => ({
      ...state,
      suggestions: []
    }));
  }

  public getStore() {
    return this.store;
  }
}

export const aiService = AIService.getInstance(); 