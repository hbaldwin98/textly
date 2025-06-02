<script lang="ts">
  import { onMount } from "svelte";
  import { clipboardService, clipboardStore } from "$lib/services/clipboard";
  import { aiService } from "$lib/services/ai";
  import type { Conversation } from "$lib/services/ai/conversation.service";
  import { aiStore } from "$lib/services/ai/ai.store";

  export let onSuggestionAccept: (suggestion: string) => void = () => {};

  // Use Svelte's reactive store syntax for better reactivity
  $: clipboardState = $clipboardStore;
  $: aiState = $aiStore;

  // Track which conversations are being deleted
  let deletingConversations = new Set<string>();

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

  // Function to get context from clipboard
  function getContext(): string {
    return clipboardState.context || "";
  }

  // Function to get selected text from clipboard
  function getSelectedText(): string {
    return clipboardState.selectedText || "";
  }

  // Function to handle conversation deletion
  async function handleDeleteConversation(conversationId: string) {
    try {
      deletingConversations.add(conversationId);
      await aiService.deleteConversation(conversationId);
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    } finally {
      deletingConversations.delete(conversationId);
    }
  }

  // Function to remove a suggestion from the current suggestions
  function removeSuggestion(suggestion: string) {
    aiService.clearSuggestions();
  }

  // Function to remove an item from history
  function removeHistoryItem(timestamp: number) {
    aiStore.update(state => ({
      ...state,
      history: state.history.filter(item => item.timestamp !== timestamp)
    }));
  }

  // Function to handle quick actions
  async function handleQuickAction(
    type: "improvement" | "synonyms" | "description"
  ) {
    const text = getSelectedText();
    const context = getContext();

    if (!text) return;

    try {
      let suggestion: string;
      switch (type) {
        case "improvement":
          suggestion = await aiService.getImprovement(text, context);
          break;
        case "synonyms":
          suggestion = await aiService.getSynonyms(text, context);
          break;
        case "description":
          suggestion = await aiService.getDescription(text, context);
          break;
      }
      onSuggestionAccept(suggestion);
    } catch (err) {
      console.error(`Failed to get ${type}:`, err);
    }
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
      case "improvement":
        return "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300";
      case "synonyms":
        return "bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-300";
      case "description":
        return "bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300";
      default:
        return "bg-gray-50 text-gray-600 dark:bg-gray-900/30 dark:text-gray-300";
    }
  }

  // Function to get conversation type label
  function getTypeLabel(type: string): string {
    switch (type) {
      case "improvement":
        return "Improvement";
      case "synonyms":
        return "Synonyms";
      case "description":
        return "Description";
      default:
        return type;
    }
  }

  function getLatestResponse(conversation: Conversation): string {
    if (conversation.messages && conversation.messages.length > 0) {
      const lastMessage =
        conversation.messages[conversation.messages.length - 1];
      return lastMessage.response_message;
    }
    return "";
  }

  $: allConversations = [
    ...aiState.improvementConversations.map((c) => ({
      ...c,
      type: "improvement",
    })),
    ...aiState.synonymsConversations.map((c) => ({ ...c, type: "synonyms" })),
    ...aiState.descriptionConversations.map((c) => ({
      ...c,
      type: "description",
    })),
  ].sort(
    (a, b) => new Date(b.updated).getTime() - new Date(a.updated).getTime()
  );
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
    {:else if allConversations.length === 0}
      <div
        class="text-xs text-gray-500 dark:text-zinc-400 bg-gray-50 dark:bg-zinc-800/50 p-2 rounded"
      >
        Select text and right-click to get AI suggestions
      </div>
    {:else}
      <div class="space-y-4">
        {#if allConversations.length > 0}
          <div class="space-y-2">
            <div
              class="text-xs font-medium text-gray-600 dark:text-zinc-400 mb-2"
            >
              Suggestions
            </div>
            {#each allConversations as conversation}
              <div
                class="p-3 rounded bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800"
              >
                <div class="flex justify-between items-center mb-2">
                  <div class="text-xs text-gray-500 dark:text-zinc-400">
                    {formatConversationDate(conversation.updated)}
                  </div>
                  <div class="flex items-center gap-2">
                    <div
                      class="text-xs px-2 py-1 rounded-full {getTypeColor(
                        conversation.type
                      )}"
                    >
                      {getTypeLabel(conversation.type)}
                    </div>
                    <button
                      class="p-1 text-gray-400 hover:text-red-500 dark:text-zinc-400 dark:hover:text-red-400 transition-colors"
                      on:click|stopPropagation={() => handleDeleteConversation(conversation.id)}
                      title="Delete conversation"
                      aria-label="Delete conversation"
                      disabled={deletingConversations.has(conversation.id)}
                    >
                      {#if deletingConversations.has(conversation.id)}
                        <div class="animate-spin h-4 w-4">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            class="h-4 w-4"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path
                              fill-rule="evenodd"
                              d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
                              clip-rule="evenodd"
                            />
                          </svg>
                        </div>
                      {:else}
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          class="h-4 w-4"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fill-rule="evenodd"
                            d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                            clip-rule="evenodd"
                          />
                        </svg>
                      {/if}
                    </button>
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
                    on:click={() =>
                      onSuggestionAccept(getLatestResponse(conversation))}
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
