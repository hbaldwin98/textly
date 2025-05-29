<script lang="ts">
  import { onMount, createEventDispatcher } from "svelte";
  import { DocumentService, type Document } from "$lib/services/documents";
  import { DocumentManagerService } from "$lib/services/documents";
  import {
    documents,
    isLoading,
    error,
    documentActions,
  } from "$lib/stores/document.store";
  import { authStore } from "$lib/stores/auth.store";

  interface Props {
    isOpen: boolean;
  }

  let { isOpen = false }: Props = $props();

  const dispatch = createEventDispatcher();
  let documentService: DocumentService | null = null;
  let documentManager: DocumentManagerService | null = null;
  let searchTerm = $state("");
  let selectedIndex = $state(0);
  let searchInput = $state<HTMLInputElement>();
  let resultsContainer = $state<HTMLDivElement>();
  let isCreating = $state(false);

  // Reactive values
  let authState = $derived($authStore);
  let isLoggedIn = $derived(authState.isLoggedIn);
  let documentList = $derived($documents);
  let loading = $derived($isLoading);

  // Filtered documents based on search (only title)
  let filteredDocuments = $derived(
    documentList.filter((doc) =>
      !doc.is_folder && doc.title.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  // Calculate total selectable items (always include create option)
  let totalSelectableItems = $derived(filteredDocuments.length + 1);
  let createOptionTitle = $derived(searchTerm.trim() || "New Document");

  onMount(() => {
    documentService = DocumentService.getInstance();
    documentManager = DocumentManagerService.getInstance();
  });

  function handleClose() {
    dispatch("close");
    resetState();
  }

  function resetState() {
    searchTerm = "";
    selectedIndex = 0;
    isCreating = false;
  }

  async function handleDocumentSelect(document: Document) {
    if (!documentManager) return;

    try {
      await documentManager.loadDocument(document.id);
      dispatch("select", document);
      handleClose();
    } catch (err) {
      documentActions.setError(
        err instanceof Error ? err.message : "Failed to load document"
      );
    }
  }

  async function handleCreateDocument() {
    if (!documentManager) return;

    try {
      isCreating = true;
      const newDoc = await documentManager.createDocument(createOptionTitle);
      // DocumentManager already adds the document to the store, so we don't need to do it manually
      dispatch("select", newDoc);
      handleClose();
    } catch (err) {
      documentActions.setError(
        err instanceof Error ? err.message : "Failed to create document"
      );
    } finally {
      isCreating = false;
    }
  }

  async function loadDocumentTitles() {
    if (!documentService) return;
    try {
      documentActions.setLoading(true);
      const docs = await documentService.getDocumentTitles();
      // Cast to full Document type since the UI only needs title and dates
      documentActions.setDocuments(docs as Document[]);
    } catch (err) {
      documentActions.setError(
        err instanceof Error ? err.message : "Failed to load documents"
      );
    } finally {
      documentActions.setLoading(false);
    }
  }

  function formatDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } else if (diffInHours < 24 * 7) {
      return date.toLocaleDateString([], {
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
    } else {
      return date.toLocaleDateString([], {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }
  }

  function scrollToSelected() {
    if (!resultsContainer) return;

    const selectedElement = resultsContainer.querySelector(
      `[data-index="${selectedIndex}"]`
    ) as HTMLElement;
    if (selectedElement) {
      selectedElement.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }

  // Focus input when palette opens
  $effect(() => {
    if (isOpen && searchInput) {
      searchInput.focus();
      selectedIndex = 0;
    }
  });

  // Load documents when palette opens and user is logged in
  $effect(() => {
    if (isOpen && isLoggedIn) {
      loadDocumentTitles();
    }
  });

  // Keyboard navigation
  $effect(() => {
    if (!isOpen) return;

    function handleKeydown(event: KeyboardEvent) {
      switch (event.key) {
        case "Escape":
          event.preventDefault();
          handleClose();
          break;
        case "ArrowDown":
          event.preventDefault();
          selectedIndex = Math.min(selectedIndex + 1, totalSelectableItems - 1);
          scrollToSelected();
          break;
        case "ArrowUp":
          event.preventDefault();
          selectedIndex = Math.max(selectedIndex - 1, 0);
          scrollToSelected();
          break;
        case "Enter":
          event.preventDefault();
          if (selectedIndex === filteredDocuments.length) {
            // Selected the "create new" option
            handleCreateDocument();
          } else if (filteredDocuments[selectedIndex]) {
            handleDocumentSelect(filteredDocuments[selectedIndex]);
          }
          break;
        case "Tab":
          event.preventDefault();
          // Jump to create option
          selectedIndex = filteredDocuments.length;
          scrollToSelected();
          break;
      }
    }

    document.addEventListener("keydown", handleKeydown);
    return () => document.removeEventListener("keydown", handleKeydown);
  });

  // Reset selection when search changes
  $effect(() => {
    // Only reset when search term changes, not when other reactive values change
    searchTerm;
    selectedIndex = 0;
  });
</script>

{#if isOpen}
  <!-- Backdrop -->
  <div
    class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 animate-in fade-in duration-200"
    onclick={handleClose}
  ></div>

  <!-- Command Palette -->
  <div
    class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg mx-4 bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-gray-200 dark:border-zinc-700 z-50 animate-in zoom-in-95 duration-200"
  >
    <!-- Header -->
    <div class="px-4 py-3 border-b border-gray-200 dark:border-zinc-700">
      <div class="flex items-center gap-3">
        <div
          class="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center"
        >
          <svg
            class="w-3 h-3 text-blue-600 dark:text-blue-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
        <input
          bind:this={searchInput}
          bind:value={searchTerm}
          placeholder="Search by title..."
          class="flex-1 bg-transparent text-gray-900 dark:text-zinc-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none text-sm"
        />
        <kbd
          class="px-2 py-1 text-xs font-mono bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 rounded border"
          >ESC</kbd
        >
      </div>
    </div>

    <!-- Results -->
    <div bind:this={resultsContainer} class="max-h-80 overflow-y-auto">
      {#if !isLoggedIn}
        <div class="p-6 text-center">
          <p class="text-gray-600 dark:text-zinc-400">
            Please sign in to access your documents.
          </p>
        </div>
      {:else if loading}
        <div class="p-6 text-center">
          <div
            class="w-6 h-6 mx-auto rounded-full border-2 border-blue-600 dark:border-blue-400 border-t-transparent animate-spin"
          ></div>
          <p class="mt-2 text-sm text-gray-600 dark:text-zinc-400">
            Loading documents...
          </p>
        </div>
      {:else}
        <!-- Documents List -->
        {#if filteredDocuments.length > 0}
          <div class="py-2">
            {#each filteredDocuments as document, index (document.id)}
              <button
                data-index={index}
                class="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors duration-150 flex items-center justify-between group {index ===
                selectedIndex
                  ? 'bg-blue-50 dark:bg-blue-950/30 border-l-2 border-blue-500 dark:border-blue-400'
                  : ''}"
                onclick={() => handleDocumentSelect(document)}
              >
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <svg
                      class="w-4 h-4 text-blue-500 dark:text-blue-400 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    <span
                      class="font-medium text-gray-900 dark:text-zinc-100 truncate {index ===
                      selectedIndex
                        ? 'text-blue-900 dark:text-blue-100'
                        : ''}"
                    >
                      {document.title || "Untitled Document"}
                    </span>
                  </div>
                  <p
                    class="text-xs text-gray-500 dark:text-zinc-500 mt-0.5 ml-6"
                  >
                    Updated {formatDate(document.updated)}
                  </p>
                </div>
                <svg
                  class="w-4 h-4 text-gray-300 dark:text-zinc-600 group-hover:text-blue-500 dark:group-hover:text-blue-400 flex-shrink-0 transition-colors {index ===
                  selectedIndex
                    ? 'text-blue-500 dark:text-blue-400'
                    : ''}"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            {/each}
          </div>
        {:else}
          <!-- Empty State -->
          <div class="p-4 text-center">
            {#if searchTerm}
              <p class="text-gray-600 dark:text-zinc-400 text-sm">
                No documents match "{searchTerm}"
              </p>
            {:else}
              <p class="text-gray-600 dark:text-zinc-400 text-sm">
                No documents found
              </p>
            {/if}
          </div>
        {/if}
      {/if}
    </div>

    <!-- Create New Document Option (Always Visible) -->
    {#if isLoggedIn && !loading}
      <div class="border-t border-gray-200 dark:border-zinc-700">
        <button
          data-index={filteredDocuments.length}
          class="w-full text-left px-4 py-2 hover:bg-green-50 dark:hover:bg-green-950/30 transition-colors duration-150 flex items-center justify-between group {selectedIndex ===
          filteredDocuments.length
            ? 'bg-green-50 dark:bg-green-950/30 border-l-2 border-green-500 dark:border-green-400'
            : ''}"
          onclick={handleCreateDocument}
          disabled={isCreating}
        >
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              {#if isCreating}
                <div
                  class="w-4 h-4 rounded-full border-2 border-green-600 dark:border-green-400 border-t-transparent animate-spin flex-shrink-0"
                ></div>
              {:else}
                <svg
                  class="w-4 h-4 text-green-500 dark:text-green-400 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 4v16m8-8H4"
                  />
                </svg>
              {/if}
              <span
                class="font-medium truncate {selectedIndex ===
                filteredDocuments.length
                  ? 'text-green-900 dark:text-green-100'
                  : 'text-green-700 dark:text-green-300'}"
              >
                Create "{createOptionTitle}"
              </span>
            </div>
          </div>
          <svg
            class="w-4 h-4 text-green-300 dark:text-green-600 group-hover:text-green-500 dark:group-hover:text-green-400 flex-shrink-0 transition-colors {selectedIndex ===
            filteredDocuments.length
              ? 'text-green-500 dark:text-green-400'
              : ''}"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 4v16m8-8H4"
            />
          </svg>
        </button>
      </div>
    {/if}

    <!-- Footer -->
    <div
      class="px-4 py-2 border-t border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800/50 rounded-b-xl"
    >
      <div
        class="flex items-center justify-between text-xs text-gray-500 dark:text-zinc-500"
      >
        <div class="flex items-center gap-3">
          <div class="flex items-center gap-1">
            <kbd
              class="px-1.5 py-0.5 font-mono bg-white dark:bg-zinc-700 rounded border text-[10px]"
              >↑↓</kbd
            >
            <span>navigate</span>
          </div>
          <div class="flex items-center gap-1">
            <kbd
              class="px-1.5 py-0.5 font-mono bg-white dark:bg-zinc-700 rounded border text-[10px]"
              >↵</kbd
            >
            <span>select</span>
          </div>
          <div class="flex items-center gap-1">
            <kbd
              class="px-1.5 py-0.5 font-mono bg-white dark:bg-zinc-700 rounded border text-[10px]"
              >Tab</kbd
            >
            <span>jump to create</span>
          </div>
        </div>
        <span
          >{filteredDocuments.length}
          {filteredDocuments.length === 1 ? "result" : "results"}</span
        >
      </div>
    </div>
  </div>
{/if}

<style>
  @keyframes zoom-in-95 {
    from {
      opacity: 0;
      transform: translate(-50%, -50%) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translate(-50%, -50%) scale(1);
    }
  }

  @keyframes fade-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .animate-in {
    animation-fill-mode: both;
  }

  .zoom-in-95 {
    animation-name: zoom-in-95;
  }

  .fade-in {
    animation-name: fade-in;
  }

  .duration-200 {
    animation-duration: 200ms;
  }
</style>
