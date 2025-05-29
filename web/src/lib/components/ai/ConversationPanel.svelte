<script lang="ts">
  import { aiService, aiStore } from "$lib/services/ai";
  import { layoutStore } from "$lib/services/layout/layout.service";

  // Props
  const { isVisible, onClose } = $props<{
    isVisible: boolean;
    onClose: () => void;
  }>();

  // State
  let aiState = $derived($aiStore);
  let layoutState = $derived($layoutStore);

  function formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - timestamp;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffHours < 48) return "1 day ago";
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  }

  function createNewConversation() {
    aiService.createNewConversation();
  }

  async function loadConversation(conversationId: string) {
    await aiService.loadConversation(conversationId);
  }

  async function deleteConversation(conversationId: string) {
    try {
      await aiService.deleteConversation(conversationId);
    } catch (err) {
      console.error("Failed to delete conversation:", err);
    }
  }
</script>

<div
  class="w-64 border-r border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 transition-all duration-300 fixed top-0 bottom-0 left-0 z-50 shadow-xl conversation-panel"
  class:translate-x-0={isVisible}
  class:-translate-x-full={!isVisible}
>
  <!-- Panel Tab -->
  <div class="absolute -right-6 top-1/2 -translate-y-1/2">
    <button
      class="w-6 h-12 bg-white dark:bg-zinc-900 border border-l-0 border-gray-200 dark:border-zinc-800 rounded-r-md shadow-sm hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors flex items-center justify-center panel-toggle"
      onclick={() => onClose()}
      title={isVisible ? "Hide Previous Conversations" : "Show Previous Conversations"}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-3 w-3 text-gray-600 dark:text-zinc-400"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        {#if isVisible}
          <path
            fill-rule="evenodd"
            d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
            clip-rule="evenodd"
          />
        {:else}
          <path
            fill-rule="evenodd"
            d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
            clip-rule="evenodd"
          />
        {/if}
      </svg>
    </button>
  </div>

  <div class="p-3 h-full flex flex-col">
    <div class="flex items-center justify-between mb-3">
      <h4
        class="text-xs font-medium text-gray-600 dark:text-zinc-400 uppercase tracking-wide"
      >
        Conversations
      </h4>
      <div class="flex items-center gap-2">
        <button
          class="px-2 py-1 text-xs text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200 transition-colors flex items-center gap-1"
          onclick={createNewConversation}
          title="New Chat"
          aria-label="Start New Chat"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-3 w-3"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fill-rule="evenodd"
              d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
              clip-rule="evenodd"
            />
          </svg>
          New
        </button>
        {#if layoutState.isFullscreen}
          <button
            class="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200 transition-colors"
            onclick={onClose}
            title="Close Panel"
            aria-label="Close Panel"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-4 w-4"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fill-rule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clip-rule="evenodd"
              />
            </svg>
          </button>
        {/if}
      </div>
    </div>

    <div class="flex-1 overflow-y-auto space-y-1">
      {#each aiState.conversations as conversation}
        <div class="flex items-center gap-2 pr-2">
          <button
            class="flex-1 text-left text-xs p-1.5 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors truncate min-w-0"
            class:bg-blue-50={aiState.currentConversation?.id === conversation.id}
            class:dark:bg-blue-950={aiState.currentConversation?.id === conversation.id}
            class:text-blue-600={aiState.currentConversation?.id === conversation.id}
            class:dark:text-blue-400={aiState.currentConversation?.id === conversation.id}
            onclick={() => loadConversation(conversation.id)}
            title={conversation.title}
          >
            <div class="flex items-center justify-between gap-2 min-w-0">
              <div class="font-medium truncate flex-1">
                {conversation.title}
              </div>
              <div
                class="text-gray-500 dark:text-zinc-400 flex-shrink-0 text-right"
              >
                {formatTimestamp(conversation.updatedAt)}
              </div>
            </div>
          </button>
          <button
            class="p-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors flex-shrink-0"
            onclick={() => {
              if (
                confirm(
                  "Are you sure you want to delete this conversation? This action cannot be undone."
                )
              ) {
                deleteConversation(conversation.id);
              }
            }}
            title="Delete Chat"
            aria-label="Delete Current Chat"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-3 w-3"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fill-rule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clip-rule="evenodd"
              />
            </svg>
          </button>
        </div>
      {/each}

      {#if aiState.conversations.length === 0}
        <div
          class="text-xs text-gray-500 dark:text-zinc-400 text-center py-2"
        >
          No conversations yet
        </div>
      {/if}
    </div>
  </div>
</div> 