<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { browser } from '$app/environment';
  import Modal from '$lib/components/ui/Modal.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Input from '$lib/components/ui/Input.svelte';
  import { DocumentService, type Document } from '$lib/services/documents';
  import { documents, isLoading, error, documentActions } from '$lib/stores/document.store';
  import { authStore } from '$lib/stores/auth.store';

  interface Props {
    isOpen: boolean;
  }

  let { isOpen = false }: Props = $props();

  const dispatch = createEventDispatcher();
  let documentService: DocumentService | null = null;
  let searchTerm = $state('');
  let isCreating = $state(false);
  let newDocumentTitle = $state('');
  let renamingDocumentId = $state<string | null>(null);
  let newTitle = $state('');
  let openDropdownId = $state<string | null>(null);

  // Reactive values
  let authState = $derived($authStore);
  let isLoggedIn = $derived(authState.isLoggedIn);
  let documentList = $derived($documents);
  let loading = $derived($isLoading);
  let errorMessage = $derived($error);

  // Filtered documents based on search
  let filteredDocuments = $derived(
    documentList.filter(doc => 
      doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.content.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  let dropdownPosition = $state({ top: 0, left: 0 });
  let dropdownTrigger: HTMLElement | null = null;

  function handleClose() {
    dispatch('close');
    resetState();
  }

  function resetState() {
    searchTerm = '';
    isCreating = false;
    newDocumentTitle = '';
    renamingDocumentId = null;
    newTitle = '';
    openDropdownId = null;
  }

  function handleDocumentSelect(document: Document) {
    dispatch('select', document);
    handleClose();
  }

  async function handleCreateNew() {
    if (!newDocumentTitle.trim()) return;

    try {
      documentActions.setLoading(true);
      const newDocument = await documentService!.createDocument(newDocumentTitle.trim());
      documentActions.addDocument(newDocument);
      dispatch('select', newDocument);
      handleClose();
    } catch (err) {
      documentActions.setError(err instanceof Error ? err.message : 'Failed to create document');
    } finally {
      documentActions.setLoading(false);
    }
  }

  async function handleRename(documentId: string) {
    if (!newTitle.trim()) return;

    try {
      documentActions.setLoading(true);
      const updatedDocument = await documentService!.updateDocument(documentId, { title: newTitle.trim() });
      documentActions.updateDocument(updatedDocument);
      renamingDocumentId = null;
      newTitle = '';
      openDropdownId = null;
    } catch (err) {
      documentActions.setError(err instanceof Error ? err.message : 'Failed to rename document');
    } finally {
      documentActions.setLoading(false);
    }
  }

  async function handleDelete(documentId: string) {
    const document = documentList.find(doc => doc.id === documentId);
    const documentTitle = document?.title || 'Untitled Document';
    
    // Create a custom confirmation dialog
    const shouldDelete = confirm(`⚠️ Delete Document\n\nAre you sure you want to permanently delete "${documentTitle}"?\n\nThis action cannot be undone and all content will be lost forever.`);
    
    if (!shouldDelete) {
      return;
    }

    try {
      documentActions.setLoading(true);
      await documentService!.deleteDocument(documentId);
      documentActions.removeDocument(documentId);
      openDropdownId = null;
      
      // Show success feedback
      console.log(`Document "${documentTitle}" deleted successfully`);
    } catch (err) {
      documentActions.setError(err instanceof Error ? err.message : 'Failed to delete document');
    } finally {
      documentActions.setLoading(false);
    }
  }

  function startRename(document: Document) {
    renamingDocumentId = document.id;
    newTitle = document.title || '';
    openDropdownId = null;
  }

  function cancelRename() {
    renamingDocumentId = null;
    newTitle = '';
  }

  function updateDropdownPosition(trigger: HTMLElement) {
    const rect = trigger.getBoundingClientRect();
    dropdownPosition = {
      top: rect.bottom + window.scrollY + 4,
      left: rect.right - 208 // 208px is the width of the dropdown (w-52 = 13rem = 208px)
    };
  }

  function toggleDropdown(documentId: string, event: MouseEvent) {
    const target = event.currentTarget as HTMLElement;
    if (openDropdownId === documentId) {
      openDropdownId = null;
    } else {
      openDropdownId = documentId;
      dropdownTrigger = target;
      updateDropdownPosition(target);
    }
  }

  // Update dropdown position on scroll
  $effect(() => {
    if (!browser || !openDropdownId || !dropdownTrigger) return;

    function handleScroll() {
      updateDropdownPosition(dropdownTrigger!);
    }

    window.addEventListener('scroll', handleScroll, true);
    return () => window.removeEventListener('scroll', handleScroll, true);
  });

  async function loadDocuments() {
    if (!isLoggedIn || !documentService) return;

    try {
      documentActions.setLoading(true);
      const docs = await documentService.getDocuments();
      documentActions.setDocuments(docs);
    } catch (err) {
      documentActions.setError(err instanceof Error ? err.message : 'Failed to load documents');
    } finally {
      documentActions.setLoading(false);
    }
  }

  function formatDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 24 * 7) {
      return date.toLocaleDateString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    }
  }

  function truncateContent(content: string, maxLength: number = 100): string {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  }

  // Focus action for auto-focusing input elements
  function focusOnMount(element: HTMLInputElement) {
    element.focus();
    element.select();
  }

  onMount(() => {
    if (browser) {
      documentService = DocumentService.getInstance();
    }
  });

  // Load documents when modal opens and user is logged in
  $effect(() => {
    if (isOpen && isLoggedIn && documentService) {
      loadDocuments();
    }
  });

  // Close dropdown when clicking outside
  $effect(() => {
    if (!browser || !openDropdownId) return;

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Element;
      if (!target.closest('.relative')) {
        openDropdownId = null;
      }
    }

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  });

  // Enhanced keyboard navigation
  $effect(() => {
    if (!browser || !isOpen) return;

    function handleKeydown(event: KeyboardEvent) {
      // Ctrl/Cmd + N: Create new document
      if ((event.ctrlKey || event.metaKey) && event.key === 'n') {
        event.preventDefault();
        if (!isCreating) {
          isCreating = true;
        }
        return;
      }

      // Escape: Close creation mode or dropdown
      if (event.key === 'Escape') {
        if (isCreating) {
          isCreating = false;
          newDocumentTitle = '';
          event.stopPropagation();
        } else if (openDropdownId) {
          openDropdownId = null;
          event.stopPropagation();
        } else if (renamingDocumentId) {
          cancelRename();
          event.stopPropagation();
        }
        return;
      }

      // Clear search with Ctrl/Cmd + K
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        searchTerm = '';
        const searchInput = document.querySelector('input[placeholder="Search documents..."]') as HTMLInputElement;
        searchInput?.focus();
        return;
      }
    }

    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  });
</script>

<Modal {isOpen} title="📄 Document Manager" size="lg" on:close={handleClose}>
  <div class="p-6">
    {#if !isLoggedIn}
      <div class="text-center py-8">
        <p class="text-gray-600 dark:text-zinc-400">Please sign in to access your documents.</p>
      </div>
    {:else}
      <!-- Search and Create Section -->
      <div class="mb-6 space-y-4">
        <!-- Search Input -->
        <div class="relative">
          <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg class="w-4 h-4 text-gray-400 dark:text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            bind:value={searchTerm}
            placeholder="Search documents..."
            class="w-full h-11 pl-10 pr-4 rounded-xl border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition-all duration-200 shadow-sm"
          />
          {#if searchTerm}
            <button
              onclick={() => searchTerm = ''}
              class="absolute inset-y-0 right-0 pr-3 flex items-center"
            >
              <svg class="w-4 h-4 text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          {/if}
        </div>

        <!-- Create New Document -->
        {#if isCreating}
          <div class="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border border-blue-200 dark:border-blue-800 rounded-xl animate-in slide-in-from-top-2 duration-200">
            <div class="flex items-center gap-2 mb-3">
              <div class="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                <svg class="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <div>
                <h4 class="font-medium text-gray-900 dark:text-zinc-100">Create New Document</h4>
                <p class="text-xs text-gray-600 dark:text-zinc-400">Start writing your new document</p>
              </div>
            </div>
            <div class="flex gap-3">
              <div class="flex-1">
                <input
                  bind:value={newDocumentTitle}
                  placeholder="Enter document title..."
                  class="w-full h-10 rounded-lg border border-blue-300 dark:border-blue-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm font-medium text-gray-900 dark:text-zinc-100 placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent shadow-sm"
                  onkeydown={(e: KeyboardEvent) => {
                    if (e.key === 'Enter') {
                      handleCreateNew();
                    } else if (e.key === 'Escape') {
                      isCreating = false;
                      newDocumentTitle = '';
                    }
                  }}
                  use:focusOnMount
                />
              </div>
              <button
                onclick={handleCreateNew}
                disabled={!newDocumentTitle.trim() || loading}
                class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm flex items-center gap-2 font-medium"
              >
                {#if loading}
                  <svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                {:else}
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                  </svg>
                {/if}
                Create
              </button>
              <button
                onclick={() => {
                  isCreating = false;
                  newDocumentTitle = '';
                }}
                class="px-4 py-2 bg-gray-100 dark:bg-zinc-700 text-gray-700 dark:text-zinc-300 rounded-lg hover:bg-gray-200 dark:hover:bg-zinc-600 transition-all duration-200 shadow-sm flex items-center gap-2 font-medium"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
                Cancel
              </button>
            </div>
          </div>
        {:else}
          <!-- Document Picker Button -->
          <button
            class="w-full flex items-center gap-3 px-3 py-3 text-sm font-medium rounded-xl border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-200 group"
            onclick={() => isCreating = true}
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
                {documentList.length > 0 ? 'Switch Document' : 'Select Document'}
              </div>
              <div class="text-xs text-gray-500 dark:text-zinc-500">
                Browse and manage documents
              </div>
            </div>
            <svg class="w-4 h-4 text-gray-400 dark:text-zinc-600 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-all duration-200 group-hover:translate-x-0.5 ml-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        {/if}
      </div>

      <!-- Error Message -->
      {#if errorMessage}
        <div class="mb-4 p-4 bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-950/30 dark:to-pink-950/30 border border-red-200 dark:border-red-800 rounded-xl animate-in slide-in-from-top-2 duration-200">
          <div class="flex items-start gap-3">
            <div class="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/50 flex items-center justify-center flex-shrink-0">
              <svg class="w-4 h-4 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div class="flex-1">
              <h4 class="text-red-800 dark:text-red-200 font-medium">Something went wrong</h4>
              <p class="text-red-700 dark:text-red-300 text-sm mt-1">{errorMessage}</p>
            </div>
            <button
              onclick={() => documentActions.setError(null)}
              class="text-red-400 dark:text-red-500 hover:text-red-600 dark:hover:text-red-300 transition-colors"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      {/if}

      <!-- Loading State -->
      {#if loading}
        <div class="flex flex-col items-center justify-center py-12">
          <div class="relative">
            <div class="w-12 h-12 rounded-full border-4 border-blue-100 dark:border-blue-900/30"></div>
            <div class="w-12 h-12 rounded-full border-4 border-blue-600 dark:border-blue-400 border-t-transparent animate-spin absolute top-0 left-0"></div>
          </div>
          <p class="mt-4 text-gray-600 dark:text-zinc-400 font-medium">Loading documents...</p>
          <p class="text-sm text-gray-500 dark:text-zinc-500">Please wait while we fetch your documents</p>
        </div>
      {:else if filteredDocuments.length === 0}
        <!-- Empty State -->
        <div class="text-center py-12">
          {#if searchTerm}
            <div class="space-y-4">
              <div class="w-16 h-16 mx-auto rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center">
                <svg class="w-8 h-8 text-gray-400 dark:text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <div>
                <p class="text-gray-700 dark:text-zinc-300 font-medium">No documents found</p>
                <p class="text-sm text-gray-500 dark:text-zinc-500 mt-1">No documents match "{searchTerm}"</p>
              </div>
              <button
                onclick={() => searchTerm = ''}
                class="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm font-medium"
              >
                Clear search
              </button>
            </div>
          {:else}
            <div class="space-y-6">
              <div class="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-950/50 dark:to-indigo-950/50 flex items-center justify-center">
                <svg class="w-10 h-10 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h3 class="text-lg font-semibold text-gray-900 dark:text-zinc-100">No documents yet</h3>
                <p class="text-gray-600 dark:text-zinc-400 mt-2">Create your first document to start writing and organizing your thoughts.</p>
              </div>
              <button
                onclick={() => isCreating = true}
                class="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors duration-200 font-medium shadow-lg hover:shadow-xl"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
                Create your first document
              </button>
            </div>
          {/if}
        </div>
      {:else}
        <!-- Documents List -->
        <div class="space-y-3 max-h-96 overflow-y-auto custom-scrollbar relative">
          {#each filteredDocuments as document (document.id)}
            <div class="relative rounded-xl border border-gray-200 dark:border-zinc-700 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md dark:hover:shadow-zinc-900/20 transition-all duration-200 group bg-white dark:bg-zinc-900/50 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 dark:hover:from-blue-950/20 dark:hover:to-indigo-950/20">
              {#if renamingDocumentId === document.id}
                <!-- Rename Mode -->
                <div class="p-4 animate-in slide-in-from-top-2 duration-200">
                  <div class="flex gap-3">
                    <div class="flex-1">
                      <input
                        bind:value={newTitle}
                        placeholder="Document title..."
                        class="w-full h-9 rounded-lg border border-blue-300 dark:border-blue-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm font-medium text-gray-900 dark:text-zinc-100 placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent shadow-sm"
                        onkeydown={(e: KeyboardEvent) => {
                          if (e.key === 'Enter') {
                            handleRename(document.id);
                          } else if (e.key === 'Escape') {
                            cancelRename();
                          }
                        }}
                        use:focusOnMount
                      />
                    </div>
                    <button
                      onclick={() => handleRename(document.id)}
                      disabled={!newTitle.trim() || loading}
                      class="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 shadow-sm flex items-center gap-1"
                    >
                      {#if loading}
                        <svg class="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      {:else}
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                        </svg>
                      {/if}
                      Save
                    </button>
                    <button
                      onclick={cancelRename}
                      class="px-3 py-1.5 text-xs font-medium bg-gray-100 dark:bg-zinc-700 text-gray-700 dark:text-zinc-300 rounded-lg hover:bg-gray-200 dark:hover:bg-zinc-600 transition-colors duration-200 shadow-sm flex items-center gap-1"
                    >
                      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Cancel
                    </button>
                  </div>
                </div>
              {:else}
                <!-- Normal Mode -->
                <div class="flex items-center">
                  <div
                    onclick={() => handleDocumentSelect(document)}
                    class="flex-1 text-left p-4 rounded-l-xl transition-colors duration-200 cursor-pointer"
                  >
                    <div class="flex items-start justify-between">
                      <div class="flex-1 min-w-0 pr-3">
                        <div class="flex items-center gap-2 mb-1">
                          <svg class="w-4 h-4 text-blue-500 dark:text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <h3 class="font-semibold text-gray-900 dark:text-zinc-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-200">
                            {document.title || 'Untitled Document'}
                          </h3>
                        </div>
                        {#if document.content}
                          <p class="text-sm text-gray-600 dark:text-zinc-400 mt-1.5 line-clamp-2 leading-relaxed">
                            {truncateContent(document.content, 120)}
                          </p>
                        {:else}
                          <p class="text-sm italic text-gray-400 dark:text-zinc-500 mt-1.5">
                            Empty document
                          </p>
                        {/if}
                        <div class="flex items-center gap-3 mt-3">
                          <p class="text-xs text-gray-500 dark:text-zinc-500 flex items-center gap-1">
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {formatDate(document.updated)}
                          </p>
                          <div class="w-2 h-2 rounded-full bg-green-400 dark:bg-green-500" title="Synced"></div>
                        </div>
                      </div>
                      <div class="flex items-center gap-2">
                        <svg class="w-5 h-5 text-gray-300 dark:text-zinc-600 group-hover:text-blue-500 dark:group-hover:text-blue-400 flex-shrink-0 transition-all duration-200 group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                        </svg>
                        <button
                          onclick={(e) => {
                            e.stopPropagation();
                            toggleDropdown(document.id, e);
                          }}
                          class="p-3 m-1 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-700/70 transition-all duration-200 opacity-0 group-hover:opacity-100 focus:opacity-100"
                          title="More options"
                        >
                          <svg class="w-4 h-4 text-gray-500 dark:text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zM12 13a1 1 0 110-2 1 1 0 010 2zM12 20a1 1 0 110-2 1 1 0 010 2z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    {/if}
  </div>
</Modal>

{#if openDropdownId && dropdownTrigger}
  <div
    class="fixed w-52 bg-white dark:bg-zinc-800 rounded-xl shadow-xl border border-gray-200 dark:border-zinc-700 z-[100] animate-in slide-in-from-top-2 duration-200"
    style="top: {dropdownPosition.top}px; left: {dropdownPosition.left}px;"
  >
    <div class="py-2">
      <button
        onclick={() => startRename(documentList.find(d => d.id === openDropdownId)!)}
        class="w-full text-left px-4 py-3 text-sm text-gray-700 dark:text-zinc-300 hover:bg-blue-50 dark:hover:bg-blue-950/30 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-3 transition-colors duration-200 group/item"
      >
        <div class="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950/50 flex items-center justify-center group-hover/item:bg-blue-200 dark:group-hover/item:bg-blue-900/50 transition-colors duration-200">
          <svg class="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </div>
        <div>
          <div class="font-medium">Rename</div>
          <div class="text-xs text-gray-500 dark:text-zinc-500">Change document title</div>
        </div>
      </button>
      <div class="h-px bg-gray-100 dark:bg-zinc-700 mx-2 my-1"></div>
      <button
        onclick={() => handleDelete(openDropdownId!)}
        class="w-full text-left px-4 py-3 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-700 dark:hover:text-red-300 flex items-center gap-3 transition-colors duration-200 group/item"
      >
        <div class="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-950/50 flex items-center justify-center group-hover/item:bg-red-200 dark:group-hover/item:bg-red-900/50 transition-colors duration-200">
          <svg class="w-4 h-4 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </div>
        <div>
          <div class="font-medium">Delete</div>
          <div class="text-xs text-gray-500 dark:text-zinc-500">Permanently remove</div>
        </div>
      </button>
    </div>
  </div>
{/if}

<style>
  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .custom-scrollbar {
    scrollbar-width: thin;
    scrollbar-color: rgb(203 213 225) transparent;
  }

  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
  }

  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
    border-radius: 3px;
  }

  .custom-scrollbar::-webkit-scrollbar-thumb {
    background-color: rgb(203 213 225);
    border-radius: 3px;
  }

  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background-color: rgb(156 163 175);
  }

  .dark .custom-scrollbar {
    scrollbar-color: rgb(63 63 70) transparent;
  }

  .dark .custom-scrollbar::-webkit-scrollbar-thumb {
    background-color: rgb(63 63 70);
  }

  .dark .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background-color: rgb(82 82 91);
  }

  @keyframes slide-in-from-top-2 {
    from {
      opacity: 0;
      transform: translateY(-8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .animate-in {
    animation-fill-mode: both;
  }

  .slide-in-from-top-2 {
    animation-name: slide-in-from-top-2;
  }

  .duration-200 {
    animation-duration: 200ms;
  }
</style> 