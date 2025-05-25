import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import { derived } from 'svelte/store';

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

// Local storage key
const AI_STATE_KEY = 'textly-ai-state';

// Throttle localStorage saves to avoid excessive writes
let saveTimeout: NodeJS.Timeout | null = null;
const SAVE_DELAY = 500; // 500ms delay

// Function to load state from localStorage
function loadStateFromStorage(): Partial<AIState> {
  if (!browser) return {};
  
  try {
    const stored = localStorage.getItem(AI_STATE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Only restore persistent data, not loading states or errors
      return {
        history: parsed.history || [],
        conversations: parsed.conversations || [],
        currentConversation: parsed.currentConversation || null,
      };
    }
  } catch (error) {
    console.warn('Failed to load AI state from localStorage:', error);
  }
  
  return {};
}

// Function to save state to localStorage
function saveStateToStorage(state: AIState): void {
  if (!browser) return;
  
  // Clear existing timeout
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }
  
  // Set new timeout for throttled save
  saveTimeout = setTimeout(() => {
    try {
      // Only save persistent data, not loading states or errors
      const persistentState = {
        history: state.history,
        conversations: state.conversations,
        currentConversation: state.currentConversation,
      };
      localStorage.setItem(AI_STATE_KEY, JSON.stringify(persistentState));
    } catch (error) {
      console.warn('Failed to save AI state to localStorage:', error);
    }
  }, SAVE_DELAY);
}

// Initialize store with default values and loaded state
const defaultState: AIState = {
  suggestions: [],
  isLoading: false,
  error: null,
  history: [],
  currentConversation: null,
  conversations: [],
  isChatLoading: false,
  chatError: null
};

const loadedState = loadStateFromStorage();
const initialState = { ...defaultState, ...loadedState };

// Store for AI state
export const aiStore = writable<AIState>(initialState);

// Subscribe to store changes and save to localStorage
if (browser) {
  aiStore.subscribe((state) => {
    saveStateToStorage(state);
  });
}

// Derived store for storage statistics
export const storageStats = derived(aiStore, ($aiStore) => {
  let storageSize = '0 KB';
  
  if (browser) {
    try {
      const persistentState = {
        history: $aiStore.history,
        conversations: $aiStore.conversations,
        currentConversation: $aiStore.currentConversation,
      };
      const jsonString = JSON.stringify(persistentState);
      const sizeInBytes = new Blob([jsonString]).size;
      
      storageSize = sizeInBytes < 1024 
        ? `${sizeInBytes} B`
        : sizeInBytes < 1024 * 1024
        ? `${(sizeInBytes / 1024).toFixed(1)} KB`
        : `${(sizeInBytes / (1024 * 1024)).toFixed(1)} MB`;
    } catch (error) {
      console.warn('Failed to calculate storage size:', error);
    }
  }
  
  return {
    conversations: $aiStore.conversations.length,
    history: $aiStore.history.length,
    storageSize
  };
});

class AIService {
  private static instance: AIService;
  private store = aiStore;
  private readonly MAX_HISTORY = 10;
  private readonly MAX_CONVERSATIONS = 20;
  private currentAbortController: AbortController | null = null;

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
      // Create a new abort controller for this request
      this.currentAbortController = new AbortController();
      const signal = this.currentAbortController.signal;
      
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
        signal // Add the abort signal to the fetch request
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
          isChatLoading: true // Keep loading state true during streaming
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
                  
                  // Debug: Log accumulated content to see if it contains newlines
                  if (accumulatedContent.includes('\n')) {
                    console.log('Accumulated content has newlines:', JSON.stringify(accumulatedContent));
                  }
                  
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
                      conversations: updatedConversations,
                      isChatLoading: true // Keep loading state true during streaming
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
          // Clear the abort controller and set loading to false when done
          this.currentAbortController = null;
          this.store.update(state => ({
            ...state,
            isChatLoading: false
          }));
        }
      }

    } catch (err) {
      // Check if the error is from an abort
      if (err instanceof DOMException && err.name === 'AbortError') {
        console.log('Chat request was aborted');
        return;
      }
      
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

  public editMessage(conversationId: string, messageId: string, newContent: string): void {
    this.store.update(state => {
      const conversation = state.conversations.find(c => c.id === conversationId);
      if (!conversation) return state;

      // Find the index of the message to edit
      const messageIndex = conversation.messages.findIndex(m => m.id === messageId);
      if (messageIndex === -1) return state;

      // Create updated conversation with edited message and removed subsequent messages
      const updatedConversation = {
        ...conversation,
        messages: [
          ...conversation.messages.slice(0, messageIndex),
          {
            ...conversation.messages[messageIndex],
            content: newContent
          }
        ],
        updatedAt: Date.now()
      };

      // Update conversations array
      const updatedConversations = state.conversations.map(c => 
        c.id === conversationId ? updatedConversation : c
      );

      return {
        ...state,
        currentConversation: state.currentConversation?.id === conversationId ? updatedConversation : state.currentConversation,
        conversations: updatedConversations
      };
    });
  }

  public async editChatMessage(conversationId: string, messageId: string, newContent: string): Promise<void> {
    try {
      // Create a new abort controller for this request
      this.currentAbortController = new AbortController();
      const signal = this.currentAbortController.signal;
      
      this.store.update(state => ({ ...state, isChatLoading: true, chatError: null }));

      // Get current state synchronously
      let currentState: AIState;
      const unsubscribe = this.store.subscribe(state => {
        currentState = state;
      });
      unsubscribe();

      const conversation = currentState!.conversations.find(c => c.id === conversationId);
      if (!conversation) throw new Error('Conversation not found');

      // Find the index of the message to edit
      const messageIndex = conversation.messages.findIndex(m => m.id === messageId);
      if (messageIndex === -1) throw new Error('Message not found');

      // Keep only messages up to the edited message
      const updatedMessages = conversation.messages.slice(0, messageIndex);

      // Create updated conversation
      const updatedConversation = {
        ...conversation,
        messages: updatedMessages,
        updatedAt: Date.now()
      };

      // Update store with removed messages
      this.store.update(state => {
        const updatedConversations = state.conversations.map(c => 
          c.id === conversationId ? updatedConversation : c
        );

        return {
          ...state,
          currentConversation: state.currentConversation?.id === conversationId ? updatedConversation : state.currentConversation,
          conversations: updatedConversations
        };
      });

      // Send the edited message as a new message
      await this.sendChatMessage(newContent, conversationId);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to edit message';
      this.store.update(state => ({
        ...state,
        chatError: errorMessage,
        isChatLoading: false
      }));
      throw new Error(errorMessage);
    }
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

  // Storage management methods
  public clearStoredData(): void {
    if (browser) {
      localStorage.removeItem(AI_STATE_KEY);
    }
    
    // Reset store to default state
    this.store.set({
      suggestions: [],
      isLoading: false,
      error: null,
      history: [],
      currentConversation: null,
      conversations: [],
      isChatLoading: false,
      chatError: null
    });
  }

  public exportData(): string | null {
    if (!browser) return null;
    
    try {
      const stored = localStorage.getItem(AI_STATE_KEY);
      return stored;
    } catch (error) {
      console.warn('Failed to export AI data:', error);
      return null;
    }
  }

  public importData(data: string): boolean {
    if (!browser) return false;
    
    try {
      const parsed = JSON.parse(data);
      
      // Validate the data structure
      if (parsed && typeof parsed === 'object') {
        const validatedState = {
          history: Array.isArray(parsed.history) ? parsed.history.slice(0, this.MAX_HISTORY) : [],
          conversations: Array.isArray(parsed.conversations) ? parsed.conversations.slice(0, this.MAX_CONVERSATIONS) : [],
          currentConversation: parsed.currentConversation || null,
        };
        
        localStorage.setItem(AI_STATE_KEY, JSON.stringify(validatedState));
        
        // Update the store
        this.store.update(state => ({
          ...state,
          ...validatedState
        }));
        
        return true;
      }
    } catch (error) {
      console.warn('Failed to import AI data:', error);
    }
    
    return false;
  }

  // Method to stop the current conversation
  public stopCurrentConversation(): void {
    if (this.currentAbortController) {
      this.currentAbortController.abort();
      this.currentAbortController = null;
      
      // Update store to reflect stopped state
      this.store.update(state => ({
        ...state,
        isChatLoading: false,
        chatError: 'Conversation stopped by user'
      }));
    }
  }

}

export const aiService = AIService.getInstance(); 