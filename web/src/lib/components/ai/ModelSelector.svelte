<script lang="ts">
  import { modelService, modelStore, type AIModel, type ModelCapabilities } from "$lib/services/ai";
  import { onMount } from "svelte";

  // State
  let isOpen = false;
  let dropdownElement: HTMLElement;

  // Reactive store subscription
  $: modelState = $modelStore;

  // Load models on mount
  onMount(async () => {
    try {
      await modelService.loadModels();
    } catch (err) {
      console.error('Failed to load models:', err);
    }
  });

  function togglePane() {
    isOpen = !isOpen;
  }

  function selectModel(model: AIModel) {
    modelService.selectModel(model.id);
    isOpen = false; // Close pane after selection
  }

  function toggleCapability(capability: keyof ModelCapabilities, event: Event) {
    event.stopPropagation(); // Prevent button click from bubbling
    const selectedModel = modelState.selectedModel;
    if (selectedModel) {
      // Check if the base model supports this capability
      if (!selectedModel.capabilities[capability]) {
        return; // Don't allow toggling if base model doesn't support it
      }
      
      const currentCapabilities = modelService.getEffectiveCapabilities(selectedModel.id);
      if (currentCapabilities) {
        const newValue = !currentCapabilities[capability];
        modelService.setCapabilityOverride(selectedModel.id, capability, newValue);
      }
    }
  }

  function getEffectiveCapabilities(model: AIModel): ModelCapabilities {
    return modelService.getEffectiveCapabilities(model.id) || model.capabilities;
  }

  // Close pane when clicking outside
  function handleClickOutside(event: MouseEvent) {
    if (dropdownElement && !dropdownElement.contains(event.target as Node)) {
      isOpen = false;
    }
  }

  // Get current capability state for the selected model
  $: selectedModelCapabilities = modelState.selectedModel ? getEffectiveCapabilities(modelState.selectedModel) : null;
</script>

<svelte:window onclick={handleClickOutside} />

<div class="relative" bind:this={dropdownElement}>
  <!-- Model Cards Pane (opens upward) -->
  {#if isOpen && !modelState.isLoading}
    <div class="absolute bottom-full mb-2 left-0 -ml-4 bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg shadow-lg z-50 p-2 max-h-96 overflow-y-auto w-[calc(100vw-2rem)] sm:w-[640px]">
      {#if modelState.availableModels.length === 0}
        <div class="text-center text-gray-500 dark:text-zinc-400 py-3">
          No models available
        </div>
      {:else}
        {@const groupedModels = modelState.availableModels.reduce((groups: Record<string, AIModel[]>, model: AIModel) => {
          const provider = model.provider;
          if (!groups[provider]) {
            groups[provider] = [];
          }
          groups[provider].push(model);
          return groups;
        }, {} as Record<string, AIModel[]>)}
        
        <div class="space-y-3">
          {#each Object.entries(groupedModels) as [provider, models]}
            <div>
              <!-- Provider Header -->
              <div class="text-xs font-medium text-gray-600 dark:text-zinc-400 mb-1.5 px-1 uppercase tracking-wide">
                {provider}
              </div>
              
              <!-- Models Grid for this provider -->
              <div class="grid grid-cols-2 gap-1.5">
                {#each models as model}
                  <button
                    class="p-1.5 text-left rounded border transition-all hover:shadow-sm"
                    class:border-blue-500={modelState.selectedModel?.id === model.id}
                    class:bg-blue-50={modelState.selectedModel?.id === model.id}
                    class:dark:bg-blue-950={modelState.selectedModel?.id === model.id}
                    class:border-gray-200={modelState.selectedModel?.id !== model.id}
                    class:dark:border-zinc-700={modelState.selectedModel?.id !== model.id}
                    class:hover:border-gray-300={modelState.selectedModel?.id !== model.id}
                    class:dark:hover:border-zinc-600={modelState.selectedModel?.id !== model.id}
                    onclick={() => selectModel(model)}
                  >
                    <div class="flex items-center gap-1.5 mb-1">
                      <span class="text-sm">{model.icon}</span>
                      <div class="flex-1 min-w-0">
                        <div class="font-medium text-xs text-gray-900 dark:text-zinc-100 truncate">
                          {model.name}
                        </div>
                      </div>
                    </div>
                    
                    <!-- Capability badges -->
                    <div class="flex flex-wrap gap-0.5">
                      <!-- Show only supported capabilities -->
                      {#if model.capabilities.standard}
                        <span class="text-xs text-gray-700 dark:text-gray-300">
                          {modelService.getCapabilityIcon('standard')}
                        </span>
                      {/if}
                      {#if model.capabilities.reasoning}
                        <span class="text-xs text-gray-700 dark:text-gray-300">
                          {modelService.getCapabilityIcon('reasoning')}
                        </span>
                      {/if}
                      {#if model.capabilities.internet}
                        <span class="text-xs text-gray-700 dark:text-gray-300">
                          {modelService.getCapabilityIcon('internet')}
                        </span>
                      {/if}
                    </div>
                  </button>
                {/each}
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}

  <!-- Main Toggle Button with Capability Controls -->
  <div class="flex items-center gap-2">
    <!-- Model Selection Button -->
    <button
      class="flex items-center gap-1.5 px-1.5 sm:px-2 py-1 text-sm bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-md hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
      onclick={togglePane}
      disabled={modelState.isLoading}
      title="Select AI Model"
    >
      {#if modelState.isLoading}
        <div class="w-3 h-3 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
        <span class="text-gray-500 dark:text-zinc-400 text-xs">Loading...</span>
      {:else if modelState.selectedModel}
        <span class="text-sm">{modelState.selectedModel.icon}</span>
        <div class="hidden sm:block flex-1 text-left">
          <div class="font-medium text-gray-900 dark:text-zinc-100 text-xs truncate">
            {modelState.selectedModel.name}
          </div>
        </div>
      {:else}
        <span class="text-gray-500 dark:text-zinc-400 text-xs">Select Model</span>
      {/if}
      
      <svg
        class="w-3 h-3 text-gray-400 transition-transform {isOpen ? 'rotate-180' : ''}"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    <!-- Capability Toggle Buttons (only show when model is selected) -->
    {#if modelState.selectedModel && selectedModelCapabilities}
      <div class="flex gap-1">
        <!-- Reasoning Toggle -->
        <button
          class="p-1 rounded border transition-colors {selectedModelCapabilities.reasoning 
            ? 'bg-blue-100 dark:bg-blue-900 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300' 
            : 'bg-gray-100 dark:bg-zinc-800 border-gray-300 dark:border-zinc-700 text-gray-500 dark:text-zinc-500'}"
          class:opacity-50={!modelState.selectedModel.capabilities.reasoning}
          class:cursor-not-allowed={!modelState.selectedModel.capabilities.reasoning}
          onclick={(e) => toggleCapability('reasoning', e)}
          disabled={!modelState.selectedModel.capabilities.reasoning}
          title={!modelState.selectedModel.capabilities.reasoning 
            ? 'This model does not support reasoning' 
            : selectedModelCapabilities.reasoning ? 'Disable Reasoning' : 'Enable Reasoning'}
        >
          <span class="text-xs">🧠</span>
        </button>

        <!-- Internet Toggle -->
        <button
          class="p-1 rounded border transition-colors {selectedModelCapabilities.internet 
            ? 'bg-green-100 dark:bg-green-900 border-green-300 dark:border-green-700 text-green-700 dark:text-green-300' 
            : 'bg-gray-100 dark:bg-zinc-800 border-gray-300 dark:border-zinc-700 text-gray-500 dark:text-zinc-500'}"
          class:opacity-50={!modelState.selectedModel.capabilities.internet}
          class:cursor-not-allowed={!modelState.selectedModel.capabilities.internet}
          onclick={(e) => toggleCapability('internet', e)}
          disabled={!modelState.selectedModel.capabilities.internet}
          title={!modelState.selectedModel.capabilities.internet 
            ? 'This model does not support internet access' 
            : selectedModelCapabilities.internet ? 'Disable Internet' : 'Enable Internet'}
        >
          <span class="text-xs">🌐</span>
        </button>
      </div>
    {/if}
  </div>

  <!-- Error Display -->
  {#if modelState.error}
    <div class="absolute bottom-full left-0 right-0 mb-1 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-xs text-red-600 dark:text-red-400">
      {modelState.error}
    </div>
  {/if}
</div> 