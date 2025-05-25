import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';
import { AuthorizationService } from '../authorization/authorization.service';
import ConversationService, { type Conversation } from './conversation.service';

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
  // Quick Actions conversations from API
  improvementConversations: Conversation[];
  synonymsConversations: Conversation[];
  descriptionConversations: Conversation[];
  isLoadingQuickActions: boolean;
  quickActionsError: string | null;
}

// Initialize store with default values
const defaultState: AIState = {
  suggestions: [],
  isLoading: false,
  error: null,
  history: [],
  currentConversation: null,
  conversations: [],
  isChatLoading: false,
  chatError: null,
  improvementConversations: [],
  synonymsConversations: [],
  descriptionConversations: [],
  isLoadingQuickActions: false,
  quickActionsError: null
};

// Store for AI state
export const aiStore = writable<AIState>(defaultState);

// Note: storageStats removed as we no longer use localStorage

class AIService {
  private static instance: AIService;
  private store = aiStore;
  private readonly MAX_HISTORY = 10;
  private readonly MAX_CONVERSATIONS = 20;
  private currentAbortController: AbortController | null = null;
  private conversationService = ConversationService.getInstance();

  private constructor() { }

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

  // Load Quick Actions conversations from API
  public async loadQuickActionsConversations(): Promise<void> {
    this.store.update(state => ({ ...state, isLoadingQuickActions: true, quickActionsError: null }));

    try {
      const [improvementConversations, synonymsConversations, descriptionConversations] = await Promise.all([
        this.conversationService.getConversations('improvement', true),
        this.conversationService.getConversations('synonyms', true),
        this.conversationService.getConversations('description', true)
      ]);

      this.store.update(state => ({
        ...state,
        improvementConversations,
        synonymsConversations,
        descriptionConversations,
        isLoadingQuickActions: false
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load Quick Actions conversations';
      this.store.update(state => ({
        ...state,
        quickActionsError: errorMessage,
        isLoadingQuickActions: false
      }));
    }
  }

  private async makeAIRequest(type: 'improvement' | 'synonyms' | 'description', text: string, context?: string) {
    try {
      this.store.update(state => ({ ...state, isLoading: true, error: null }));

      const response = await fetch(`${import.meta.env.VITE_POCKETBASE_URL || 'http://localhost:8080'}/ai/assist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AuthorizationService.getInstance().token}`
        },
        body: JSON.stringify({
          type,
          text,
          context
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
        type: type
      };
      this.addToHistory(historyItem);

      // Reload the appropriate conversations list since ai/assist creates persistent conversations
      await this.loadQuickActionsConversations();

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

      // Get current state
      let currentState: AIState;
      const unsubscribe = this.store.subscribe(state => {
        currentState = state;
      });
      unsubscribe();

      let targetConversation: ChatConversation;
      let isNewConversation = false;
      let endpoint = '';
      let requestBody: any = {};

      if (conversationId) {
        const existing = currentState!.conversations.find(c => c.id === conversationId);
        if (!existing) throw new Error('Conversation not found');
        targetConversation = existing;
        endpoint = '/conversations/continue';
        requestBody = {
          conversation_id: conversationId,
          message: message
        };
      } else if (currentState!.currentConversation) {
        targetConversation = currentState!.currentConversation;
        endpoint = '/conversations/continue';
        requestBody = {
          conversation_id: targetConversation.id,
          message: message
        };
      } else {
        // This will be a new conversation
        isNewConversation = true;
        targetConversation = {
          id: this.generateId(), // Temporary ID
          title: message.slice(0, 50) + (message.length > 50 ? '...' : ''),
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        endpoint = '/conversations/start';
        requestBody = {
          message: message,
          title: targetConversation.title
        };
      }

      // Create user message for UI
      const userMessage: ChatMessage = {
        id: this.generateId(),
        role: 'user',
        content: message,
        timestamp: Date.now()
      };

      // Update UI immediately with user message
      let conversationForUI = {
        ...targetConversation,
        messages: [...targetConversation.messages, userMessage],
        updatedAt: Date.now()
      };

      this.store.update(state => {
        const updatedConversations = isNewConversation
          ? [conversationForUI, ...state.conversations.slice(0, this.MAX_CONVERSATIONS - 1)]
          : state.conversations.map(c => c.id === conversationForUI.id ? conversationForUI : c);

        return {
          ...state,
          currentConversation: conversationForUI,
          conversations: updatedConversations
        };
      });

      // Use streaming conversation endpoint
      const response = await fetch(`${import.meta.env.VITE_POCKETBASE_URL || 'http://localhost:8080'}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AuthorizationService.getInstance().token}`
        },
        body: JSON.stringify(requestBody),
        signal
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
      conversationForUI = {
        ...conversationForUI,
        messages: [...conversationForUI.messages, assistantMessage],
        updatedAt: Date.now()
      };

      // Update store with empty assistant message
      this.store.update(state => {
        const updatedConversations = state.conversations.map(c =>
          c.id === conversationForUI.id ? conversationForUI : c
        );

        return {
          ...state,
          currentConversation: state.currentConversation?.id === conversationForUI.id ? conversationForUI : state.currentConversation,
          conversations: updatedConversations,
          isChatLoading: true // Keep loading state true during streaming
        };
      });

      // Handle SSE streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = '';
      let buffer = '';
      let realConversationId = targetConversation.id;
      let realMessageId: string | null = null;

      if (reader) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            buffer += chunk;
            
            // Process complete SSE events (separated by \n\n)
            let eventEndIndex;
            while ((eventEndIndex = buffer.indexOf('\n\n')) !== -1) {
              const eventData = buffer.slice(0, eventEndIndex);
              buffer = buffer.slice(eventEndIndex + 2);
              
              if (eventData.trim()) {
                // Parse SSE event
                const lines = eventData.split('\n');
                for (const line of lines) {
                  if (line.startsWith('data: ')) {
                    const data = line.slice(6); // Remove 'data: ' prefix
                    
                    if (data === '[DONE]') {
                      // Stream is complete
                      break;
                    } else if (data.startsWith('{') && data.includes('conversation_id')) {
                      // This is the conversation ID event for new conversations
                      try {
                        const parsed = JSON.parse(data);
                        if (parsed.conversation_id && isNewConversation) {
                          realConversationId = parsed.conversation_id;
                          // Update the conversation ID in the store
                          this.store.update(state => {
                            const updatedConversations = state.conversations.map(c => 
                              c.id === conversationForUI.id ? { ...c, id: realConversationId } : c
                            );
                            const updatedCurrentConversation = state.currentConversation?.id === conversationForUI.id 
                              ? { ...state.currentConversation, id: realConversationId }
                              : state.currentConversation;

                            return {
                              ...state,
                              currentConversation: updatedCurrentConversation,
                              conversations: updatedConversations
                            };
                          });
                          conversationForUI.id = realConversationId;
                        }
                      } catch (e) {
                        console.warn('Failed to parse conversation ID event:', e);
                      }
                    } else if (data.startsWith('{') && data.includes('message_id')) {
                      // This is the message ID event
                      try {
                        const parsed = JSON.parse(data);
                        if (parsed.message_id) {
                          realMessageId = parsed.message_id;
                          // Update the user message ID with the real database ID
                          this.store.update(state => {
                            const updatedConversations = state.conversations.map(c => {
                              if (c.id === conversationForUI.id) {
                                const updatedMessages = c.messages.map(m => {
                                  if (m.id === userMessage.id) {
                                    return { ...m, id: realMessageId as string };
                                  }
                                  return m;
                                });
                                return { ...c, messages: updatedMessages };
                              }
                              return c;
                            });

                            const updatedCurrentConversation = state.currentConversation?.id === conversationForUI.id
                              ? updatedConversations.find(c => c.id === conversationForUI.id) || state.currentConversation
                              : state.currentConversation;

                            return {
                              ...state,
                              currentConversation: updatedCurrentConversation,
                              conversations: updatedConversations
                            };
                          });
                          
                          // Update conversationForUI to reflect the new message ID
                          conversationForUI = {
                            ...conversationForUI,
                            messages: conversationForUI.messages.map(m => 
                              m.id === userMessage.id ? { ...m, id: realMessageId as string } : m
                            )
                          };
                          
                          // Update userMessage reference for assistant message ID
                          userMessage.id = realMessageId as string;
                        }
                      } catch (e) {
                        console.warn('Failed to parse message ID event:', e);
                      }
                    } else {
                      // Unescape newlines and add content to accumulated content
                      const unescapedData = data.replace(/\\n/g, '\n');
                      accumulatedContent += unescapedData;

                      // Update the assistant message content
                      const updatedAssistantMessage = {
                        ...assistantMessage,
                        content: accumulatedContent
                      };

                      // Update conversation with streaming content
                      const updatedConversation = {
                        ...conversationForUI,
                        messages: [
                          ...conversationForUI.messages.slice(0, -1),
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
                          isChatLoading: true,
                        };
                      });

                      // Update conversationForUI for next iteration
                      conversationForUI = updatedConversation;
                    }
                  }
                }
              }
            }
          }
        } finally {
          reader.releaseLock();
          // Clear the abort controller and set loading to false when done
          this.currentAbortController = null;
          
          // Update assistant message ID to use database-derived ID if we have the real message ID
          if (realMessageId) {
            const assistantMessageId = realMessageId + '_assistant';
            this.store.update(state => {
              const updatedConversations = state.conversations.map(c => {
                if (c.id === conversationForUI.id) {
                  const updatedMessages = c.messages.map(m => {
                    if (m.id === assistantMessage.id) {
                      return { ...m, id: assistantMessageId };
                    }
                    return m;
                  });
                  return { ...c, messages: updatedMessages };
                }
                return c;
              });

              const updatedCurrentConversation = state.currentConversation?.id === conversationForUI.id
                ? updatedConversations.find(c => c.id === conversationForUI.id) || state.currentConversation
                : state.currentConversation;

              return {
                ...state,
                currentConversation: updatedCurrentConversation,
                conversations: updatedConversations,
                isChatLoading: false
              };
            });
          } else {
            this.store.update(state => ({
              ...state,
              isChatLoading: false
            }));
          }
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

      // Find the message to edit
      const messageToEdit = conversation.messages.find(m => m.id === messageId);
      if (!messageToEdit) throw new Error('Message not found');
      
      // Only allow editing user messages
      if (messageToEdit.role !== 'user') throw new Error('Can only edit user messages');

      // Find the index of the message to edit
      const messageIndex = conversation.messages.findIndex(m => m.id === messageId);
      if (messageIndex === -1) throw new Error('Message not found');
      
      // Extract the actual database message ID (remove '_assistant' suffix if present)
      const databaseMessageId = messageId.endsWith('_assistant') ? messageId.replace('_assistant', '') : messageId;

      // Create updated conversation with edited message (remove subsequent messages)
      const editedMessage = {
        ...messageToEdit,
        content: newContent,
        timestamp: Date.now()
      };

      let conversationForUI = {
        ...conversation,
        messages: [
          ...conversation.messages.slice(0, messageIndex),
          editedMessage
        ],
        updatedAt: Date.now()
      };

      // Update store immediately with edited message
      this.store.update(state => {
        const updatedConversations = state.conversations.map(c =>
          c.id === conversationId ? conversationForUI : c
        );

        return {
          ...state,
          currentConversation: state.currentConversation?.id === conversationId ? conversationForUI : state.currentConversation,
          conversations: updatedConversations
        };
      });

      // Use streaming edit endpoint
      const response = await fetch(`${import.meta.env.VITE_POCKETBASE_URL || 'http://localhost:8080'}/conversations/edit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AuthorizationService.getInstance().token}`
        },
        body: JSON.stringify({
          conversation_id: conversationId,
          message_id: databaseMessageId,
          new_message: newContent
        }),
        signal
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to edit message');
      }

      // Create assistant message with empty content initially
      const assistantMessage: ChatMessage = {
        id: this.generateId(),
        role: 'assistant',
        content: '',
        timestamp: Date.now()
      };

      // Add empty assistant message to conversation
      conversationForUI = {
        ...conversationForUI,
        messages: [...conversationForUI.messages, assistantMessage],
        updatedAt: Date.now()
      };

      // Update store with empty assistant message
      this.store.update(state => {
        const updatedConversations = state.conversations.map(c =>
          c.id === conversationForUI.id ? conversationForUI : c
        );

        return {
          ...state,
          currentConversation: state.currentConversation?.id === conversationForUI.id ? conversationForUI : state.currentConversation,
          conversations: updatedConversations,
          isChatLoading: true
        };
      });

      // Handle SSE streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = '';
      let buffer = '';
      let realMessageId: string | null = null;

      if (reader) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            buffer += chunk;
            
            // Process complete SSE events (separated by \n\n)
            let eventEndIndex;
            while ((eventEndIndex = buffer.indexOf('\n\n')) !== -1) {
              const eventData = buffer.slice(0, eventEndIndex);
              buffer = buffer.slice(eventEndIndex + 2);
              
              if (eventData.trim()) {
                // Parse SSE event
                const lines = eventData.split('\n');
                for (const line of lines) {
                  if (line.startsWith('data: ')) {
                    const data = line.slice(6); // Remove 'data: ' prefix
                    
                    if (data === '[DONE]') {
                      // Stream is complete
                      break;
                    } else if (data.startsWith('{') && data.includes('message_id')) {
                      // This is the message ID event
                      try {
                        const parsed = JSON.parse(data);
                        if (parsed.message_id) {
                          realMessageId = parsed.message_id;
                          // Update the edited user message ID with the real database ID
                          this.store.update(state => {
                            const updatedConversations = state.conversations.map(c => {
                              if (c.id === conversationForUI.id) {
                                const updatedMessages = c.messages.map(m => {
                                  if (m.id === editedMessage.id) {
                                    return { ...m, id: realMessageId as string };
                                  }
                                  return m;
                                });
                                return { ...c, messages: updatedMessages };
                              }
                              return c;
                            });

                            const updatedCurrentConversation = state.currentConversation?.id === conversationForUI.id
                              ? updatedConversations.find(c => c.id === conversationForUI.id) || state.currentConversation
                              : state.currentConversation;

                            return {
                              ...state,
                              currentConversation: updatedCurrentConversation,
                              conversations: updatedConversations
                            };
                          });
                          
                          // Update conversationForUI to reflect the new message ID
                          conversationForUI = {
                            ...conversationForUI,
                            messages: conversationForUI.messages.map(m => 
                              m.id === editedMessage.id ? { ...m, id: realMessageId as string } : m
                            )
                          };
                          
                          // Update editedMessage reference
                          editedMessage.id = realMessageId as string;
                        }
                      } catch (e) {
                        console.warn('Failed to parse message ID event:', e);
                      }
                    } else {
                      // Unescape newlines and add content to accumulated content
                      const unescapedData = data.replace(/\\n/g, '\n');
                      accumulatedContent += unescapedData;

                      // Update the assistant message content
                      const updatedAssistantMessage = {
                        ...assistantMessage,
                        content: accumulatedContent
                      };

                      // Update conversation with streaming content
                      const updatedConversation = {
                        ...conversationForUI,
                        messages: [
                          ...conversationForUI.messages.slice(0, -1),
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
                          isChatLoading: true,
                        };
                      });

                      // Update conversationForUI for next iteration
                      conversationForUI = updatedConversation;
                    }
                  }
                }
              }
            }
          }
        } finally {
          reader.releaseLock();
          // Clear the abort controller and set loading to false when done
          this.currentAbortController = null;
          
          // Update assistant message ID to use database-derived ID if we have the real message ID
          if (realMessageId) {
            const assistantMessageId = realMessageId + '_assistant';
            this.store.update(state => {
              const updatedConversations = state.conversations.map(c => {
                if (c.id === conversationForUI.id) {
                  const updatedMessages = c.messages.map(m => {
                    if (m.id === assistantMessage.id) {
                      return { ...m, id: assistantMessageId };
                    }
                    return m;
                  });
                  return { ...c, messages: updatedMessages };
                }
                return c;
              });

              const updatedCurrentConversation = state.currentConversation?.id === conversationForUI.id
                ? updatedConversations.find(c => c.id === conversationForUI.id) || state.currentConversation
                : state.currentConversation;

              return {
                ...state,
                currentConversation: updatedCurrentConversation,
                conversations: updatedConversations,
                isChatLoading: false
              };
            });
          } else {
            this.store.update(state => ({
              ...state,
              isChatLoading: false
            }));
          }
        }
      }

    } catch (err) {
      // Check if the error is from an abort
      if (err instanceof DOMException && err.name === 'AbortError') {
        console.log('Edit request was aborted');
        return;
      }

      const errorMessage = err instanceof Error ? err.message : 'Failed to edit message';
      this.store.update(state => ({
        ...state,
        chatError: errorMessage,
        isChatLoading: false
      }));
      throw new Error(errorMessage);
    }
  }

  public async loadConversationsFromBackend(): Promise<void> {
    try {
      const response = await fetch(`${import.meta.env.VITE_POCKETBASE_URL || 'http://localhost:8080'}/conversations/?type=chat`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AuthorizationService.getInstance().token}`
        }
      });

      if (!response.ok) {
        console.error('Failed to load conversations from backend');
        return;
      }

      const backendConversations = await response.json();
      
      // Convert backend conversations to frontend format
      const conversations: ChatConversation[] = backendConversations?.map((conv: any) => ({
        id: conv.id,
        title: conv.title,
        messages: [], // Messages will be loaded when conversation is opened
        createdAt: new Date(conv.created).getTime(),
        updatedAt: new Date(conv.updated).getTime()
      }));

      this.store.update(state => ({
        ...state,
        conversations: conversations
      }));

    } catch (err) {
      console.error('Failed to load conversations:', err);
    }
  }

  public createNewConversation(): void {
    this.store.update(state => ({
      ...state,
      currentConversation: null
    }));
  }

  public async loadConversation(conversationId: string, forceReload: boolean = false): Promise<void> {
    try {
      // First check if we already have the conversation with messages
      let currentState: AIState;
      const unsubscribe = this.store.subscribe(state => {
        currentState = state;
      });
      unsubscribe();

      const existingConversation = currentState!.conversations.find(c => c.id === conversationId);
      if (existingConversation && existingConversation.messages.length > 0 && !forceReload) {
        // We already have the messages, just set as current
        this.store.update(state => ({
          ...state,
          currentConversation: existingConversation
        }));
        return;
      }

      // Load full conversation from backend
      const response = await fetch(`${import.meta.env.VITE_POCKETBASE_URL || 'http://localhost:8080'}/conversations/${conversationId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AuthorizationService.getInstance().token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load conversation');
      }

      const backendConversation = await response.json();
      
      // Convert backend conversation to frontend format
      const messages: ChatMessage[] = [];
      for (const msg of backendConversation?.messages ?? []) {
        if (msg.active) {
          // Add user message with database message ID
          messages.push({
            id: msg.id, // Use the actual database ID
            role: 'user',
            content: msg.user_message,
            timestamp: new Date(msg.created).getTime()
          });
          
          // Add assistant message with a derived ID
          messages.push({
            id: msg.id + '_assistant', // Derived ID for assistant response
            role: 'assistant',
            content: msg.response_message,
            timestamp: new Date(msg.created).getTime() + 1 // Slightly later timestamp
          });
        }
      }

      const conversation: ChatConversation = {
        id: backendConversation?.id ?? '',
        title: backendConversation?.title ?? '',
        messages: messages,
        createdAt: new Date(backendConversation?.created ?? '').getTime(),
        updatedAt: new Date(backendConversation?.updated ?? '').getTime()
      };

      this.store.update(state => {
        // Update the conversation in the list with full messages
        const updatedConversations = state.conversations.map(c =>
          c.id === conversationId ? conversation : c
        );

        return {
          ...state,
          currentConversation: conversation,
          conversations: updatedConversations
        };
      });

    } catch (err) {
      console.error('Failed to load conversation:', err);
      this.store.update(state => ({
        ...state,
        chatError: 'Failed to load conversation'
      }));
    }
  }

  public deleteConversation(conversationId: string): void {
    this.store.update(state => ({
      ...state,
      conversations: state.conversations.filter(c => c.id !== conversationId),
      currentConversation: state.currentConversation?.id === conversationId ? null : state.currentConversation
    }));
  }

  // Existing methods
  public async getImprovement(text: string, context: string): Promise<string> {
    return this.makeAIRequest('improvement', text, context);
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

  // Data management methods
  public clearStoredData(): void {
    // Reset store to default state
    this.store.set({
      suggestions: [],
      isLoading: false,
      error: null,
      history: [],
      currentConversation: null,
      conversations: [],
      isChatLoading: false,
      chatError: null,
      improvementConversations: [],
      synonymsConversations: [],
      descriptionConversations: [],
      isLoadingQuickActions: false,
      quickActionsError: null
    });
  }

  public clearQuickActionsError(): void {
    this.store.update(state => ({
      ...state,
      quickActionsError: null
    }));
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