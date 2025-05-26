<script lang="ts">
  import { browser } from "$app/environment";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { AuthorizationService } from "$lib/services/authorization/authorization.service";
  import { authStore } from "$lib/stores/auth.store";
  import { DocumentPicker } from "$lib/components/documents";
  import { currentDocument } from "$lib/stores/document.store";
  import { DocumentManagerService } from "$lib/services/documents";

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

  let isOpen = $state(false);
  let isHovering = $state(false);
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let isDocumentPickerOpen = $state(false);
  let isEditingTitle = $state(false);
  let editingTitle = $state('');

  // Auth state - only initialize in browser
  let authService: AuthorizationService | null = null;
  let documentManager: DocumentManagerService | null = null;

  // Use reactive auth store
  let authState = $derived($authStore);
  let isLoggedIn = $derived(authState.isLoggedIn);
  let userEmail = $derived(authState.user?.email || "");
  let activeDocument = $derived($currentDocument);

  // Width options array for the slider
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

  function toggleSidebar() {
    isOpen = !isOpen;
  }

  function handleMouseEnter() {
    isHovering = true;
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    if (!isOpen) {
      timeoutId = setTimeout(() => {
        if (isHovering) {
          isOpen = true;
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
        isOpen = false;
      }
    }, 500);
  }

  function toggleDarkMode() {
    if (browser && (window as any).toggleDarkMode) {
      (window as any).toggleDarkMode();
    }
  }

  async function handleLogout() {
    if (authService) {
      await authService.logout();
    }
    goto("/auth");
  }

  function handleLogin() {
    goto("/auth");
  }

  function startEditTitle() {
    if (activeDocument) {
      isEditingTitle = true;
      editingTitle = activeDocument.title || '';
    }
  }

  function cancelEditTitle() {
    isEditingTitle = false;
    editingTitle = '';
  }

  async function saveTitle() {
    if (!editingTitle.trim() || !activeDocument || !documentManager) return;

    try {
      await documentManager.updateTitle(editingTitle.trim());
      isEditingTitle = false;
      editingTitle = '';
    } catch (error) {
      console.error('Failed to update title:', error);
      // You could show an error message here
    }
  }

  onMount(() => {
    if (browser) {
      authService = AuthorizationService.getInstance();
      documentManager = DocumentManagerService.getInstance();
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  });
</script>

<!-- Sidebar Toggle Tab (subtle edge trigger) -->
{#if !isOpen}
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
         {isOpen ? 'translate-x-0' : '-translate-x-full'}"
  onmouseenter={handleMouseEnter}
  onmouseleave={handleMouseLeave}
  role="navigation"
  aria-label="Sidebar"
>
  <div class="p-4 h-full flex flex-col">
    <!-- Header with tabs -->
    <div
      class="flex items-center justify-between mb-4 border-b border-gray-200 dark:border-zinc-800 pb-4"
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

    <!-- Documents Section -->
    {#if isLoggedIn}
      <div class="p-4 border-b border-gray-200 dark:border-zinc-800">
        <h3 class="text-sm font-medium text-gray-700 dark:text-zinc-300 mb-3">
          Documents
        </h3>
        <div class="space-y-2">
          <!-- Current Document Display -->
          {#if activeDocument}
            <div class="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200 dark:border-blue-800 rounded-xl group transition-all duration-200 hover:shadow-md dark:hover:shadow-blue-900/20">
              {#if isEditingTitle}
                <!-- Editing Mode -->
                <div class="space-y-2">
                  <div class="flex items-center gap-2">
                    <input
                      bind:value={editingTitle}
                      placeholder="Document title..."
                      class="flex-1 text-sm font-medium bg-white dark:bg-zinc-800 border border-blue-300 dark:border-blue-600 rounded-lg px-3 py-2 text-blue-900 dark:text-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 shadow-sm"
                      onkeydown={(e: KeyboardEvent) => {
                        if (e.key === 'Enter') {
                          saveTitle();
                        } else if (e.key === 'Escape') {
                          cancelEditTitle();
                        }
                      }}
                    />
                  </div>
                  <div class="flex items-center justify-between">
                    <p class="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1">
                      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 712-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Editing document title
                    </p>
                    <div class="flex items-center gap-1">
                      <button
                        onclick={saveTitle}
                        class="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-800 rounded-md transition-colors duration-200"
                        title="Save (Enter)"
                      >
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                        </svg>
                      </button>
                      <button
                        onclick={cancelEditTitle}
                        class="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-800 rounded-md transition-colors duration-200"
                        title="Cancel (Escape)"
                      >
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              {:else}
                <!-- Display Mode -->
                <div class="flex items-start justify-between">
                  <div class="flex-1 min-w-0">
                    <button
                      ondblclick={startEditTitle}
                      class="text-left w-full transition-colors duration-200"
                      title="Double-click to rename"
                    >
                      <div class="flex items-center gap-2 mb-1">
                        <svg class="w-4 h-4 text-blue-500 dark:text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <p class="text-sm font-semibold text-blue-900 dark:text-blue-100 truncate group-hover:text-blue-700 dark:group-hover:text-blue-300">
                          {activeDocument.title || 'Untitled Document'}
                        </p>
                      </div>
                      <div class="flex items-center gap-2">
                        <div class="w-2 h-2 rounded-full bg-green-400 dark:bg-green-500 animate-pulse" title="Live document"></div>
                        <p class="text-xs text-blue-600 dark:text-blue-400">
                          Current document
                        </p>
                      </div>
                    </button>
                  </div>
                  <button
                    onclick={startEditTitle}
                    class="p-1.5 opacity-0 group-hover:opacity-100 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-800 rounded-md transition-all duration-200"
                    title="Rename document"
                  >
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                </div>
              {/if}
            </div>
          {/if}
          
          <!-- Document Picker Button -->
          <button
            class="w-full flex items-center gap-3 px-3 py-3 text-sm font-medium rounded-xl border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-200 group"
            onclick={() => isDocumentPickerOpen = true}
            title="Select or Create Document"
            aria-label="Select or Create Document"
          >
            <div class="w-8 h-8 rounded-lg bg-gray-100 dark:bg-zinc-700 flex items-center justify-center group-hover:bg-blue-100 dark:group-hover:bg-blue-900/50 transition-colors duration-200">
              <svg class="w-4 h-4 text-gray-600 dark:text-zinc-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <div class="flex-1 text-left">
              <div class="font-medium group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors duration-200">
                {activeDocument ? 'Switch Document' : 'Select Document'}
              </div>
              <div class="text-xs text-gray-500 dark:text-zinc-500">
                Browse and manage documents
              </div>
            </div>
            <svg class="w-4 h-4 text-gray-400 dark:text-zinc-600 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-all duration-200 group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    {/if}

    <!-- View Mode Section -->
    <div class="p-4 flex-1">
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
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
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
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
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
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
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
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path
              d="M8 2.5a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0V3.5H6a.5.5 0 0 1 0-1h2zM10 6a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 0 1H10.5V8a.5.5 0 0 1-1 0V6zM6 10a.5.5 0 0 1-.5.5H3a.5.5 0 0 1 0-1h2.5V8a.5.5 0 0 1 1 0v2zM10 10v1.5H8.5a.5.5 0 0 1 0-1H10z"
            />
          </svg>
          Focus Mode
        </button>
      </div>
    </div>

    <!-- Width Slider (only in focus mode) -->
    {#if viewMode === "focus" && currentWidth && onWidthChange}
      <div class="px-3 py-2">
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

    <div class="p-4 border-t border-gray-200 dark:border-zinc-800">
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
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
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
          aria-pressed={browser
            ? document.documentElement.classList.contains("dark")
            : false}
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

    <!-- User Section -->
    <div class="p-4 border-t border-gray-200 dark:border-zinc-800">
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
              <div class="text-gray-900 dark:text-zinc-100 font-medium truncate">
                {userEmail}
              </div>
              <button
                class="ml-2 p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-all"
                onclick={handleLogout}
                title="Sign Out"
                aria-label="Sign Out"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
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
{#if isOpen}
  <button
    class="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden"
    onclick={toggleSidebar}
    tabindex="0"
    aria-label="Close sidebar"
  ></button>
{/if}

<!-- Document Picker Modal -->
<DocumentPicker 
  isOpen={isDocumentPickerOpen} 
  on:close={() => isDocumentPickerOpen = false}
  on:select={async (event) => {
    try {
      const selectedDocument = event.detail;
      if (documentManager) {
        await documentManager.loadDocument(selectedDocument.id);
      }
      isDocumentPickerOpen = false;
    } catch (error) {
      console.error('Failed to load document:', error);
    }
  }}
/>
