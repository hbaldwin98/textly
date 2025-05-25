<script lang="ts">
  import {
    clipboardService,
    clipboardStore,
  } from "$lib/services/clipboard";
  import {
    aiService,
    aiStore,
    type SuggestionHistory,
  } from "$lib/services/ai";

  export let onSuggestionAccept: (suggestion: string) => void = () => {};

  // Use Svelte's reactive store syntax for better reactivity
  $: clipboardState = $clipboardStore;
  $: aiState = $aiStore;

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

  // Function to format timestamp
  function formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  }
</script>

<div class="h-full overflow-y-auto overflow-x-hidden">
  <div class="p-4 pb-6">
    {#if aiState.isLoading}
      <div class="flex items-center justify-center py-4">
        <div
          class="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"
        ></div>
      </div>
    {:else if aiState.error}
      <div
        class="text-sm text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded"
      >
        {aiState.error}
      </div>
    {:else if aiState.suggestions.length === 0 && aiState.history.length === 0}
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

      <!-- History -->
      {#if aiState.history.length > 0}
        <div class="space-y-2">
          <div
            class="text-xs font-medium text-gray-600 dark:text-zinc-400 mb-2"
          >
            Previous Suggestions
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
                  class="text-xs px-2 py-1 rounded-full
                  {item.type === 'improvement'
                    ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300'
                    : item.type === 'synonyms'
                      ? 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-300'
                      : 'bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300'}"
                >
                  {item.type === "improvement"
                    ? "Improvement"
                    : item.type === "synonyms"
                      ? "Synonyms"
                      : "Description"}
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
      </div>
    {/if}
  </div>
</div> 