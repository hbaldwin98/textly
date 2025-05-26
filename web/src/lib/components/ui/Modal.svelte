<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  interface Props {
    isOpen: boolean;
    title?: string;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    showCloseButton?: boolean;
  }

  let {
    isOpen = false,
    title = '',
    size = 'md',
    showCloseButton = true
  }: Props = $props();

  const dispatch = createEventDispatcher();

  function handleClose() {
    dispatch('close');
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      handleClose();
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      handleClose();
    }
  }

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl'
  };
</script>

{#if isOpen}
  <!-- Backdrop -->
  <div
    class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
    onclick={handleBackdropClick}
    onkeydown={handleKeydown}
    role="dialog"
    aria-modal="true"
    aria-labelledby={title ? 'modal-title' : undefined}
    tabindex="-1"
  >
    <!-- Modal Content -->
    <div
      class="bg-white dark:bg-zinc-900 rounded-lg shadow-xl w-full {sizeClasses[size]} max-h-[90vh] overflow-hidden flex flex-col"
      onclick={(e) => e.stopPropagation()}
    >
      <!-- Header -->
      {#if title || showCloseButton}
        <div class="flex items-center justify-between p-6 border-b border-gray-200 dark:border-zinc-700">
          {#if title}
            <h2 id="modal-title" class="text-xl font-semibold text-gray-900 dark:text-zinc-100">
              {title}
            </h2>
          {:else}
            <div></div>
          {/if}
          
          {#if showCloseButton}
            <button
              onclick={handleClose}
              class="text-gray-400 hover:text-gray-600 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors"
              aria-label="Close modal"
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          {/if}
        </div>
      {/if}

      <!-- Body -->
      <div class="flex-1 overflow-y-auto">
        <slot />
      </div>

      <!-- Footer -->
      {#if $$slots.footer}
        <div class="border-t border-gray-200 dark:border-zinc-700 p-6">
          <slot name="footer" />
        </div>
      {/if}
    </div>
  </div>
{/if} 