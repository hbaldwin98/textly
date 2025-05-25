<script lang="ts">
  import { aiService, aiStore, storageStats } from "$lib/services/ai";

  // Use Svelte's reactive store syntax for better reactivity
  $: aiState = $aiStore;

  let showConfirmClear = false;
  let importInput: HTMLInputElement;
  let exportData = '';
  let showExportModal = false;

  function handleClearData() {
    showConfirmClear = true;
  }

  function confirmClear() {
    aiService.clearStoredData();
    showConfirmClear = false;
  }

  function cancelClear() {
    showConfirmClear = false;
  }

  function handleExportData() {
    const data = aiService.exportData();
    if (data) {
      exportData = data;
      showExportModal = true;
    }
  }

  function copyExportData() {
    navigator.clipboard.writeText(exportData).then(() => {
      // Could add a toast notification here
      console.log('Data copied to clipboard');
    });
  }

  function handleImportData() {
    importInput.click();
  }

  function onFileSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = e.target?.result as string;
        if (aiService.importData(data)) {
          console.log('Data imported successfully');
        } else {
          console.error('Failed to import data');
        }
      };
      reader.readAsText(file);
    }
  }

  function downloadExportData() {
    const blob = new Blob([exportData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `textly-ai-data-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
</script>

<div class="h-full overflow-y-auto p-4 space-y-4">
  <div class="text-sm font-medium text-gray-900 dark:text-zinc-100 mb-4">
    AI Data Management
  </div>

  <!-- Storage Stats -->
  <div class="bg-white dark:bg-zinc-900 rounded-lg p-3 space-y-2 border border-gray-200 dark:border-zinc-800">
    <div class="text-xs font-medium text-gray-600 dark:text-zinc-400">Storage Statistics</div>
    <div class="grid grid-cols-2 gap-2 text-xs">
      <div>
        <span class="text-gray-600 dark:text-zinc-400">Conversations:</span>
        <span class="font-medium text-gray-900 dark:text-zinc-100 ml-1">
          {$storageStats.conversations}
        </span>
      </div>
      <div>
        <span class="text-gray-600 dark:text-zinc-400">History Items:</span>
        <span class="font-medium text-gray-900 dark:text-zinc-100 ml-1">
          {$storageStats.history}
        </span>
      </div>
    </div>
    <div class="pt-1 border-t border-gray-200 dark:border-zinc-800">
      <span class="text-gray-600 dark:text-zinc-400 text-xs">Storage Size:</span>
      <span class="font-medium text-gray-900 dark:text-zinc-100 ml-1 text-xs">
        {$storageStats.storageSize}
      </span>
    </div>
  </div>

  <!-- Data Management Actions -->
  <div class="space-y-3">
    <button
      class="w-full px-3 py-2 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors flex items-center justify-center gap-2"
      onclick={handleExportData}
      title="Export Data"
      aria-label="Export Data"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" />
      </svg>
      Export Data
    </button>

    <button
      class="w-full px-3 py-2 text-xs bg-green-500 hover:bg-green-600 text-white rounded-md transition-colors flex items-center justify-center gap-2"
      onclick={handleImportData}
      title="Import Data"
      aria-label="Import Data"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 11-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clip-rule="evenodd" />
      </svg>
      Import Data
    </button>

    <button
      class="w-full px-3 py-2 text-xs bg-red-500 hover:bg-red-600 text-white rounded-md transition-colors flex items-center justify-center gap-2"
      onclick={() => (showConfirmClear = true)}
      title="Clear Data"
      aria-label="Clear Data"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
      </svg>
      Clear All Data
    </button>
  </div>

  <!-- Hidden file input for import -->
  <input
    type="file"
    accept=".json"
    bind:this={importInput}
    onchange={onFileSelected}
    class="hidden"
  />
</div>

<!-- Clear Confirmation Modal -->
{#if showConfirmClear}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-zinc-800 dark:bg-zinc-900 rounded-lg p-6 max-w-sm mx-4">
      <h3 class="text-lg font-medium text-zinc-100 dark:text-zinc-100 mb-2">
        Clear All Data?
      </h3>
      <p class="text-sm text-zinc-400 dark:text-zinc-400 mb-4">
        This will permanently delete all conversations and history. This action cannot be undone.
      </p>
      <div class="flex gap-3">
        <button
          class="flex-1 px-3 py-2 text-sm bg-red-500 hover:bg-red-600 text-white rounded-md transition-colors"
          onclick={confirmClear}
        >
          Clear
        </button>
        <button
          class="flex-1 px-3 py-2 text-sm bg-zinc-700 hover:bg-zinc-600 text-zinc-100 rounded-md transition-colors"
          onclick={cancelClear}
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Export Modal -->
{#if showExportModal}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white dark:bg-zinc-800 rounded-lg p-6 max-w-md mx-4 w-full">
      <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
        Export Data
      </h3>
      <div class="space-y-3">
        <button
          class="w-full px-3 py-2 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors"
          onclick={downloadExportData}
        >
          Download as File
        </button>
        <button
          class="w-full px-3 py-2 text-sm bg-gray-500 hover:bg-gray-600 text-white rounded-md transition-colors"
          onclick={copyExportData}
        >
          Copy to Clipboard
        </button>
        <button
          class="w-full px-3 py-2 text-sm bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-md transition-colors"
          onclick={() => showExportModal = false}
        >
          Close
        </button>
      </div>
    </div>
  </div>
{/if} 