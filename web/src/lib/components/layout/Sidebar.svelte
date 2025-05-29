<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { AuthorizationService } from "$lib/services/authorization/authorization.service";
  import { authStore } from "$lib/stores/auth.store";
  import { DocumentCommandPalette } from "$lib/components/documents";
  import { currentDocument } from "$lib/stores/document.store";
  import { DocumentManagerService } from "$lib/services/documents";
  import FolderTree from "$lib/components/FolderTree.svelte";
  import type { Document } from "$lib/services/documents/document.service";
  import { layoutStore } from "$lib/services/layout/layout.service";

  // Props
  interface Props {
    viewMode: string;
    isSpellcheckEnabled: boolean;
    onViewModeChange: (mode: string) => void;
    onSpellcheckToggle: () => void;
    currentWidth?:
      | "sm"
      | "md"
      | "lg"
      | "xl"
      | "2xl"
      | "3xl"
      | "4xl"
      | "5xl"
      | "6xl"
      | "7xl"
      | "full";
    onWidthChange?: (
      width:
        | "sm"
        | "md"
        | "lg"
        | "xl"
        | "2xl"
        | "3xl"
        | "4xl"
        | "5xl"
        | "6xl"
        | "7xl"
        | "full"
    ) => void;
  }

  let {
    viewMode,
    isSpellcheckEnabled,
    onViewModeChange,
    onSpellcheckToggle,
    currentWidth,
    onWidthChange,
  }: Props = $props();
  let isHovering = $state(false);
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let isCommandPaletteOpen = $state(false);
  let isEditingTitle = $state(false);
  let editingTitle = $state("");

  // Services
  let authService: AuthorizationService | null = null;
  let documentManager: DocumentManagerService | null = null;

  // Use reactive auth store
  let authState = $derived($authStore);
  let isLoggedIn = $derived(authState.isLoggedIn);
  let userEmail = $derived(authState.user?.email || "");
  let activeDocument = $derived($currentDocument);

  let layoutState = $derived($layoutStore);
  const widthOptions = [
    "sm",
    "md",
    "lg",
    "xl",
    "2xl",
    "3xl",
    "4xl",
    "5xl",
    "6xl",
    "7xl",
    "full",
  ] as const;

  let isDarkMode = $state(false);

  $effect(() => {
    if (typeof document !== "undefined") {
      isDarkMode = document.documentElement.classList.contains("dark");
    }
  });

  function toggleSidebar() {
    layoutStore.toggleSidebar();
  }

  function handleMouseEnter() {
    isHovering = true;
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    if (!layoutState.isSidebarOpen) {
      timeoutId = setTimeout(() => {
        if (isHovering) {
          layoutStore.setSidebarOpen(true);
        }
      }, 300);
    }
  }

  function handleMouseLeave() {
    isHovering = false;
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    timeoutId = setTimeout(() => {
      if (!isHovering) {
        layoutStore.setSidebarOpen(false);
      }
    }, 500);
  }

  function toggleDarkMode() {
    if ((window as any).toggleDarkMode) {
      (window as any).toggleDarkMode();
    }
  }

  async function handleLogout() {
    if (!authService) return;

    await authService.logout();
    goto("/auth");
  }

  function handleLogin() {
    goto("/auth");
  }

  function startEditTitle() {
    if (activeDocument) {
      isEditingTitle = true;
      editingTitle = activeDocument.title || "";
    }
  }

  function cancelEditTitle() {
    isEditingTitle = false;
    editingTitle = "";
  }

  async function saveTitle() {
    if (!editingTitle.trim() || !activeDocument || !documentManager) return;

    try {
      await documentManager.updateTitle(activeDocument.id, editingTitle.trim());
      isEditingTitle = false;
      editingTitle = "";
    } catch (error) {
      console.error("Failed to update title:", error);
    }
  }

  function handleDocumentSelect(document: Document) {
    if (!document.is_folder && documentManager) {
      documentManager.loadDocument(document.id);
    }
  }

  onMount(() => {
    documentManager = DocumentManagerService.getInstance();
    authService = AuthorizationService.getInstance();
    
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  });
</script>

<!-- Sidebar Toggle Tab (subtle edge trigger) -->
{#if !layoutState.isSidebarOpen}
  <button
    class="fixed top-1/2 left-0 -translate-y-1/2 z-50 w-4 h-16 bg-gray-600 dark:bg-zinc-600 text-white rounded-r-sm shadow-sm hover:w-6 hover:bg-gray-700 dark:hover:bg-zinc-700 transition-all duration-300 flex items-center justify-center group opacity-20 hover:opacity-60"
    onclick={toggleSidebar}
    onmouseenter={handleMouseEnter}
    title="Open Sidebar"
    aria-label="Open Sidebar"
  >
    <svg
      width="10"
      height="10"
      viewBox="0 0 12 12"
      fill="currentColor"
      class="opacity-60 group-hover:opacity-100 transition-opacity duration-300"
    >
      <path d="M4.5 2L8 6l-3.5 4v-2.5H1v-3h3.5V2z" />
    </svg>
  </button>
{/if}

<!-- Sidebar -->
<div
  class="fixed top-0 left-0 h-full w-80 bg-gray-50 dark:bg-zinc-950 border-r border-gray-200 dark:border-zinc-800 shadow-xl z-40 transform transition-transform duration-300 ease-in-out flex flex-col
         {layoutState.isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}"
  class:z-50={!layoutState.isAIPanelOpen}
  class:z-40={layoutState.isAIPanelOpen}
  onmouseenter={handleMouseEnter}
  onmouseleave={handleMouseLeave}
  role="navigation"
  aria-label="Sidebar"
>
  <div class="h-full flex flex-col">
    <!-- Header with tabs -->
    <div
      class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-zinc-800 flex-shrink-0"
    >
      <h2 class="text-lg font-semibold text-gray-900 dark:text-zinc-100">
        Textly
      </h2>
      <button
        onclick={toggleSidebar}
        class="text-gray-500 hover:text-gray-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        title="Close Sidebar"
        aria-label="Close Sidebar"
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

    <!-- Scrollable Content Area -->
    <div class="flex-1 overflow-y-auto">
      <div class="p-4 h-full flex flex-col space-y-6">
                  <!-- Documents Section -->
        {#if isLoggedIn}
          <div class="border-b border-gray-200 dark:border-zinc-800 pb-4">
            <h3
              class="text-sm font-medium text-gray-700 dark:text-zinc-300 mb-3"
            >
              Documents
            </h3>
            <div class="space-y-2">
              <!-- Folder Tree Component -->
              <FolderTree
                onDocumentSelect={handleDocumentSelect}
                onFolderSelect={() => {}}
              />
            </div>
          </div>
        {/if}

        <!-- View Mode Section -->
        <div>
          <h3 class="text-sm font-medium text-gray-700 dark:text-zinc-300 mb-3">
            View Mode
          </h3>
          <div class="space-y-2">
            <button
              class="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded transition-all
                     {viewMode === 'split'
                ? 'bg-blue-600 text-white'
                : 'text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800'}"
              onclick={() => onViewModeChange("split")}
              title="Split View (Ctrl+2)"
              aria-label="Split View"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="currentColor"
              >
                <path d="M6 2h4v12H6V2zm-1 0H1v12h4V2zm7 0v12h4V2h-4z" />
              </svg>
              Split View
            </button>

            <button
              class="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded transition-all
                     {viewMode === 'editor'
                ? 'bg-blue-600 text-white'
                : 'text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800'}"
              onclick={() => onViewModeChange("editor")}
              title="Editor Only (Ctrl+1)"
              aria-label="Editor Only"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="currentColor"
              >
                <path d="M2 3h12v10H2V3zm1 1v8h10V4H3z" />
              </svg>
              Editor Only
            </button>

            <button
              class="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded transition-all
                     {viewMode === 'preview'
                ? 'bg-blue-600 text-white'
                : 'text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800'}"
              onclick={() => onViewModeChange("preview")}
              title="Preview Only (Ctrl+3)"
              aria-label="Preview Only"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="currentColor"
              >
                <path
                  d="M2 2h12v2H2V2zm0 3h8v1H2V5zm0 2h8v1H2V7zm0 2h8v1H2V9zm0 2h8v1H2v-1z"
                />
              </svg>
              Preview Only
            </button>

            <button
              class="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded transition-all
                     {viewMode === 'focus'
                ? 'bg-blue-600 text-white'
                : 'text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800'}"
              onclick={() => onViewModeChange("focus")}
              title="Focus Mode (Ctrl+4)"
              aria-label="Focus Mode"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="currentColor"
              >
                <path
                  d="M8 2.5a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0V3.5H6a.5.5 0 0 1 0-1h2zM10 6a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 0 1H10.5V8a.5.5 0 0 1-1 0V6zM6 10a.5.5 0 0 1-.5.5H3a.5.5 0 0 1 0-1h2.5V8a.5.5 0 0 1 1 0v2zM10 10v1.5H8.5a.5.5 0 0 1 0-1H10z"
                />
              </svg>
              Focus Mode
            </button>
          </div>
        </div>

        <!-- Spacer to push content towards bottom -->
        <div class="flex-1"></div>

        <!-- Width Slider (only in focus mode) -->
        {#if viewMode === "focus" && currentWidth && onWidthChange}
          <div class="border-t border-gray-200 dark:border-zinc-800 pt-4">
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm font-medium text-gray-700 dark:text-zinc-300"
                >Content Width</span
              >
              <span class="text-xs font-medium text-blue-600 dark:text-blue-400"
                >{currentWidth}</span
              >
            </div>
            <input
              type="range"
              min="0"
              max="10"
              value={widthOptions.indexOf(currentWidth)}
              oninput={(e) => {
                const value = (e.target as HTMLInputElement).value;
                onWidthChange(widthOptions[parseInt(value)]);
              }}
              class="w-full h-1 bg-gray-200 dark:bg-zinc-600 rounded-lg appearance-none cursor-pointer slider"
            />
          </div>
        {/if}

        <!-- Settings Section -->
        <div class="border-t border-gray-200 dark:border-zinc-800 pt-4">
          <h3 class="text-sm font-medium text-gray-700 dark:text-zinc-300 mb-3">
            Settings
          </h3>
          <div class="space-y-2">
            <!-- Spellcheck Toggle -->
            <button
              class="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded transition-all
                     {isSpellcheckEnabled
                ? 'bg-blue-600 text-white'
                : 'text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800'}"
              onclick={onSpellcheckToggle}
              title="Toggle Spellcheck (Ctrl+S)"
              aria-label="Toggle Spellcheck"
              aria-pressed={isSpellcheckEnabled}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="currentColor"
              >
                <path
                  d="M11.93 8.5a4.02 4.02 0 0 1-7.86 0A4.02 4.02 0 0 1 8 4.5a4.02 4.02 0 0 1 3.93 4M8 5.5a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM14 2.5h-1v-1h-1v1H3v-1H2v1H1v1h1v11h1v1h9v-1h1v-1H3v-11h9v1h1v-1h1v-1z"
                />
                <path d="M8 7a1 1 0 1 1 0 2 1 1 0 0 1 0-2z" />
              </svg>
              Spellcheck
              <span class="ml-auto text-xs opacity-60">
                {isSpellcheckEnabled ? "ON" : "OFF"}
              </span>
            </button>

            <!-- Dark Mode Toggle -->
            <button
              class="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-all"
              onclick={toggleDarkMode}
              title="Toggle Dark Mode"
              aria-label="Toggle Dark Mode"
              aria-pressed={isDarkMode}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="currentColor"
                class="dark:hidden"
              >
                <path
                  d="M8 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 1A5 5 0 1 1 8 3a5 5 0 0 1 0 10zm.5-9.5h-1v-1h1v1zm0 11h-1v-1h1v1zm5-5.5v-1h-1v1h1zm-11 0v-1h-1v1h1z"
                />
              </svg>
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="currentColor"
                class="hidden dark:block"
              >
                <path
                  d="M6 .278a.768.768 0 0 1 .08.858 7.208 7.208 0 0 0-.878 3.46c0 4.021 3.278 7.277 7.318 7.277.527 0 1.04-.055 1.533-.16a.787.787 0 0 1 .81.316.733.733 0 0 1-.031.893A8.349 8.349 0 0 1 8.344 16C3.734 16 0 12.286 0 7.71 0 4.266 2.114 1.312 5.124.06A.752.752 0 0 1 6 .278z"
                />
              </svg>
              Dark Mode
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- User Section (Fixed at bottom) -->
    <div
      class="p-4 border-t border-gray-200 dark:border-zinc-800 flex-shrink-0"
    >
      <h3 class="text-sm font-medium text-gray-700 dark:text-zinc-300 mb-3">
        Account
      </h3>
      {#if isLoggedIn}
        <div class="space-y-2">
          <div class="px-3 py-2 bg-gray-100 dark:bg-zinc-800 rounded text-sm">
            <div class="text-gray-600 dark:text-zinc-400 text-xs">
              Signed in as
            </div>
            <div class="flex items-center justify-between">
              <div
                class="text-gray-900 dark:text-zinc-100 font-medium truncate"
              >
                {userEmail}
              </div>
              <button
                class="ml-2 p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-all"
                onclick={handleLogout}
                title="Sign Out"
                aria-label="Sign Out"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                >
                  <path
                    d="M10 12.5a.5.5 0 0 1-.5.5h-8a.5.5 0 0 1-.5-.5v-9a.5.5 0 0 1 .5-.5h8a.5.5 0 0 1 .5.5v2a.5.5 0 0 0 1 0v-2A1.5 1.5 0 0 0 9.5 2h-8A1.5 1.5 0 0 0 0 3.5v9A1.5 1.5 0 0 0 1.5 14h8a1.5 1.5 0 0 0 1.5-1.5v-2a.5.5 0 0 0-1 0v2z"
                  />
                  <path
                    d="M15.854 8.354a.5.5 0 0 0 0-.708l-3-3a.5.5 0 0 0-.708.708L14.293 7.5H5.5a.5.5 0 0 0 0 1h8.793l-2.147 2.146a.5.5 0 0 0 .708.708l3-3z"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      {:else}
        <button
          class="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all"
          onclick={handleLogin}
          title="Sign In"
          aria-label="Sign In"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path
              d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4zm-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 10 8 10c-2.29 0-3.516.68-4.168 1.332-.678.678-.83 1.418-.832 1.664h10z"
            />
          </svg>
          Sign In
        </button>
      {/if}
    </div>
  </div>
</div>

<!-- Overlay for mobile -->
{#if layoutState.isSidebarOpen}
  <button
    class="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden"
    onclick={toggleSidebar}
    tabindex="0"
    aria-label="Close sidebar"
  ></button>
{/if}

<!-- Document Command Palette -->
<DocumentCommandPalette
  isOpen={isCommandPaletteOpen}
  on:close={() => (isCommandPaletteOpen = false)}
  on:select={() => (isCommandPaletteOpen = false)}
/>
