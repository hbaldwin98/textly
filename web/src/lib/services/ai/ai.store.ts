import { writable } from 'svelte/store';
import type { AIState } from './ai.service';

const defaultState: AIState = {
  suggestions: [],
  isLoading: false,
  error: null,
  history: [],
  conversations: [],
  currentConversation: null,
  isChatLoading: false,
  chatError: null,
  lastConversationId: typeof window !== 'undefined' ? localStorage.getItem('textly-last-conversation-id') || null : null,
  lastAITab: typeof window !== 'undefined' ? localStorage.getItem('textly-last-ai-tab') || 'chat' : 'chat',
  improvementConversations: [],
  synonymsConversations: [],
  descriptionConversations: [],
  isLoadingQuickActions: false,
  quickActionsError: null
};

// Store for AI state
export const aiStore = writable<AIState>(defaultState); 