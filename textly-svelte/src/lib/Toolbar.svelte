<script lang="ts">
  import { browser } from '$app/environment';
  
  // Props
  interface Props {
    viewMode: string;
    isSpellcheckEnabled: boolean;
    onViewModeChange: (mode: string) => void;
    onSpellcheckToggle: () => void;
  }
  
  let { viewMode, isSpellcheckEnabled, onViewModeChange, onSpellcheckToggle }: Props = $props();
  
  function toggleDarkMode() {
    if (browser && (window as any).toggleDarkMode) {
      (window as any).toggleDarkMode();
    }
  }
</script>

<div class="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between shrink-0
             lg:px-5 lg:py-3.5 xl:px-6 xl:py-4">
  <!-- View Toggle Buttons -->
  <div class="flex gap-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md p-1 
              lg:gap-1 lg:p-1 xl:gap-1.5 xl:p-1.5">
    <button
      class="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded transition-all
             lg:px-3.5 lg:py-2 lg:text-sm lg:gap-1.5 xl:px-4 xl:py-2.5 xl:text-base xl:gap-2
             {viewMode === 'split' ? 'bg-blue-600 text-white' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'}"
      onclick={() => onViewModeChange('split')}
      title="Split View"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" class="lg:w-4 lg:h-4 xl:w-5 xl:h-5">
        <path d="M6 2h4v12H6V2zm-1 0H1v12h4V2zm7 0v12h4V2h-4z"/>
      </svg>
      Split
    </button>
    
    <button
      class="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded transition-all
             lg:px-3.5 lg:py-2 lg:text-sm lg:gap-1.5 xl:px-4 xl:py-2.5 xl:text-base xl:gap-2
             {viewMode === 'editor' ? 'bg-blue-600 text-white' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'}"
      onclick={() => onViewModeChange('editor')}
      title="Editor Only"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" class="lg:w-4 lg:h-4 xl:w-5 xl:h-5">
        <path d="M2 3h12v10H2V3zm1 1v8h10V4H3z"/>
      </svg>
      Editor
    </button>
    
    <button
      class="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded transition-all
             lg:px-3.5 lg:py-2 lg:text-sm lg:gap-1.5 xl:px-4 xl:py-2.5 xl:text-base xl:gap-2
             {viewMode === 'preview' ? 'bg-blue-600 text-white' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'}"
      onclick={() => onViewModeChange('preview')}
      title="Preview Only"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" class="lg:w-4 lg:h-4 xl:w-5 xl:h-5">
        <path d="M2 2h12v2H2V2zm0 3h8v1H2V5zm0 2h8v1H2V7zm0 2h8v1H2V9zm0 2h8v1H2v-1z"/>
      </svg>
      Preview
    </button>
    
    <button
      class="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded transition-all
             lg:px-3.5 lg:py-2 lg:text-sm lg:gap-1.5 xl:px-4 xl:py-2.5 xl:text-base xl:gap-2
             {viewMode === 'focus' ? 'bg-blue-600 text-white' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'}"
      onclick={() => onViewModeChange('focus')}
      title="Focus Mode"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" class="lg:w-4 lg:h-4 xl:w-5 xl:h-5">
        <path d="M8 2.5a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0V3.5H6a.5.5 0 0 1 0-1h2zM10 6a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 0 1H10.5V8a.5.5 0 0 1-1 0V6zM6 10a.5.5 0 0 1-.5.5H3a.5.5 0 0 1 0-1h2.5V8a.5.5 0 0 1 1 0v2zM10 10v1.5H8.5a.5.5 0 0 1 0-1H10z"/>
      </svg>
      Focus
    </button>
  </div>
  
  <!-- Feature Buttons -->
  <div class="flex gap-2 items-center lg:gap-2.5 xl:gap-3">
    <!-- Spellcheck Toggle -->
    <button
      class="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded border transition-all
             lg:px-3.5 lg:py-2 lg:text-sm lg:gap-1.5 xl:px-4 xl:py-2.5 xl:text-base xl:gap-2
             {isSpellcheckEnabled 
               ? 'bg-blue-600 text-white border-blue-600' 
               : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'}"
      onclick={onSpellcheckToggle}
      title="Toggle Spellcheck (Ctrl+S)"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" class="lg:w-4 lg:h-4 xl:w-5 xl:h-5">
        <path d="M11.93 8.5a4.02 4.02 0 0 1-7.86 0A4.02 4.02 0 0 1 8 4.5a4.02 4.02 0 0 1 3.93 4M8 5.5a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM14 2.5h-1v-1h-1v1H3v-1H2v1H1v1h1v11h1v1h9v-1h1v-1H3v-11h9v1h1v-1h1v-1z"/>
        <path d="M8 7a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/>
      </svg>
      Spellcheck
    </button>
    
    <!-- Dark Mode Toggle -->
    <button
      class="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded border bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 transition-all
             lg:px-3.5 lg:py-2 lg:text-sm lg:gap-1.5 xl:px-4 xl:py-2.5 xl:text-base xl:gap-2"
      onclick={toggleDarkMode}
      title="Toggle Dark Mode"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" class="dark:hidden lg:w-4 lg:h-4 xl:w-5 xl:h-5">
        <path d="M8 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 1A5 5 0 1 1 8 3a5 5 0 0 1 0 10zm.5-9.5h-1v-1h1v1zm0 11h-1v-1h1v1zm5-5.5v-1h-1v1h1zm-11 0v-1h-1v1h1z"/>
      </svg>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" class="hidden dark:block lg:w-4 lg:h-4 xl:w-5 xl:h-5">
        <path d="M6 .278a.768.768 0 0 1 .08.858 7.208 7.208 0 0 0-.878 3.46c0 4.021 3.278 7.277 7.318 7.277.527 0 1.04-.055 1.533-.16a.787.787 0 0 1 .81.316.733.733 0 0 1-.031.893A8.349 8.349 0 0 1 8.344 16C3.734 16 0 12.286 0 7.71 0 4.266 2.114 1.312 5.124.06A.752.752 0 0 1 6 .278z"/>
      </svg>
      Dark
    </button>
  </div>
</div> 