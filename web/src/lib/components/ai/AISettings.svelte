<script lang="ts">
  import { aiService } from "$lib/services/ai/ai.service";
  import { aiStore } from "$lib/services/ai/ai.store";

  let showConfirmClear = false;

  function confirmClear() {
    aiService.clearStoredData();
    showConfirmClear = false;
  }

  function cancelClear() {
    showConfirmClear = false;
  }
</script>

<div class="h-full overflow-y-auto p-4 space-y-4">
  <div class="text-sm font-medium text-gray-900 dark:text-zinc-100 mb-4">
    AI Data Management
  </div>

  <!-- Memory Stats -->
  <div class="bg-white dark:bg-zinc-900 rounded-lg p-3 space-y-2 border border-gray-200 dark:border-zinc-800">
    <div class="text-xs font-medium text-gray-600 dark:text-zinc-400">Current Session</div>
    <div class="grid grid-cols-2 gap-2 text-xs">
      <div>
        <span class="text-gray-600 dark:text-zinc-400">Chat Conversations:</span>
        <span class="font-medium text-gray-900 dark:text-zinc-100 ml-1">
          {$aiStore.conversations.length}
        </span>
      </div>
      <div>
        <span class="text-gray-600 dark:text-zinc-400">Recent Suggestions:</span>
        <span class="font-medium text-gray-900 dark:text-zinc-100 ml-1">
          {$aiStore.history.length}
        </span>
      </div>
    </div>
    <div class="grid grid-cols-3 gap-2 text-xs pt-1 border-t border-gray-200 dark:border-zinc-800">
      <div>
        <span class="text-gray-600 dark:text-zinc-400">Improvements:</span>
        <span class="font-medium text-gray-900 dark:text-zinc-100 ml-1">
          {$aiStore.improvementConversations.length}
        </span>
      </div>
      <div>
        <span class="text-gray-600 dark:text-zinc-400">Synonyms:</span>
        <span class="font-medium text-gray-900 dark:text-zinc-100 ml-1">
          {$aiStore.synonymsConversations.length}
        </span>
      </div>
      <div>
        <span class="text-gray-600 dark:text-zinc-400">Descriptions:</span>
        <span class="font-medium text-gray-900 dark:text-zinc-100 ml-1">
          {$aiStore.descriptionConversations.length}
        </span>
      </div>
    </div>
  </div>

  <!-- Data Management Actions -->
  <div class="space-y-3">
    <button
      class="w-full px-3 py-2 text-xs bg-red-500 hover:bg-red-600 text-white rounded-md transition-colors flex items-center justify-center gap-2"
      on:click={() => (showConfirmClear = true)}
      title="Clear Session Data"
      aria-label="Clear Session Data"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
      </svg>
      Clear Session Data
    </button>
  </div>
</div>

<!-- Clear Confirmation Modal -->
{#if showConfirmClear}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-zinc-800 dark:bg-zinc-900 rounded-lg p-6 max-w-sm mx-4">
      <h3 class="text-lg font-medium text-zinc-100 dark:text-zinc-100 mb-2">
        Clear Session Data?
      </h3>
      <p class="text-sm text-zinc-400 dark:text-zinc-400 mb-4">
        This will clear the current session data (chat conversations and recent suggestions). Your saved conversations in the database will remain intact.
      </p>
      <div class="flex gap-3">
        <button
          class="flex-1 px-3 py-2 text-sm bg-red-500 hover:bg-red-600 text-white rounded-md transition-colors"
          on:click={confirmClear}
        >
          Clear
        </button>
        <button
          class="flex-1 px-3 py-2 text-sm bg-zinc-700 hover:bg-zinc-600 text-zinc-100 rounded-md transition-colors"
          on:click={cancelClear}
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
{/if} 