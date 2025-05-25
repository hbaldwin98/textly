<script lang="ts">
  import { onMount } from "svelte";
  import ContextMenu from "./ContextMenu.svelte";
  import QuickActions from "./QuickActions.svelte";
  import ChatInterface from "./ChatInterface.svelte";
  import AISettings from "./AISettings.svelte";

  export let onSuggestionAccept: (suggestion: string) => void = () => {};
  export let isOpen = false;

  // State
  let selectedText = "";
  let showSuggestionButton = false;
  let buttonPosition = { x: 0, y: 0 };
  let activeTab: "quick" | "chat" | "settings" = "quick";
  
  // Resize state
  let isResizing = false;
  let startX = 0;
  let startWidth = 500; // Default width in pixels
  let currentWidth = startWidth;
  let minWidth = 280;
  let maxWidth = 800;

  function handleResizeStart(event: MouseEvent) {
    event.preventDefault(); // Prevent text selection
    isResizing = true;
    startX = event.clientX;
    startWidth = currentWidth;
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
    document.body.style.userSelect = 'none'; // Prevent text selection globally during resize
  }

  function handleResizeMove(event: MouseEvent) {
    if (!isResizing) return;
    event.preventDefault(); // Prevent text selection
    
    const deltaX = startX - event.clientX;
    const newWidth = Math.min(Math.max(startWidth + deltaX, minWidth), maxWidth);
    currentWidth = newWidth;
  }

  function handleResizeEnd() {
    isResizing = false;
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);
    document.body.style.userSelect = ''; // Restore text selection
  }

  onMount(() => {
    // Set up event listeners for text selection and context menu
    function setupEventListeners() {
      window.addEventListener("mouseup", handleTextSelection);
      window.addEventListener("keyup", handleTextSelection);
      window.addEventListener("contextmenu", handleContextMenu);
      window.addEventListener("click", handleClickOutside);
    }

    // Initial setup
    setupEventListeners();

    return () => {
      // Clean up event listeners
      window.removeEventListener("mouseup", handleTextSelection);
      window.removeEventListener("keyup", handleTextSelection);
      window.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("click", handleClickOutside);
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
    };
  });

  // Function to handle text selection
  function handleTextSelection() {
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
      selectedText = selection.toString().trim();
    } else {
      selectedText = "";
      showSuggestionButton = false;
    }
  }

  // Function to handle context menu
  function handleContextMenu(event: MouseEvent) {
    // Check if the event is within an editor area
    const target = event.target as Element;
    const isInEditor = target.closest(
      ".milkdown-immersive, .cm-editor, .cm-content"
    );

    if (!isInEditor) return; // Let non-editor context menus proceed normally

    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
      event.preventDefault(); // Only prevent default when text is selected
      selectedText = selection.toString().trim();

      // Get the selection's bounding rectangle
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      // Position the menu to the left of the selection
      buttonPosition = {
        x: rect.left - 10, // 10px to the left of the selection
        y: rect.top - 10, // 10px above the selection
      };

      showSuggestionButton = true;
      // Switch to quick actions tab when context menu is used
      activeTab = "quick";
      isOpen = true;
    }
    // If no text is selected, let the native context menu show
  }

  // Function to hide suggestion button when clicking outside
  function handleClickOutside(_: MouseEvent) {
    if (showSuggestionButton) {
      showSuggestionButton = false;
    }
  }
</script>

<!-- Floating Suggestion Button -->
{#if showSuggestionButton && selectedText}
  <ContextMenu
    {selectedText}
    {buttonPosition}
    onClose={() => (showSuggestionButton = false)}
  />
{/if}

<!-- Toggle Button -->
<button
  class="fixed top-4 right-4 w-10 h-10 flex items-center justify-center rounded-lg bg-gray-100/50 dark:bg-zinc-800/50 hover:bg-gray-200/70 dark:hover:bg-zinc-700/70 text-gray-600 dark:text-gray-300 transition-colors backdrop-blur-sm"
  on:click={() => (isOpen = !isOpen)}
  title="AI Assistant"
  aria-label="AI Assistant"
>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    class="h-5 w-5"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <rect x="3" y="11" width="18" height="10" rx="2" />
    <circle cx="12" cy="5" r="2" />
    <path d="M12 7v4" />
    <line x1="8" y1="16" x2="8" y2="16" />
    <line x1="16" y1="16" x2="16" y2="16" />
    <path d="M9 20l3 3 3-3" />
  </svg>
</button>

<!-- Sidebar -->
<div
  class="fixed top-0 right-0 h-full bg-gray-50 dark:bg-zinc-950 border-l border-gray-200 dark:border-zinc-800 overflow-hidden transform z-50"
  class:transition-transform={!isResizing}
  class:duration-300={!isResizing}
  class:ease-in-out={!isResizing}
  class:translate-x-0={isOpen}
  class:translate-x-full={!isOpen}
  style="width: {currentWidth}px;"
>
  <!-- Resize Handle -->
  <div
    class="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-blue-500 dark:hover:bg-blue-400 transition-colors select-none"
    on:mousedown={handleResizeStart}
  ></div>

  <div class="p-4 h-full flex flex-col">
    <!-- Header with tabs -->
    <div class="flex items-center justify-between mb-4 border-b border-gray-200 dark:border-zinc-800 pb-4">
      <h2 class="text-lg font-semibold text-gray-900 dark:text-zinc-100">AI Assistant</h2>
      <button
        class="text-gray-500 hover:text-gray-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        on:click={() => (isOpen = false)}
        aria-label="Close"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-5 w-5"
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

    <!-- Tab Navigation -->
    <div class="flex mb-4 bg-white dark:bg-zinc-900 rounded-lg p-1">
      <button
        class="flex-1 px-3 py-2 text-xs font-medium rounded-md transition-colors"
        class:bg-gray-100={activeTab === "quick"}
        class:dark:bg-zinc-800={activeTab === "quick"}
        class:text-blue-600={activeTab === "quick"}
        class:dark:text-blue-400={activeTab === "quick"}
        class:text-gray-600={activeTab !== "quick"}
        class:dark:text-zinc-400={activeTab !== "quick"}
        on:click={() => (activeTab = "quick")}
      >
        Quick Actions
      </button>
      <button
        class="flex-1 px-3 py-2 text-xs font-medium rounded-md transition-colors"
        class:bg-gray-100={activeTab === "chat"}
        class:dark:bg-zinc-800={activeTab === "chat"}
        class:text-blue-600={activeTab === "chat"}
        class:dark:text-blue-400={activeTab === "chat"}
        class:text-gray-600={activeTab !== "chat"}
        class:dark:text-zinc-400={activeTab !== "chat"}
        on:click={() => (activeTab = "chat")}
      >
        Chat
      </button>
      <button
        class="flex-1 px-3 py-2 text-xs font-medium rounded-md transition-colors"
        class:bg-gray-100={activeTab === "settings"}
        class:dark:bg-zinc-800={activeTab === "settings"}
        class:text-blue-600={activeTab === "settings"}
        class:dark:text-blue-400={activeTab === "settings"}
        class:text-gray-600={activeTab !== "settings"}
        class:dark:text-zinc-400={activeTab !== "settings"}
        on:click={() => (activeTab = "settings")}
      >
        Settings
      </button>
    </div>

    <!-- Tab Content -->
    <div class="flex-1 min-h-0">
      <div class="h-full" class:hidden={activeTab !== 'quick'}>
        <QuickActions {onSuggestionAccept} />
      </div>
      <div class="h-full" class:hidden={activeTab !== 'chat'}>
        <ChatInterface />
      </div>
      <div class="h-full" class:hidden={activeTab !== 'settings'}>
        <AISettings />
      </div>
    </div>
  </div>
</div>
