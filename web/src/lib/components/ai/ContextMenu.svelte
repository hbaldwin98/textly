<script lang="ts">
  import { aiService } from "$lib/services/ai";
  import { clipboardService } from "$lib/services/clipboard";
  import { layoutStore } from "$lib/services/layout/layout.service";
  import { aiStore } from "$lib/services/ai/ai.store";
  import { AuthorizationService } from "$lib/services/authorization";
  import { contextMenu, handleClickOutside, handleEscapeKey } from "$lib/stores/context-menu.store";
  import { onMount } from "svelte";

  // Props
  interface Props {
    selectedText: string;
    context: string;
    buttonPosition: { x: number; y: number };
    onClose: () => void;
    onAIAction: (action: 'improve' | 'synonyms' | 'describe', text: string, context: string) => void;
  }

  let { selectedText, context, buttonPosition, onClose, onAIAction }: Props = $props();

  const authService = AuthorizationService.getInstance();

  // Function to handle AI actions
  async function handleAIAction(action: 'improve' | 'synonyms' | 'describe', event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    
    if (!selectedText || !authService.token) return;

    layoutStore.setAIAssistantOpen(true);
    aiService.setLastAITab("quick");
    await onAIAction(action, selectedText, context);
    contextMenu.hide();
    onClose();
  }

  // Function to copy text to clipboard
  async function copyToClipboard(text: string, event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    try {
      await clipboardService.copy(text);
      contextMenu.hide();
      onClose();
    } catch (err) {
      console.error("Failed to copy text:", err);
    }
  }

  // Function to paste from clipboard
  async function pasteFromClipboard(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    try {
      const text = await clipboardService.paste();
      const editor = document.querySelector(".monaco-editor");
      if (editor) {
        (editor as HTMLElement).focus();
      }
      document.execCommand("insertText", false, text);
      contextMenu.hide();
      onClose();
    } catch (err) {
      console.error("Failed to paste text:", err);
    }
  }

  onMount(() => {
    window.addEventListener("click", (e) => handleClickOutside(e, ".context-menu"));
    window.addEventListener("keydown", handleEscapeKey);
    return () => {
      window.removeEventListener("click", (e) => handleClickOutside(e, ".context-menu"));
      window.removeEventListener("keydown", handleEscapeKey);
    };
  });
</script>

<div
  class="fixed z-50 context-menu"
  style="
    top: {buttonPosition.y - 40}px;
    left: {buttonPosition.x}px;
  "
  on:click|stopPropagation
>
  <div
    class="flex gap-1 bg-white dark:bg-zinc-800 rounded-lg shadow-lg p-1 border border-gray-200 dark:border-zinc-700"
  >
    <button
      class="flex items-center gap-1 px-2 py-1.5 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded transition-colors"
      on:click|stopPropagation={(e) => handleAIAction('improve', e)}
      title="Suggest Improvement"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-3.5 w-3.5"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fill-rule="evenodd"
          d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
          clip-rule="evenodd"
        />
      </svg>
      <span>Improve</span>
    </button>
    {#if selectedText.split(/\s+/).length === 1}
      <button
        class="flex items-center gap-1 px-2 py-1.5 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded transition-colors"
        on:click|stopPropagation={(e) => handleAIAction('synonyms', e)}
        title="Get Synonyms"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-3.5 w-3.5"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            d="M9.243 3.03a1 1 0 01.727 1.213L9.53 6h2.94l.56-2.243a1 1 0 111.94.486L14.53 6H17a1 1 0 110 2h-2.97l-1 4H15a1 1 0 110 2h-2.47l-.56 2.242a1 1 0 11-1.94-.485L10.47 14H7.53l-.56 2.242a1 1 0 11-1.94-.485L5.47 14H3a1 1 0 110-2h2.97l1-4H5a1 1 0 110-2h2.47l.56-2.243a1 1 0 011.213-.727zM9.03 8l-1 4h2.94l1-4H9.03z"
          />
        </svg>
        <span>Synonyms</span>
      </button>
    {/if}
    <button
      class="flex items-center gap-1 px-2 py-1.5 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded transition-colors"
      on:click|stopPropagation={(e) => handleAIAction('describe', e)}
      title="Describe Text"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-3.5 w-3.5"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fill-rule="evenodd"
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
          clip-rule="evenodd"
        />
      </svg>
      <span>Describe</span>
    </button>
    <div class="w-px h-4 bg-gray-200 dark:bg-zinc-700 mx-1"></div>
    <button
      class="flex items-center gap-1 px-2 py-1.5 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded transition-colors"
      on:click|stopPropagation={(e) => copyToClipboard(selectedText, e)}
      title="Copy Selected Text"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-3.5 w-3.5"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
        <path
          d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z"
        />
      </svg>
      <span>Copy</span>
    </button>
    <button
      class="flex items-center gap-1 px-2 py-1.5 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded transition-colors"
      on:click|stopPropagation={(e) => pasteFromClipboard(e)}
      title="Paste from Clipboard"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-3.5 w-3.5"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
        <path
          d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z"
        />
        <path d="M4 6a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1z" />
      </svg>
      <span>Paste</span>
    </button>
  </div>
</div>
