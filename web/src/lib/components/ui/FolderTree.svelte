<script lang="ts">
  import { onMount } from "svelte";
  import {
    FolderService,
    type FolderTreeNode,
  } from "$lib/services/documents/folder.service";
  import { DocumentManagerService } from "$lib/services/documents/document-manager.service";
  import type { Document } from "$lib/services/documents/document.service";
  import { currentDocument } from "$lib/stores/document.store";
  import { get } from "svelte/store";

  export let currentFolderId: string | null = null;
  export let onDocumentSelect: (document: Document) => void = () => {};
  export let onFolderSelect: (folderId: string | null) => void = () => {};

  let folderService = FolderService.getInstance();
  let documentManager = DocumentManagerService.getInstance();
  let folderTree: FolderTreeNode[] = [];
  let breadcrumbs: Document[] = [];
  let loadingFolders = true;
  let folderError: string | null = null;
  let expandedFolders: string[] = [];
  let flattenedTree: Array<FolderTreeNode & { depth: number }> = [];
  let currentDoc: Document | null = null;
  let unsubscribe: () => void;

  // Subscribe to the current document store
  onMount(() => {
    // Subscribe to current document changes
    unsubscribe = currentDocument.subscribe((doc) => {
      currentDoc = doc;
      if (doc && folderTree.length > 0) {
        expandParentFolders(doc);
      }
    });

    // Load data
    loadFolderTree().then(() => {
      // Expand parent folders of current document if it exists
      if (currentDoc) {
        expandParentFolders(currentDoc);
      }
    });
    loadBreadcrumbs();
    
    // Add global event listeners
    window.addEventListener('click', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    
    // Return cleanup function
    return () => {
      window.removeEventListener('click', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
      if (unsubscribe) unsubscribe();
    };
  });

  // Function to expand parent folders of a document
  async function expandParentFolders(doc: Document) {
    if (!doc.parent) return; // No parent to expand
    
    try {
      const path = await folderService.getBreadcrumbs(doc.parent);
      const folderIds = path.map(d => d.id);
      expandedFolders = [...new Set([...expandedFolders, ...folderIds])];
    } catch {
      // Silently ignore errors since this is non-critical functionality
    }
  }

  // Context menu state
  let contextMenuVisible = false;
  let contextMenuX = 0;
  let contextMenuY = 0;
  let contextMenuTarget: Document | null = null;

  // Modal states
  let showCreateFolderModal = false;
  let showRenameModal = false;
  let newFolderName = "";
  let renameName = "";

  // Drag and drop state
  let draggedItem: Document | null = null;
  let dragOverItem: Document | null = null;
  let isDragging = false;
  let dragOverOutside = false;
  let dragPosition: 'top' | 'bottom' | null = null;

  // Add click outside handler for context menu
  function handleClickOutside(event: MouseEvent) {
    if (contextMenuVisible) {
      const target = event.target as HTMLElement;
      if (!target.closest('.context-menu')) {
        hideContextMenu();
      }
    }
  }

  // Add escape key handler for context menu
  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      hideContextMenu();
    }
  }

  async function loadFolderTree() {
    try {
      loadingFolders = true;
      folderTree = await folderService.getFolderTree();
    } catch (err) {
      console.error("FolderTree: Error loading folder tree:", err);
      folderError = err instanceof Error ? err.message : "Failed to load folders";
    } finally {
      loadingFolders = false;
    }
  }

  async function loadBreadcrumbs() {
    try {
      breadcrumbs = await folderService.getBreadcrumbs(currentFolderId);
    } catch (err) {
      console.error("Failed to load breadcrumbs:", err);
    }
  }

  function toggleFolder(folderId: string, event?: MouseEvent) {
    if (event) {
      event.stopPropagation();
    }
    
    const isCurrentlyExpanded = expandedFolders.includes(folderId);
    
    if (isCurrentlyExpanded) {
      expandedFolders = expandedFolders.filter(id => id !== folderId);
    } else {
      expandedFolders = [...expandedFolders, folderId];
    }
  }

  function handleDocumentSelect(document: Document) {
    if (document.is_folder) {
      currentFolderId = document.id;
      onFolderSelect(document.id);
      loadBreadcrumbs();
    } else {
      onDocumentSelect(document);
    }
  }

  function handleRightClick(event: MouseEvent, document: Document) {
    event.preventDefault();
    contextMenuTarget = document;
    contextMenuX = event.clientX;
    contextMenuY = event.clientY;
    contextMenuVisible = true;
  }

  function hideContextMenu() {
    contextMenuVisible = false;
    contextMenuTarget = null;
  }

  async function createFolder() {
    if (newFolderName.trim()) {
      try {
        // Create a root folder (no parent)
        await documentManager.createFolder(newFolderName.trim());
        await loadFolderTree();
        newFolderName = "";
        showCreateFolderModal = false;
      } catch (err) {
        folderError = err instanceof Error ? err.message : "Failed to create folder";
      }
    }
  }

  async function createDocument() {
    try {
      const document = await documentManager.createDocument(
        "New Document",
        "",
        currentFolderId || undefined
      );
      onDocumentSelect(document);
      await loadFolderTree();
    } catch (err) {
      folderError = err instanceof Error ? err.message : "Failed to create document";
    }
  }

  async function renameItem() {
    if (renameName.trim() && contextMenuTarget) {
      try {
        await documentManager.updateTitle(contextMenuTarget.id, renameName.trim());
        await loadFolderTree();
        showRenameModal = false;
        renameName = "";
      } catch (err) {
        folderError = err instanceof Error ? err.message : "Failed to rename item";
      }
    }
  }

  $: flattenedTree = folderTree && renderTreeNode(folderTree, 0, expandedFolders);

  function renderTreeNode(nodes: FolderTreeNode[], depth = 0, expanded: string[] = []): Array<FolderTreeNode & { depth: number }> {
    if (!nodes) return [];
    
    const result: Array<FolderTreeNode & { depth: number }> = [];
    
    nodes.forEach((node) => {
      // Add the current node
      result.push({
        ...node,
        depth,
        children: node.children
      });

      // If expanded and has children, recursively add children
      if (expanded.includes(node.document.id) && node.children && node.children.length > 0) {
        const childNodes = renderTreeNode(node.children, depth + 1, expanded);
        result.push(...childNodes);
      }
    });

    return result;
  }

  async function handleDelete(event: MouseEvent, document: Document) {
    event.stopPropagation();
    if (confirm(`Are you sure you want to delete "${document.title}"?`)) {
      try {
        await documentManager.deleteDocument(document.id);
        await loadFolderTree();
      } catch (err) {
        folderError = err instanceof Error ? err.message : "Failed to delete item";
      }
    }
  }

  function handleDragStart(event: DragEvent, document: Document) {
    if (!event.dataTransfer) return;
    draggedItem = document;
    isDragging = true;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/json", JSON.stringify({
      id: document.id,
      is_folder: document.is_folder
    }));
  }

  function handleDragEnd(event: DragEvent) {
    isDragging = false;
    draggedItem = null;
    dragOverItem = null;
    dragOverOutside = false;
    dragPosition = null;
  }

  function handleDragOver(event: DragEvent, document: Document | null = null) {
    event.preventDefault();
    event.stopPropagation();

    try {
      if (!event.dataTransfer) return;
      const data = event.dataTransfer.getData("application/json");
      if (!data) return;
      
      const dragData = JSON.parse(data);
      if (!dragData.id) return;

      if (document) {
        if (dragData.id === document.id) {
          dragOverItem = null;
          dragPosition = null;
          return;
        }

        // Clear position indicator when dragging over any item
        dragPosition = null;
        dragOverItem = document;
        dragOverOutside = false;
      } else {
        dragOverItem = null;
        dragOverOutside = true;
        dragPosition = 'bottom';
      }
    } catch (err) {
      console.error("Error in drag over:", err);
    }
  }

  function handleDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    
    const target = event.target as HTMLElement;
    const relatedTarget = event.relatedTarget as HTMLElement;
    
    if (!target?.contains(relatedTarget)) {
      dragOverItem = null;
      dragOverOutside = false;
    }
  }

  async function handleDrop(event: DragEvent, targetDocument: Document | null = null) {
    event.preventDefault();
    event.stopPropagation();

    try {
      if (!event.dataTransfer) return;
      const data = event.dataTransfer.getData("application/json");
      if (!data) return;
      
      const dragData = JSON.parse(data);
      if (!dragData.id) return;

      // Find the dragged document in the tree
      const allNodes = flattenedTree || [];
      const draggedDoc = allNodes.find(node => node.document.id === dragData.id)?.document;
      if (!draggedDoc) return;

      // Silently ignore drops onto the same item
      if (targetDocument?.id === draggedDoc.id) {
        return;
      }

      if (targetDocument) {
        const canMove = await folderService.canMoveToFolder(draggedDoc.id, targetDocument.id);
        if (!canMove) {
          return;
        }
      }

      await folderService.moveToFolder(draggedDoc.id, targetDocument?.id || null);
      await loadFolderTree();
    } catch (err) {
      folderError = err instanceof Error ? err.message : "Failed to move item";
    } finally {
      draggedItem = null;
      dragOverItem = null;
      dragOverOutside = false;
      isDragging = false;
    }
  }
</script>

<!-- Folder Tree Actions -->
<div class="flex items-center gap-2 mb-3">
  <button
    class="flex-1 flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-200"
    onclick={() => (showCreateFolderModal = true)}
    title="New Folder"
    aria-label="New Folder"
  >
    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M12 6v6m0 0v6m0-6h6m-6 0H6"
      />
    </svg>
    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
      />
    </svg>
  </button>
  <button
    class="flex-1 flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-200"
    onclick={createDocument}
    title="New Document"
    aria-label="New Document"
  >
    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M12 6v6m0 0v6m0-6h6m-6 0H6"
      />
    </svg>
    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  </button>
</div>

<!-- Folder Tree -->
{#if folderError}
  <div
    class="p-3 mb-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
  >
    <p class="text-sm text-red-600 dark:text-red-400">{folderError}</p>
    <button
      class="mt-2 text-xs text-red-500 dark:text-red-400 hover:underline"
      onclick={() => {
        folderError = null;
        loadFolderTree();
      }}
    >
      Retry
    </button>
  </div>
{/if}

{#if loadingFolders}
  <div
    class="flex items-center justify-center py-8 text-gray-500 dark:text-zinc-500"
  >
    <svg class="animate-spin w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24">
      <circle
        class="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        stroke-width="4"
      ></circle>
      <path
        class="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      ></path>
    </svg>
    Loading documents...
  </div>
{:else if folderTree.length === 0}
  <div class="text-center py-8 text-gray-500 dark:text-zinc-500">
    <svg
      class="w-8 h-8 mx-auto mb-2"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 712-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
    <p class="text-sm">No documents yet</p>
    <p class="text-xs mt-1">Create your first document or folder</p>
  </div>
{:else}
  <div 
    class="folder-tree-container max-h-64 overflow-y-auto relative p-1"
    ondragover={(e) => handleDragOver(e)}
    ondrop={(e) => handleDrop(e)}
    role="tree"
    tabindex="0"
  >
    {#if dragOverOutside}
      <div class="absolute inset-x-2 bottom-0 h-0.5 bg-blue-500"></div>
    {/if}

    {#each flattenedTree as node}
      <div
        class="flex items-center gap-2 px-2 py-1 text-sm rounded cursor-pointer transition-all duration-200 hover:bg-gray-100 dark:hover:bg-zinc-800 group relative {dragOverItem?.id === node.document.id ? 'bg-blue-50 dark:bg-blue-900 border-2 border-blue-300 dark:border-blue-600 border-dashed' : ''} {currentDoc?.id === node.document.id ? 'bg-blue-100 dark:bg-blue-900/50' : ''}"
        style="padding-left: {8 + node.depth * 12}px"
        draggable="true"
        ondragstart={(e) => handleDragStart(e, node.document)}
        ondragend={handleDragEnd}
        ondragover={(e) => handleDragOver(e, node.document)}
        ondragleave={handleDragLeave}
        ondrop={(e) => handleDrop(e, node.document)}
        onclick={() => handleDocumentSelect(node.document)}
        oncontextmenu={(e) => handleRightClick(e, node.document)}
        onkeydown={() => handleDocumentSelect(node.document)}
        tabindex="0"
        role="treeitem"
        aria-selected={currentDoc?.id === node.document.id}
        aria-level={node.depth + 1}
        aria-setsize={flattenedTree.length}
      >
        <!-- Drag indicators (only for non-folders) -->
        {#if dragOverItem?.id === node.document.id && !node.document.is_folder}
          {#if dragPosition === 'top'}
            <div class="absolute inset-x-2 -top-0.5 h-0.5 bg-blue-500"></div>
          {:else if dragPosition === 'bottom'}
            <div class="absolute inset-x-2 -bottom-0.5 h-0.5 bg-blue-500"></div>
          {/if}
        {/if}

        <!-- Node content -->
        {#if node.children.length > 0}
          <button
            class="flex-shrink-0 w-4 h-4 flex items-center justify-center text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200"
            onclick={(e) => toggleFolder(node.document.id, e)}
          >
            {#if expandedFolders.includes(node.document.id)}
              <svg
                class="w-3 h-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            {:else}
              <svg
                class="w-3 h-3"
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
            {/if}
          </button>
        {:else}
          <div class="w-4 h-4 flex-shrink-0"></div>
        {/if}
        {#if node.document.is_folder}
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
              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
            />
          </svg>
        {:else}
          <svg
            class="w-4 h-4 text-gray-500 dark:text-zinc-400 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 712-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        {/if}
        <span
          class="flex-1 truncate text-gray-700 dark:text-zinc-300 group-hover:text-gray-900 dark:group-hover:text-zinc-100"
          class:font-medium={node.document.is_folder}
          class:text-blue-700={currentDoc?.id === node.document.id}
          class:dark:text-blue-300={currentDoc?.id === node.document.id}
        >
          {node.document.title ||
            (node.document.is_folder ? "Untitled Folder" : "Untitled Document")}
        </span>

        <!-- Drag handle indicator -->
        <div
          class="opacity-0 group-hover:opacity-50 transition-opacity duration-200 text-gray-400 dark:text-zinc-500 text-xs mr-1"
        >
          ⋮⋮
        </div>

        <!-- Delete button -->
        <button
          class="opacity-0 group-hover:opacity-100 text-gray-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 transition-all duration-200 p-1 rounded"
          onclick={(e) => handleDelete(e, node.document)}
          title="Delete {node.document.is_folder ? 'folder' : 'document'}"
          aria-label="Delete {node.document.is_folder ? 'folder' : 'document'}"
        >
          <svg
            class="w-3 h-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    {/each}

    <!-- Context Menu -->
    {#if contextMenuVisible && contextMenuTarget}
      <div
        class="context-menu fixed z-50 w-48 bg-white dark:bg-zinc-800 rounded-lg shadow-lg border border-gray-200 dark:border-zinc-700 py-1"
        style="left: {contextMenuX}px; top: {contextMenuY}px"
      >
        <button
          class="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-700 flex items-center gap-2"
          onclick={() => {
            showRenameModal = true;
            renameName = contextMenuTarget?.title || '';
            contextMenuVisible = false;
          }}
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Rename
        </button>

        <button
          class="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-700 flex items-center gap-2"
          onclick={async () => {
            const target = contextMenuTarget;
            if (!target) return;
            if (confirm(`Are you sure you want to delete "${target.title}"?`)) {
              try {
                await documentManager.deleteDocument(target.id);
                await loadFolderTree();
              } catch (err) {
                folderError = err instanceof Error ? err.message : "Failed to delete item";
              }
            }
            hideContextMenu();
          }}
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Delete
        </button>
      </div>
    {/if}
  </div>
{/if}

<!-- Create Folder Modal -->
{#if showCreateFolderModal}
  <div 
    class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    onclick={() => {
      showCreateFolderModal = false;
      newFolderName = '';
    }}
    onkeydown={(e) => {
      if (e.key === 'Escape') {
        showCreateFolderModal = false;
        newFolderName = '';
      }
    }}
    aria-roledescription="Create folder modal"
    role="dialog"
    aria-modal="true"
    aria-labelledby="create-folder-modal-title"
    tabindex="0"

  >
    <div 
      class="bg-white dark:bg-zinc-900 rounded-xl shadow-xl p-6 w-full max-w-md mx-auto transform transition-all"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
      aria-roledescription="Create folder modal content"
      role="button"
      tabindex="0"
    >
      <h3 class="text-lg font-semibold text-gray-900 dark:text-zinc-100 mb-4">
        Create New Folder
      </h3>
      <input
        bind:value={newFolderName}
        placeholder="Folder name"
        class="w-full px-4 py-2.5 border border-gray-300 dark:border-zinc-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100"
        onkeydown={(e) => {
          if (e.key === 'Enter' && newFolderName.trim()) {
            createFolder();
          } else if (e.key === 'Escape') {
            showCreateFolderModal = false;
            newFolderName = '';
          }
        }}
      />
      <div class="flex items-center gap-3 mt-6">
        <button
          onclick={createFolder}
          disabled={!newFolderName.trim()}
          class="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Create
        </button>
        <button
          onclick={() => {
            showCreateFolderModal = false;
            newFolderName = '';
          }}
          class="flex-1 px-4 py-2.5 border border-gray-300 dark:border-zinc-600 text-gray-700 dark:text-zinc-300 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Rename Modal -->
{#if showRenameModal && contextMenuTarget}
  <div 
    class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    onclick={() => {
      showRenameModal = false;
      renameName = '';
    }}
    onkeydown={(e) => {
      if (e.key === 'Escape') {
        showRenameModal = false;
        renameName = '';
      }
    }}
    role="dialog"
    aria-modal="true"
    aria-labelledby="rename-modal-title"
    tabindex="0"
  >
    <div 
      class="bg-white dark:bg-zinc-900 rounded-xl shadow-xl p-6 w-full max-w-md mx-auto transform transition-all"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
      role="button"
      tabindex="0"
    >
      <h3 class="text-lg font-semibold text-gray-900 dark:text-zinc-100 mb-4">
        Rename {contextMenuTarget?.is_folder ? 'Folder' : 'Document'}
      </h3>
      <input
        bind:value={renameName}
        placeholder={contextMenuTarget?.is_folder ? 'Folder name' : 'Document name'}
        class="w-full px-4 py-2.5 border border-gray-300 dark:border-zinc-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100"
        onkeydown={(e) => {
          if (e.key === 'Enter' && renameName.trim()) {
            renameItem();
          } else if (e.key === 'Escape') {
            showRenameModal = false;
            renameName = '';
          }
        }}
      />
      <div class="flex items-center gap-3 mt-6">
        <button
          onclick={renameItem}
          disabled={!renameName.trim()}
          class="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Rename
        </button>
        <button
          onclick={() => {
            showRenameModal = false;
            renameName = '';
          }}
          class="flex-1 px-4 py-2.5 border border-gray-300 dark:border-zinc-600 text-gray-700 dark:text-zinc-300 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
{/if}