<script lang="ts">
  import { onMount } from 'svelte';
  import {
    clipboardService,
    clipboardStore,
  } from "$lib/services/clipboard";
  import {
    aiService,
    aiStore,
    type SuggestionHistory,
  } from "$lib/services/ai";
  import type { Conversation } from "$lib/services/ai/conversation.service";

  export let onSuggestionAccept: (suggestion: string) => void = () => {};

  // Use Svelte's reactive store syntax for better reactivity
  $: clipboardState = $clipboardStore;
  $: aiState = $aiStore;

  // Load Quick Actions conversations on mount
  onMount(async () => {
    await aiService.loadQuickActionsConversations();
  });

  // Handle side effects reactively
  $: if (clipboardState.error) {
    setTimeout(() => {
      clipboardService.clearError();
    }, 3000);
  }

  $: if (aiState.error) {
    setTimeout(() => {
      aiService.clearError();
    }, 3000);
  }

  $: if (aiState.quickActionsError) {
    setTimeout(() => {
      aiService.clearQuickActionsError();
    }, 3000);
  }

  // Function to format timestamp
  function formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  }

  // Function to format conversation date
  function formatConversationDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleString();
  }

  // Function to get conversation type color
  function getTypeColor(type: string): string {
    switch (type) {
      case 'improvement':
        return 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300';
      case 'synonyms':
        return 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-300';
      case 'description':
        return 'bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300';
      default:
        return 'bg-gray-50 text-gray-600 dark:bg-gray-900/30 dark:text-gray-300';
    }
  }

  // Function to get conversation type label
  function getTypeLabel(type: string): string {
    switch (type) {
      case 'improvement':
        return 'Improvement';
      case 'synonyms':
        return 'Synonyms';
      case 'description':
        return 'Description';
      default:
        return type;
    }
  }

  // Function to get the latest response from a conversation
  function getLatestResponse(conversation: Conversation): string {
    if (conversation.messages && conversation.messages.length > 0) {
      const lastMessage = conversation.messages[conversation.messages.length - 1];
      return lastMessage.response_message;
    }
    return '';
  }

  // Combine all conversations and sort by date
  $: allConversations = [
    ...aiState.improvementConversations.map(c => ({ ...c, type: 'improvement' })),
    ...aiState.synonymsConversations.map(c => ({ ...c, type: 'synonyms' })),
    ...aiState.descriptionConversations.map(c => ({ ...c, type: 'description' }))
  ].sort((a, b) => new Date(b.updated).getTime() - new Date(a.updated).getTime());
</script>

<div class="h-full overflow-y-auto overflow-x-hidden">
  <div class="p-4 pb-6">
    {#if aiState.isLoading || aiState.isLoadingQuickActions}
      <div class="flex items-center justify-center py-4">
        <div
          class="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"
        ></div>
      </div>
    {:else if aiState.error || aiState.quickActionsError}
      <div
        class="text-sm text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded"
      >
        {aiState.error || aiState.quickActionsError}
      </div>
    {:else if aiState.suggestions.length === 0 && aiState.history.length === 0 && allConversations.length === 0}
      <div
        class="text-xs text-gray-500 dark:text-zinc-400 bg-gray-50 dark:bg-zinc-800/50 p-2 rounded"
      >
        Select text and right-click to get AI suggestions
      </div>
    {:else}
      <div class="space-y-4">
        <!-- Current Suggestions -->
        {#if aiState.suggestions.length > 0}
          <div class="space-y-2">
            <div
              class="text-xs font-medium text-gray-600 dark:text-zinc-400 mb-2"
            >
              Current Suggestion
            </div>
            {#each aiState.suggestions as suggestion}
              <div class="group relative">
                <button
                  class="w-full text-left p-3 rounded bg-white dark:bg-zinc-900 hover:bg-gray-50 dark:hover:bg-zinc-800 text-sm text-gray-900 dark:text-zinc-100 whitespace-pre-wrap border border-gray-200 dark:border-zinc-800 transition-colors"
                  on:click={() => onSuggestionAccept(suggestion)}
                >
                  {suggestion}
                </button>
                <div
                  class="absolute right-2 top-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <button
                    class="p-1 text-gray-400 hover:text-gray-600 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors"
                    on:click={() => onSuggestionAccept(suggestion)}
                    title="Accept suggestion"
                    aria-label="Accept suggestion"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-4 w-4"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fill-rule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clip-rule="evenodd"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            {/each}
          </div>
        {/if}

        <!-- Recent History (in-memory) -->
        {#if aiState.history.length > 0}
          <div class="space-y-2">
            <div
              class="text-xs font-medium text-gray-600 dark:text-zinc-400 mb-2"
            >
              Recent Suggestions
            </div>
            {#each aiState.history as item}
              <div
                class="p-3 rounded bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800"
              >
                <div class="flex justify-between items-center mb-2">
                  <div class="text-xs text-gray-500 dark:text-zinc-400">
                    {formatTimestamp(item.timestamp)}
                  </div>
                  <div
                    class="text-xs px-2 py-1 rounded-full {getTypeColor(item.type)}"
                  >
                    {getTypeLabel(item.type)}
                  </div>
                </div>
                <div class="group relative">
                  <button
                    class="w-full text-left p-2 bg-blue-50 dark:bg-blue-900/20 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors text-gray-900 dark:text-zinc-100"
                    on:click={() => onSuggestionAccept(item.suggestion)}
                  >
                    {item.suggestion}
                  </button>
                </div>
              </div>
            {/each}
          </div>
        {/if}

        <!-- Previous Conversations from API -->
        {#if allConversations.length > 0}
          <div class="space-y-2">
            <div
              class="text-xs font-medium text-gray-600 dark:text-zinc-400 mb-2"
            >
              Previous Conversations
            </div>
            {#each allConversations as conversation}
              <div
                class="p-3 rounded bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800"
              >
                <div class="flex justify-between items-center mb-2">
                  <div class="text-xs text-gray-500 dark:text-zinc-400">
                    {formatConversationDate(conversation.updated)}
                  </div>
                  <div
                    class="text-xs px-2 py-1 rounded-full {getTypeColor(conversation.type)}"
                  >
                    {getTypeLabel(conversation.type)}
                  </div>
                </div>
                <div class="mb-2">
                  <div class="text-xs text-gray-600 dark:text-zinc-400 mb-1">
                    {conversation.title}
                  </div>
                </div>
                <div class="group relative">
                  <button
                    class="w-full text-left p-2 bg-blue-50 dark:bg-blue-900/20 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors text-gray-900 dark:text-zinc-100"
                    on:click={() => onSuggestionAccept(getLatestResponse(conversation))}
                  >
                    {getLatestResponse(conversation)}
                  </button>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div> 