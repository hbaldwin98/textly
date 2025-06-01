import { writable, type Writable } from 'svelte/store';
import { AuthorizationService } from '../authorization/authorization.service';
import ConversationService, { type Conversation, type ConversationMessage } from './conversation.service';
import { modelService } from './model.service';
import { PocketBaseService } from '../pocketbase.service';
import { aiStore } from './ai.store';

export interface SuggestionHistory {
  type: 'improve' | 'explain' | 'chat';
  text: string;
  timestamp: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  thinking?: boolean;
  thinkingContent?: string;
  user_message?: string;
  response_message?: string;
  model?: string;
  input_tokens?: number;
  output_tokens?: number;
  reasoning_tokens?: number;
  cost?: number;
  active?: boolean;
  created?: string;
}

export interface ChatConversation {
  id: string;
  title: string;
  type: string;
  total_requests: number;
  input_tokens: number;
  output_tokens: number;
  cost: number;
  messages: ChatMessage[];
  created: string;
  updated: string;
}

export interface AIState {
  suggestions: string[];
  isLoading: boolean;
  error: string | null;
  history: SuggestionHistory[];
  improvementConversations: Conversation[];
  synonymsConversations: Conversation[];
  descriptionConversations: Conversation[];
  isLoadingQuickActions: boolean;
  quickActionsError: string | null;
  conversations: ChatConversation[];
  currentConversation: ChatConversation | null;
  isChatLoading: boolean;
  chatError: string | null;
  lastConversationId: string | null;
  lastAITab: string;
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
  quickActionsError: null,
  lastConversationId: typeof window !== 'undefined' ? localStorage.getItem('textly-last-conversation-id') : null,
  lastAITab: typeof window !== 'undefined' ? localStorage.getItem('textly-last-ai-tab') || 'chat' : 'chat'
};

class AIService {
  private static instance: AIService;
  private readonly authService = AuthorizationService.getInstance();
  private readonly conversationService = ConversationService.getInstance();
  private readonly MAX_HISTORY = 10;
  private readonly MAX_CONVERSATIONS = 20;
  private currentAbortController: AbortController | null = null;
  private pb = PocketBaseService.getInstance();

  private constructor() {
    // Initialize the store with default state
    const savedState = typeof window !== 'undefined' ? localStorage.getItem('textly-ai-state') : null;
    const initialState = savedState ? JSON.parse(savedState) : defaultState;
    aiStore.set(initialState);

    // Subscribe to store changes to persist state
    aiStore.subscribe(state => {
      if (typeof window !== 'undefined') {
        localStorage.setItem('textly-ai-state', JSON.stringify(state));
      }
    });
  }

  public static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService();
    }
    return AIService.instance;
  }

  private addToHistory(historyItem: SuggestionHistory): void {
    aiStore.update((state: AIState) => ({
      ...state,
      history: [historyItem, ...state.history.slice(0, this.MAX_HISTORY - 1)]
    }));
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  // Load Quick Actions conversations from API
  public async loadQuickActionsConversations(): Promise<void> {
    try {
      const [improvementConversations, synonymsConversations, descriptionConversations] = await Promise.all([
        this.conversationService.getConversations('improvement', true),
        this.conversationService.getConversations('synonyms', true),
        this.conversationService.getConversations('description', true)
      ]);

      // Update store with all quick action conversations
      aiStore.update(state => ({
        ...state,
        improvementConversations,
        synonymsConversations,
        descriptionConversations,
        isLoadingQuickActions: false,
        quickActionsError: null
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load Quick Actions conversations';
      aiStore.update(state => ({
        ...state,
        quickActionsError: errorMessage,
        isLoadingQuickActions: false
      }));
    }
  }

  private async makeAIRequest(type: 'improvement' | 'synonyms' | 'description', text: string, context?: string) {
    if (!this.authService.token) {
      throw new Error('Authentication required for AI requests');
    }

    try {
      aiStore.update(state => ({ ...state, isLoading: true, error: null }));

      const response = await fetch(`${import.meta.env.VITE_POCKETBASE_URL || 'http://localhost:8080'}/ai/assist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.authService.token}`
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

      aiStore.update(state => ({
        ...state,
        suggestions: [data.suggestion],
        isLoading: false
      }));

      // Add to history with the correct type
      const historyItem: SuggestionHistory = {
        type: type as 'improve' | 'explain' | 'chat',
        text: text,
        timestamp: Date.now()
      };
      this.addToHistory(historyItem);

      // Reload the appropriate conversations list since ai/assist creates persistent conversations
      await this.loadQuickActionsConversations();

      return data.suggestion;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : `Failed to get ${type}`;
      aiStore.update(state => ({
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

      aiStore.update(state => ({ ...state, isChatLoading: true, chatError: null }));

      // Get current state
      let currentState: AIState;
      const unsubscribe = aiStore.subscribe(state => {
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
          message: message,
          model: modelService.getSelectedModel()?.id ? modelService.getEffectiveModelId(modelService.getSelectedModel()!.id) : undefined,
          use_reasoning: modelService.shouldUseReasoning()
        };
      } else if (currentState!.currentConversation) {
        targetConversation = currentState!.currentConversation;
        endpoint = '/conversations/continue';
        requestBody = {
          conversation_id: targetConversation.id,
          message: message,
          model: modelService.getSelectedModel()?.id ? modelService.getEffectiveModelId(modelService.getSelectedModel()!.id) : undefined,
          use_reasoning: modelService.shouldUseReasoning()
        };
      } else {
        // This will be a new conversation
        isNewConversation = true;
        targetConversation = {
          id: this.generateId(), // Temporary ID
          title: message.slice(0, 50) + (message.length > 50 ? '...' : ''),
          type: 'chat',
          total_requests: 0,
          input_tokens: 0,
          output_tokens: 0,
          cost: 0,
          messages: [],
          created: new Date().toISOString(),
          updated: new Date().toISOString()
        };
        endpoint = '/conversations/create';
        requestBody = {
          message: message,
          title: targetConversation.title,
          model: modelService.getSelectedModel()?.id ? modelService.getEffectiveModelId(modelService.getSelectedModel()!.id) : undefined,
          use_reasoning: modelService.shouldUseReasoning()
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

      aiStore.update(state => {
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
          'Authorization': `Bearer ${this.authService.token}`
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
      aiStore.update(state => {
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
                          aiStore.update(state => {
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
                          aiStore.update(state => {
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
                    } else if (data.startsWith('{') && (data.includes('thinking') || data.includes('thinking_content'))) {
                      // Handle thinking state and content events
                      try {
                        const parsed = JSON.parse(data);

                        if (typeof parsed.thinking === 'boolean') {
                          // Update thinking state
                          const updatedAssistantMessage = {
                            ...assistantMessage,
                            thinking: parsed.thinking
                          };

                          // Update conversation with thinking state
                          const updatedConversation = {
                            ...conversationForUI,
                            messages: [
                              ...conversationForUI.messages.slice(0, -1),
                              updatedAssistantMessage
                            ],
                            updatedAt: Date.now()
                          };

                          // Update store with thinking state
                          aiStore.update(state => {
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
                          assistantMessage.thinking = parsed.thinking;
                        }

                        if (parsed.thinking_content) {
                          // Append thinking content with proper unescaping
                          const currentThinkingContent = assistantMessage.thinkingContent || '';
                          // Unescape newlines and quotes in thinking content
                          const unescapedThinkingContent = parsed.thinking_content
                            .replace(/\\n/g, '\n')
                            .replace(/\\"/g, '"')
                            .replace(/\\\\/g, '\\');
                          const updatedAssistantMessage = {
                            ...assistantMessage,
                            thinkingContent: currentThinkingContent + unescapedThinkingContent
                          };

                          // Update conversation with thinking content
                          const updatedConversation = {
                            ...conversationForUI,
                            messages: [
                              ...conversationForUI.messages.slice(0, -1),
                              updatedAssistantMessage
                            ],
                            updatedAt: Date.now()
                          };

                          // Update store with thinking content
                          aiStore.update(state => {
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
                          assistantMessage.thinkingContent = updatedAssistantMessage.thinkingContent;
                        }
                      } catch (e) {
                        console.warn('Failed to parse thinking event:', e);
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
                      aiStore.update(state => {
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
            aiStore.update(state => {
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
            aiStore.update(state => ({
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
      aiStore.update(state => ({
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

      aiStore.update(state => ({ ...state, isChatLoading: true, chatError: null }));

      // Get current state synchronously
      let currentState: AIState;
      const unsubscribe = aiStore.subscribe(state => {
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

      // Use the message ID directly for the database request
      const databaseMessageId = messageId;

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
      aiStore.update(state => {
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
          'Authorization': `Bearer ${this.authService.token}`
        },
        body: JSON.stringify({
          conversation_id: conversationId,
          message_id: databaseMessageId,
          new_message: newContent,
          model: modelService.getSelectedModel()?.id ? modelService.getEffectiveModelId(modelService.getSelectedModel()!.id) : undefined,
          use_reasoning: modelService.shouldUseReasoning()
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
      aiStore.update(state => {
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
                          aiStore.update(state => {
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
                    } else if (data.startsWith('{') && (data.includes('thinking') || data.includes('thinking_content'))) {
                      // Handle thinking state and content events
                      try {
                        const parsed = JSON.parse(data);

                        if (typeof parsed.thinking === 'boolean') {
                          // Update thinking state
                          const updatedAssistantMessage = {
                            ...assistantMessage,
                            thinking: parsed.thinking
                          };

                          // Update conversation with thinking state
                          const updatedConversation = {
                            ...conversationForUI,
                            messages: [
                              ...conversationForUI.messages.slice(0, -1),
                              updatedAssistantMessage
                            ],
                            updatedAt: Date.now()
                          };

                          // Update store with thinking state
                          aiStore.update(state => {
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
                          assistantMessage.thinking = parsed.thinking;
                        }

                        if (parsed.thinking_content) {
                          // Append thinking content with proper unescaping
                          const currentThinkingContent = assistantMessage.thinkingContent || '';
                          // Unescape newlines and quotes in thinking content
                          const unescapedThinkingContent = parsed.thinking_content
                            .replace(/\\n/g, '\n')
                            .replace(/\\"/g, '"')
                            .replace(/\\\\/g, '\\');
                          const updatedAssistantMessage = {
                            ...assistantMessage,
                            thinkingContent: currentThinkingContent + unescapedThinkingContent
                          };

                          // Update conversation with thinking content
                          const updatedConversation = {
                            ...conversationForUI,
                            messages: [
                              ...conversationForUI.messages.slice(0, -1),
                              updatedAssistantMessage
                            ],
                            updatedAt: Date.now()
                          };

                          // Update store with thinking content
                          aiStore.update(state => {
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
                          assistantMessage.thinkingContent = updatedAssistantMessage.thinkingContent;
                        }
                      } catch (e) {
                        console.warn('Failed to parse thinking event:', e);
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
                      aiStore.update(state => {
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
            aiStore.update(state => {
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
            aiStore.update(state => ({
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
      aiStore.update(state => ({
        ...state,
        chatError: errorMessage,
        isChatLoading: false
      }));
      throw new Error(errorMessage);
    }
  }

  public async loadConversationsFromBackend(): Promise<void> {
    try {
      const conversations = await this.conversationService.getConversations('chat', true);
      const chatConversations: ChatConversation[] = conversations.map(c => ({
        id: c.id,
        title: c.title,
        type: c.type,
        total_requests: c.total_requests,
        input_tokens: c.input_tokens,
        output_tokens: c.output_tokens,
        cost: c.cost,
        messages: c.messages.flatMap(m => {
          const messages: ChatMessage[] = [];
          
          // Add user message if present
          if (m.user_message) {
            messages.push({
              id: m.id,
              role: 'user',
              content: m.user_message,
              timestamp: new Date(m.created).getTime(),
              user_message: m.user_message,
              response_message: m.response_message,
              model: m.model,
              input_tokens: m.input_tokens,
              output_tokens: m.output_tokens,
              reasoning_tokens: m.reasoning_tokens,
              cost: m.cost,
              active: m.active,
              created: m.created
            });
          }
          
          // Add assistant message if present
          if (m.response_message) {
            messages.push({
              id: m.id + '_assistant',
              role: 'assistant',
              content: m.response_message,
              timestamp: new Date(m.created).getTime(),
              user_message: m.user_message,
              response_message: m.response_message,
              model: m.model,
              input_tokens: m.input_tokens,
              output_tokens: m.output_tokens,
              reasoning_tokens: m.reasoning_tokens,
              cost: m.cost,
              active: m.active,
              created: m.created
            });
          }
          
          return messages;
        }),
        created: c.created,
        updated: c.updated
      }));

      aiStore.update(state => ({
        ...state,
        conversations: chatConversations
      }));

      // Check if we have a last conversation ID and try to load it
      const lastConversationId = localStorage.getItem('textly-last-conversation-id');
      if (lastConversationId) {
        const lastConversation = chatConversations.find(c => c.id === lastConversationId);
        if (lastConversation) {
          aiStore.update(state => ({
            ...state,
            currentConversation: lastConversation
          }));
        }
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
      aiStore.update(state => ({
        ...state,
        chatError: err instanceof Error ? err.message : 'Failed to load conversations'
      }));
    }
  }

  public createNewConversation(): void {
    aiStore.update(state => ({
      ...state,
      currentConversation: null
    }));
  }

  public async loadConversation(conversationId: string, forceReload: boolean = false): Promise<void> {
    try {
      // First check if we already have the conversation with messages
      let currentState: AIState;
      const unsubscribe = aiStore.subscribe(state => {
        currentState = state;
      });
      unsubscribe();

      const existingConversation = currentState!.conversations.find(c => c.id === conversationId);
      if (existingConversation && existingConversation.messages.length > 0 && !forceReload) {
        // We already have the messages, just set as current
        aiStore.update(state => ({
          ...state,
          currentConversation: existingConversation,
          lastConversationId: conversationId
        }));
        return;
      }

      // Load the conversation from the backend
      const conversation = await this.conversationService.getConversation(conversationId);
      const chatConversation: ChatConversation = {
        id: conversation.id,
        title: conversation.title,
        type: conversation.type,
        total_requests: conversation.total_requests,
        input_tokens: conversation.input_tokens,
        output_tokens: conversation.output_tokens,
        cost: conversation.cost,
        messages: conversation.messages.map(m => ({
          id: m.id,
          role: m.user_message ? 'user' : 'assistant',
          content: m.user_message || m.response_message || '',
          timestamp: new Date(m.created).getTime(),
          user_message: m.user_message,
          response_message: m.response_message,
          model: m.model,
          input_tokens: m.input_tokens,
          output_tokens: m.output_tokens,
          reasoning_tokens: m.reasoning_tokens,
          cost: m.cost,
          active: m.active,
          created: m.created
        })),
        created: conversation.created,
        updated: conversation.updated
      };

      aiStore.update(state => {
        // Update the conversation in the list with full messages
        const updatedConversations = state.conversations.map(c =>
          c.id === chatConversation.id ? chatConversation : c
        );

        // If the conversation wasn't in the list, add it
        if (!updatedConversations.find(c => c.id === chatConversation.id)) {
          updatedConversations.unshift(chatConversation);
        }

        return {
          ...state,
          conversations: updatedConversations,
          currentConversation: chatConversation,
          lastConversationId: conversationId
        };
      });
    } catch (err) {
      console.error('Failed to load conversation:', err);
      aiStore.update(state => ({
        ...state,
        chatError: 'Failed to load conversation'
      }));
    }
  }

  public async deleteConversation(conversationId: string): Promise<void> {
    try {
      // Call the deactivate endpoint
      const response = await fetch(`${import.meta.env.VITE_POCKETBASE_URL || 'http://localhost:8080'}/conversations/deactivate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.authService.token}`
        },
        body: JSON.stringify({
          conversation_id: conversationId
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to deactivate conversation');
      }

      // Remove from local store only after successful API call
      aiStore.update(state => ({
        ...state,
        conversations: state.conversations.filter(c => c.id !== conversationId),
        currentConversation: state.currentConversation?.id === conversationId ? null : state.currentConversation
      }));

    } catch (err) {
      console.error('Failed to deactivate conversation:', err);
      aiStore.update(state => ({
        ...state,
        chatError: err instanceof Error ? err.message : 'Failed to deactivate conversation'
      }));
      throw err;
    }
  }

  // Existing methods
  private trimContext(context: string, text: string, maxWords: number = 100): string {
    if (!context) return '';

    // Split context into words
    const words = context.split(/\s+/);
    const textWords = text.split(/\s+/);

    // Find the position of the selected text in the context
    const textStart = context.indexOf(text);
    if (textStart === -1) return context; // If text not found, return full context

    // Calculate word positions
    let beforeWordCount = 0;
    let afterWordCount = 0;
    let currentWordCount = 0;

    for (let i = 0; i < words.length; i++) {
      if (currentWordCount < textStart) {
        beforeWordCount++;
      } else if (currentWordCount >= textStart + text.length) {
        afterWordCount++;
      }
      currentWordCount += words[i].length + 1; // +1 for the space
    }

    // Get surrounding words, excluding the selected text
    const startIndex = Math.max(0, beforeWordCount - maxWords);
    const endIndex = Math.min(words.length, beforeWordCount + textWords.length + maxWords);

    // Get the words and join them
    let result = words.slice(startIndex, endIndex).join(' ');

    // Remove the selected text from the context
    result = result.replace(text, '').trim();

    // If the result is longer than 1000 characters, trim it
    if (result.length > 1000) {
      // Find the last space before the 1000 character limit
      const lastSpace = result.substring(0, 1000).lastIndexOf(' ');
      if (lastSpace !== -1) {
        result = result.substring(0, lastSpace) + '...';
      } else {
        // If no space found, just cut at 1000
        result = result.substring(0, 1000) + '...';
      }
    }

    return result;
  }

  public async getImprovement(text: string, context: string): Promise<string> {
    const trimmedContext = this.trimContext(context, text);
    return this.makeAIRequest('improvement', text, trimmedContext);
  }

  public async getSynonyms(text: string, context: string): Promise<string> {
    const trimmedContext = this.trimContext(context, text);
    return this.makeAIRequest('synonyms', text, trimmedContext);
  }

  public async getDescription(text: string, context: string): Promise<string> {
    const trimmedContext = this.trimContext(context, text);
    return this.makeAIRequest('description', text, trimmedContext);
  }

  public clearError(): void {
    aiStore.update(state => ({
      ...state,
      error: null
    }));
  }

  public clearChatError(): void {
    aiStore.update(state => ({
      ...state,
      chatError: null
    }));
  }

  public clearSuggestions(): void {
    aiStore.update(state => ({
      ...state,
      suggestions: []
    }));
  }

  public getStore() {
    return aiStore;
  }

  // Data management methods
  public clearStoredData(): void {
    // Reset store to default state
    aiStore.set({
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
      quickActionsError: null,
      lastConversationId: null,
      lastAITab: 'quick'
    });

    // Clear localStorage
    if (typeof window !== 'undefined') {
      localStorage.removeItem('textly-ai-state');
      localStorage.removeItem('textly-last-conversation-id');
      localStorage.removeItem('textly-last-ai-tab');
    }
  }

  public clearQuickActionsError(): void {
    aiStore.update(state => ({ ...state, quickActionsError: null }));
  }

  public updateConversationInList(updatedConversation: Conversation): void {
    aiStore.update(state => {
      const conversations = [...state.conversations];
      const index = conversations.findIndex(c => c.id === updatedConversation.id);

      if (index !== -1) {
        // Convert the Conversation type to ChatConversation type
        const chatConversation: ChatConversation = {
          id: updatedConversation.id,
          title: updatedConversation.title,
          messages: updatedConversation.messages.map(m => ({
            id: m.id,
            role: m.user_message ? 'user' : 'assistant',
            content: m.user_message || m.response_message,
            timestamp: new Date(m.created).getTime(),
            thinkingContent: m.thinking_content
          })),
          created: new Date(updatedConversation.created).toISOString(),
          updated: new Date(updatedConversation.updated).toISOString(),
          type: updatedConversation.type,
          total_requests: updatedConversation.total_requests,
          input_tokens: updatedConversation.input_tokens,
          output_tokens: updatedConversation.output_tokens,
          cost: updatedConversation.cost
        };

        conversations[index] = chatConversation;
      }

      return { ...state, conversations };
    });
  }

  // Method to stop the current conversation
  public stopCurrentConversation(): void {
    if (this.currentAbortController) {
      this.currentAbortController.abort();
      this.currentAbortController = null;

      // Update store to reflect stopped state
      aiStore.update(state => ({
        ...state,
        isChatLoading: false,
        chatError: 'Conversation stopped by user'
      }));
    }
  }

  // Add methods to update UI state
  public setLastConversationId(id: string | null): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('textly-last-conversation-id', id || '');
    }
    aiStore.update(state => ({
      ...state,
      lastConversationId: id
    }));
  }

  public setLastAITab(tab: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('textly-last-ai-tab', tab);
    }
    aiStore.update(state => ({
      ...state,
      lastAITab: tab
    }));
  }

}

export const aiService = AIService.getInstance(); 