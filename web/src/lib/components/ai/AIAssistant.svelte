<script lang="ts">
  import { onMount } from "svelte";
  import ContextMenu from "./ContextMenu.svelte";
  import QuickActions from "./QuickActions.svelte";
  import ChatInterface from "./ChatInterface.svelte";
  import AISettings from "./AISettings.svelte";
  import { layoutStore } from "$lib/services/layout/layout.service";
  import { aiService, aiStore } from "$lib/services/ai";

  // Props
  interface Props {
    onSuggestionAccept: (suggestion: string) => void;
    context: string;
  }

  let { onSuggestionAccept = () => {}, context }: Props = $props();

  // State
  let selectedText = $state("");
  let showSuggestionButton = $state(false);
  let buttonPosition = $state({ x: 0, y: 0 });
  let activeTab = $state($aiStore.lastAITab);

  // Resize state
  const layoutState = $derived($layoutStore);
  const aiState = $derived($aiStore);
  const maxWidth = $state(1200); // Maximum width
  let isResizing = $state(false);
  let startX = $state(0);
  let startWidth = $state(500); // Default width in pixels
  let currentWidth = $state(400); // Default width
  let minWidth = $state(400);

  // Update active tab in store when it changes
  $effect(() => {
    aiService.setLastAITab(activeTab);
  });

  function handleResizeStart(event: MouseEvent) {
    event.preventDefault(); // Prevent text selection
    isResizing = true;
    startX = event.clientX;
    startWidth = currentWidth;
    document.addEventListener("mousemove", handleResizeMove);
    document.addEventListener("mouseup", handleResizeEnd);
    document.body.style.userSelect = "none"; // Prevent text selection globally during resize
  }

  function handleResizeMove(event: MouseEvent) {
    if (!isResizing) return;
    event.preventDefault(); // Prevent text selection

    const deltaX = startX - event.clientX;
    const newWidth = Math.min(
      Math.max(startWidth + deltaX, minWidth),
      maxWidth
    );
    currentWidth = newWidth;
  }

  function handleResizeEnd() {
    isResizing = false;
    document.removeEventListener("mousemove", handleResizeMove);
    document.removeEventListener("mouseup", handleResizeEnd);
    document.body.style.userSelect = ""; // Restore text selection
  }

  function toggleFullscreen() {
    layoutStore.toggleFullscreen();
    if (layoutState.isFullscreen) {
      currentWidth = window.innerWidth;
    } else {
      handleWindowResize();
    }
  }

  // Handle window resize
  function handleWindowResize() {
    if (layoutState.isFullscreen) {
      currentWidth = window.innerWidth;
      return;
    }
    const windowWidth = window.innerWidth;
    if (layoutState.isMobile) {
      currentWidth = windowWidth; // Full width on mobile
    } else if (layoutState.isTablet) {
      currentWidth = Math.min(windowWidth * 0.75, maxWidth);
    } else {
      currentWidth = Math.min(windowWidth * 0.5, maxWidth);
    }
  }

  onMount(() => {
    // Set up event listeners for text selection and context menu
    function setupEventListeners() {
      window.addEventListener("mouseup", handleTextSelection);
      window.addEventListener("keyup", handleTextSelection);
      window.addEventListener("contextmenu", handleContextMenu);
      window.addEventListener("click", handleClickOutside);
      window.addEventListener("resize", handleWindowResize);
    }

    // Initial setup
    setupEventListeners();
    handleWindowResize(); // Set initial width based on window size

    return () => {
      // Clean up event listeners
      window.removeEventListener("mouseup", handleTextSelection);
      window.removeEventListener("keyup", handleTextSelection);
      window.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("click", handleClickOutside);
      window.removeEventListener("resize", handleWindowResize);
      document.removeEventListener("mousemove", handleResizeMove);
      document.removeEventListener("mouseup", handleResizeEnd);
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
      layoutStore.setAIAssistantOpen(true);
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
    {context}
    onClose={() => (showSuggestionButton = false)}
  />
{/if}

<!-- Toggle Button -->
<button
  class="fixed top-4 right-4 w-10 h-10 flex items-center justify-center rounded-lg bg-gray-100/50 dark:bg-zinc-800/50 hover:bg-gray-200/70 dark:hover:bg-zinc-700/70 text-gray-600 dark:text-gray-300 transition-colors backdrop-blur-sm"
  onclick={() => layoutStore.toggleAIAssistant()}
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
  class="fixed top-0 right-0 h-full bg-gray-50 dark:bg-zinc-950 border-l border-gray-200 dark:border-zinc-800 overflow-hidden transform z-50 shadow-xl"
  class:transition-transform={!isResizing}
  class:duration-300={!isResizing}
  class:ease-in-out={!isResizing}
  class:translate-x-0={layoutState.isAIAssistantOpen}
  class:translate-x-full={!layoutState.isAIAssistantOpen}
  class:z-40={layoutState.isSidebarOpen}
  class:z-50={!layoutState.isSidebarOpen}
  class:w-full={layoutState.isMobile || layoutState.isFullscreen}
  class:fullscreen={layoutState.isFullscreen}
  style="width: {layoutState.isMobile || layoutState.isFullscreen ? '100%' : currentWidth}px;"
>
  <!-- Resize Handle -->
  {#if !layoutState.isFullscreen}
    <div
      class="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-blue-500 dark:hover:bg-blue-400 transition-colors select-none"
      onmousedown={handleResizeStart}
      aria-label="Resize handle"
      role="button"
      tabindex="0"
    ></div>
  {/if}

  <div class="p-4 h-full flex flex-col">
    <!-- Header with tabs -->
    <div
      class="flex items-center justify-between mb-4 border-b border-gray-200 dark:border-zinc-800 pb-4"
      class:max-w-5xl={layoutState.isFullscreen}
      class:mx-auto={layoutState.isFullscreen}
      class:w-full={layoutState.isFullscreen}
    >
      <h2 class="text-lg font-semibold text-gray-900 dark:text-zinc-100">
        Archibald - Assistant
      </h2>
      <div class="flex items-center gap-2">
        <button
          class="text-gray-500 hover:text-gray-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          onclick={toggleFullscreen}
          aria-label={layoutState.isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            {#if layoutState.isFullscreen}
              <path
                fill-rule="evenodd"
                d="M3 4a1 1 0 011-1h4a1 1 0 010 2H6.414l2.293 2.293a1 1 0 11-1.414 1.414L5 6.414V8a1 1 0 01-2 0V4zm9 1a1 1 0 010-2h4a1 1 0 011 1v4a1 1 0 01-2 0V6.414l-2.293 2.293a1 1 0 11-1.414-1.414L13.586 5H12zm-9 7a1 1 0 012 0v1.586l2.293-2.293a1 1 0 111.414 1.414L6.414 15H8a1 1 0 010 2H4a1 1 0 01-1-1v-4zm13-1a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 010-2h1.586l-2.293-2.293a1 1 0 111.414-1.414L15 13.586V12a1 1 0 011-1z"
                clip-rule="evenodd"
              />
            {:else}
              <path
                fill-rule="evenodd"
                d="M3 4a1 1 0 011-1h4a1 1 0 010 2H6.414l2.293 2.293a1 1 0 11-1.414 1.414L5 6.414V8a1 1 0 01-2 0V4zm9 1a1 1 0 010-2h4a1 1 0 011 1v4a1 1 0 01-2 0V6.414l-2.293 2.293a1 1 0 11-1.414-1.414L13.586 5H12zm-9 7a1 1 0 012 0v1.586l2.293-2.293a1 1 0 111.414 1.414L6.414 15H8a1 1 0 010 2H4a1 1 0 01-1-1v-4zm13-1a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 010-2h1.586l-2.293-2.293a1 1 0 111.414-1.414L15 13.586V12a1 1 0 011-1z"
                clip-rule="evenodd"
              />
            {/if}
          </svg>
        </button>
        <button
          class="text-gray-500 hover:text-gray-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          hidden={layoutState.isFullscreen}
          onclick={() => layoutStore.closeAll()}
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
    </div>

    <!-- Tab Navigation -->
    <div 
      class="flex mb-4 bg-white dark:bg-zinc-900 rounded-lg p-1"
      class:max-w-5xl={layoutState.isFullscreen}
      class:mx-auto={layoutState.isFullscreen}
      class:w-full={layoutState.isFullscreen}
    >
      <button
        class="flex-1 px-3 py-2 text-xs font-medium rounded-md transition-colors"
        class:bg-gray-100={activeTab === "quick"}
        class:dark:bg-zinc-800={activeTab === "quick"}
        class:text-blue-600={activeTab === "quick"}
        class:dark:text-blue-400={activeTab === "quick"}
        class:text-gray-600={activeTab !== "quick"}
        class:dark:text-zinc-400={activeTab !== "quick"}
        onclick={() => (activeTab = "quick")}
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
        onclick={() => (activeTab = "chat")}
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
        onclick={() => (activeTab = "settings")}
      >
        Settings
      </button>
    </div>

    <!-- Tab Content -->
    <div class="flex-1 min-h-0">
      <div class="h-full" class:hidden={activeTab !== "quick"}>
        <div class="h-full" class:max-w-5xl={layoutState.isFullscreen} class:mx-auto={layoutState.isFullscreen} class:w-full={layoutState.isFullscreen}>
          <QuickActions {onSuggestionAccept} />
        </div>
      </div>
      <div class="h-full" class:hidden={activeTab !== "chat"}>
        <div class="h-full" class:max-w-5xl={layoutState.isFullscreen} class:mx-auto={layoutState.isFullscreen} class:w-full={layoutState.isFullscreen}>
          <ChatInterface />
        </div>
      </div>
      <div class="h-full" class:hidden={activeTab !== "settings"}>
        <div class="h-full" class:max-w-5xl={layoutState.isFullscreen} class:mx-auto={layoutState.isFullscreen} class:w-full={layoutState.isFullscreen}>
          <AISettings />
        </div>
      </div>
    </div>
  </div>
</div>
