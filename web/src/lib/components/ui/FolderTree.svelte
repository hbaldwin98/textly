<script lang="ts">
  import { onMount } from "svelte";
  import {
    FolderService,
    type FolderTreeNode,
  } from "$lib/services/documents/folder.service";
  import { DocumentManagerService } from "$lib/services/documents/document-manager.service";
  import type { Document } from "$lib/services/documents/document.service";
  import { currentDocument } from "$lib/stores/document.store";
  import {
    folderTree,
    expandedFolders,
    isFolderTreeLoading,
    folderTreeError,
    folderTreeActions,
  } from "$lib/stores/folder-tree.store";
  import { documentActions } from "$lib/stores/document.store";
  import FolderTreeItem from "./FolderTreeItem.svelte";

  let {
    currentFolderId = null,
    onDocumentSelect = () => {},
    onFolderSelect = () => {}
  } = $props<{
    currentFolderId?: string | null;
    onDocumentSelect?: (document: Document) => void;
    onFolderSelect?: (folderId: string | null) => void;
  }>();

  let folderService = FolderService.getInstance();
  let documentManager = DocumentManagerService.getInstance();
  let breadcrumbs: Document[] = [];
  let currentDoc: Document | null = null;
  let unsubscribe: () => void;

  let isUploading = false;
  let uploadProgress = 0;

  let isUploadMenuOpen = $state(false);

  // Drag and drop state
  let draggedItem: Document | null = null;
  let dragOverItem: Document | null = null;
  let isDragging = false;
  let dragOverOutside = false;
  let dragPosition: "top" | "bottom" | null = null;

  let flattenedTree: Array<FolderTreeNode & { depth: number }> = $derived(
    $folderTree ? renderTreeNode($folderTree, 0, $expandedFolders) : []
  );

  // Subscribe to the current document store
  onMount(() => {
    // Subscribe to current document changes
    unsubscribe = currentDocument.subscribe((doc) => {
      currentDoc = doc;
      if (doc && $folderTree.length > 0) {
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
    window.addEventListener("click", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);

    // Return cleanup function
    return () => {
      window.removeEventListener("click", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
      if (unsubscribe) unsubscribe();
    };
  });

  // Function to expand parent folders of a document
  async function expandParentFolders(doc: Document) {
    if (!doc.parent) return; // No parent to expand

    try {
      const path = await folderService.getBreadcrumbs(doc.parent);
      const folderIds = path.map((d) => d.id);
      folderTreeActions.expandFolders(folderIds);
    } catch {
      // Silently ignore errors since this is non-critical functionality
    }
  }

  // Modal states
  let showCreateFolderModal = false;
  let showRenameModal = false;
  let newFolderName = "";
  let renameName = "";
  let renameTarget: Document | null = null;

  // Add click outside handler for upload menu
  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    
    // Handle upload menu
    if (isUploadMenuOpen && !target.closest("#upload-menu") && !target.closest("#upload-button")) {
      isUploadMenuOpen = false;
    }
  }

  // Add escape key handler for upload menu
  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      isUploadMenuOpen = false;
    }
  }

  async function loadFolderTree() {
    try {
      folderTreeActions.setLoading(true);
      const tree = await folderService.getFolderTree();
      // Convert the tree structure to a flat list of documents
      const documents = flattenTree(tree);
      folderTreeActions.setTree(documents);
    } catch (err) {
      console.error("FolderTree: Error loading folder tree:", err);
      folderTreeActions.setError(
        err instanceof Error ? err.message : "Failed to load folders"
      );
    } finally {
      folderTreeActions.setLoading(false);
    }
  }

  // Helper function to flatten the tree structure into a list of documents
  function flattenTree(nodes: FolderTreeNode[]): Document[] {
    const documents: Document[] = [];
    nodes.forEach((node) => {
      documents.push(node.document);
      if (node.children.length > 0) {
        documents.push(...flattenTree(node.children));
      }
    });
    return documents;
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
    folderTreeActions.toggleFolder(folderId);
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

  async function createFolder() {
    if (newFolderName.trim()) {
      try {
        // Create a root folder (no parent)
        const folder = await documentManager.createFolder(newFolderName.trim());
        folderTreeActions.addDocument(folder);
        newFolderName = "";
        showCreateFolderModal = false;
      } catch (err) {
        folderTreeActions.setError(
          err instanceof Error ? err.message : "Failed to create folder"
        );
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
      folderTreeActions.addDocument(document);
      onDocumentSelect(document);
    } catch (err) {
      folderTreeActions.setError(
        err instanceof Error ? err.message : "Failed to create document"
      );
    }
  }

  async function renameItem() {
    if (renameName.trim() && renameTarget) {
      try {
        await documentManager.updateTitle(
          renameTarget.id,
          renameName.trim()
        );
        const updatedDoc = { ...renameTarget, title: renameName.trim() };
        folderTreeActions.updateDocument(updatedDoc);
        showRenameModal = false;
        renameName = "";
        renameTarget = null;
      } catch (err) {
        folderTreeActions.setError(
          err instanceof Error ? err.message : "Failed to rename item"
        );
      }
    }
  }

  function renderTreeNode(
    nodes: FolderTreeNode[],
    depth = 0,
    expanded: string[] = []
  ): Array<FolderTreeNode & { depth: number }> {
    if (!nodes) return [];

    const result: Array<FolderTreeNode & { depth: number }> = [];

    nodes.forEach((node) => {
      // Add the current node
      result.push({
        ...node,
        depth,
        children: node.children,
      });

      // If expanded and has children, recursively add children
      if (
        expanded.includes(node.document.id) &&
        node.children &&
        node.children.length > 0
      ) {
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
        folderTreeActions.removeDocument(document.id);
      } catch (err) {
        folderTreeActions.setError(
          err instanceof Error ? err.message : "Failed to delete item"
        );
      }
    }
  }

  async function handleDeleteAll(event: MouseEvent, document: Document) {
    event.stopPropagation();
    if (
      confirm(
        `Are you sure you want to delete "${document.title}" and all its contents? This action cannot be undone.`
      )
    ) {
      try {
        // Get all descendants
        const allNodes = flattenedTree || [];
        const descendants = allNodes.filter((node) => {
          let current = node.document;
          while (current.parent) {
            if (current.parent === document.id) return true;
            const parentNode = allNodes.find(
              (n) => n.document.id === current.parent
            );
            if (!parentNode) break;
            current = parentNode.document;
          }
          return false;
        });

        // Delete all descendants first
        for (const node of descendants) {
          await documentManager.deleteDocument(node.document.id);
          folderTreeActions.removeDocument(node.document.id);
        }

        // Finally delete the folder itself
        await documentManager.deleteDocument(document.id);
        folderTreeActions.removeDocument(document.id);
      } catch (err) {
        folderTreeActions.setError(
          err instanceof Error
            ? err.message
            : "Failed to delete folder and contents"
        );
      }
    }
  }

  function handleDragStart(event: DragEvent, document: Document) {
    if (!event.dataTransfer) return;
    draggedItem = document;
    isDragging = true;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(
      "application/json",
      JSON.stringify({
        id: document.id,
        is_folder: document.is_folder,
      })
    );
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
        dragPosition = "bottom";
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

  async function handleDrop(
    event: DragEvent,
    targetDocument: Document | null = null
  ) {
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
      const draggedDoc = allNodes.find(
        (node) => node.document.id === dragData.id
      )?.document;
      if (!draggedDoc) return;

      // Silently ignore drops onto the same item
      if (targetDocument?.id === draggedDoc.id) {
        return;
      }

      if (targetDocument) {
        const canMove = await folderService.canMoveToFolder(
          draggedDoc.id,
          targetDocument.id
        );
        if (!canMove) {
          return;
        }
      }

      await folderService.moveToFolder(
        draggedDoc.id,
        targetDocument?.id || null
      );
      await loadFolderTree();
    } catch (err) {
      folderTreeActions.setError(
        err instanceof Error ? err.message : "Failed to move item"
      );
    } finally {
      draggedItem = null;
      dragOverItem = null;
      dragOverOutside = false;
      isDragging = false;
    }
  }

  // Helper function to check if a folder has any children
  function hasChildren(folderId: string): boolean {
    if (!$folderTree) return false;
    
    const checkNode = (nodes: FolderTreeNode[]): boolean => {
      for (const node of nodes) {
        if (node.document.parent === folderId) return true;
        if (node.children.length > 0 && checkNode(node.children)) return true;
      }
      return false;
    };
    
    return checkNode($folderTree);
  }

  async function handleFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    isUploading = true;
    uploadProgress = 0;
    const files = Array.from(input.files);
    const totalFiles = files.length;
    let processedFiles = 0;

    try {
      // Process each file
      for (const file of files) {
        if (!file.name.endsWith(".md")) {
          continue; // Skip non-markdown files
        }

        const content = await file.text();
        const title = file.name.replace(".md", "");

        const document = await documentManager.createDocument(
          title,
          content,
          currentFolderId || undefined
        );

        // Add the document to the store
        documentActions.addDocument(document);

        processedFiles++;
        uploadProgress = (processedFiles / totalFiles) * 100;
      }
      
      // Reload the folder tree to show new items
      await loadFolderTree();
    } catch (error) {
      console.error("Upload failed:", error);
    } finally {
      isUploading = false;
      uploadProgress = 0;
      // Reset the input
      input.value = "";
      // Close the upload menu
      isUploadMenuOpen = false;
    }
  }

  async function handleFolderSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    isUploading = true;
    uploadProgress = 0;

    // Process the folder structure
    try {
      await processFolderStructure(input.files);
      // Reload the folder tree to show new items
      await loadFolderTree();
    } finally {
      isUploading = false;
      uploadProgress = 0;
      // Reset the input
      input.value = "";
      // Close the upload menu
      isUploadMenuOpen = false;
    }
  }

  async function processFolderStructure(files: FileList) {
    const fileArray = Array.from(files);
    const totalFiles = fileArray.length;
    let processedFiles = 0;

    // First, create all folders
    const folderMap = new Map<string, string>(); // path -> folderId
    folderMap.set("", currentFolderId || ""); // Root folder

    // Sort files to process folders first
    const sortedFiles = fileArray.sort((a, b) => {
      const aPath = a.webkitRelativePath || a.name;
      const bPath = b.webkitRelativePath || b.name;
      return aPath.split("/").length - bPath.split("/").length;
    });

    try {
      for (const file of sortedFiles) {
        const path = file.webkitRelativePath || file.name;
        const parts = path.split("/");
        const fileName = parts.pop()!;

        if (!fileName.endsWith(".md")) {
          continue; // Skip non-markdown files
        }

        // Create folders if needed
        let currentPath = "";
        for (let i = 0; i < parts.length; i++) {
          const folderName = parts[i];
          const parentPath = currentPath;
          currentPath = currentPath
            ? `${currentPath}/${folderName}`
            : folderName;

          if (!folderMap.has(currentPath)) {
            const parentId = folderMap.get(parentPath) || currentFolderId;
            const folder = await documentManager.createFolder(
              folderName,
              parentId || undefined
            );
            folderMap.set(currentPath, folder.id);
            // Add the folder to the store
            documentActions.addDocument(folder);
          }
        }

        // Create the document
        const content = await file.text();
        const title = fileName.replace(".md", "");
        const parentId = folderMap.get(parts.join("/")) || currentFolderId;
        const document = await documentManager.createDocument(
          title,
          content,
          parentId || undefined
        );
        // Add the document to the store
        documentActions.addDocument(document);

        processedFiles++;
        uploadProgress = (processedFiles / totalFiles) * 100;
      }
    } catch (error) {
      console.error("Upload failed:", error);
      throw error; // Re-throw to be handled by the caller
    }
  }

  function handleRename(document: Document) {
    renameTarget = document;
    renameName = document.title;
    showRenameModal = true;
  }
</script>

<!-- Folder Tree Actions -->
<div class="flex items-center gap-2 mb-3">
  <button
    class="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-200"
    onclick={createDocument}
    title="New Document"
    aria-label="New Document"
  >
    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
    </svg>
    New
  </button>
  <div class="relative">
    <button
      id="upload-button"
      class="flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-200"
      onclick={() => isUploadMenuOpen = !isUploadMenuOpen}
      title="Upload Options"
      aria-label="Upload Options"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
      </svg>
      Upload
    </button>
    <div id="upload-menu" class="absolute right-0 mt-1 w-48 bg-white dark:bg-zinc-900 rounded-lg shadow-lg border border-gray-200 dark:border-zinc-700 py-1 z-10 {isUploadMenuOpen ? '' : 'hidden'}">
      <label class="block px-4 py-2 text-sm text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 cursor-pointer">
        <input type="file" accept=".md" multiple onchange={handleFileSelect} class="hidden" disabled={isUploading} />
        <div class="flex items-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 712-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Upload Files
        </div>
      </label>
      <label class="block px-4 py-2 text-sm text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 cursor-pointer">
        <input type="file" accept=".md" webkitdirectory onchange={handleFolderSelect} class="hidden" disabled={isUploading} />
        <div class="flex items-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          Upload Folder
        </div>
      </label>
    </div>
  </div>
  <button
    class="flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-200"
    onclick={() => (showCreateFolderModal = true)}
    title="New Folder"
    aria-label="New Folder"
  >
    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
    Folder
  </button>
</div>

{#if isUploading}
  <div class="w-full bg-gray-200 dark:bg-zinc-700 rounded-full h-1 mb-3">
    <div
      class="bg-blue-600 h-1 rounded-full transition-all duration-300"
      style="width: {uploadProgress}%"
    ></div>
  </div>
{/if}

<!-- Folder Tree -->
{#if $folderTreeError}
  <div
    class="p-3 mb-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
  >
    <p class="text-sm text-red-600 dark:text-red-400">{$folderTreeError}</p>
    <button
      class="mt-2 text-xs text-red-500 dark:text-red-400 hover:underline"
      onclick={() => {
        folderTreeActions.setError(null);
        loadFolderTree();
      }}
    >
      Retry
    </button>
  </div>
{/if}

{#if $isFolderTreeLoading}
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
{:else if $folderTree.length === 0}
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
      <FolderTreeItem
        {node}
        isExpanded={$expandedFolders.includes(node.document.id)}
        isSelected={currentDoc?.id === node.document.id}
        {dragOverItem}
        {dragPosition}
        onToggle={toggleFolder}
        onSelect={handleDocumentSelect}
        onDelete={handleDelete}
        onDeleteAll={handleDeleteAll}
        onRename={handleRename}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      />
    {/each}
  </div>
{/if}

<!-- Create Folder Modal -->
{#if showCreateFolderModal}
  <div
    class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    onclick={() => {
      showCreateFolderModal = false;
      newFolderName = "";
    }}
    onkeydown={(e) => {
      if (e.key === "Escape") {
        showCreateFolderModal = false;
        newFolderName = "";
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
          if (e.key === "Enter" && newFolderName.trim()) {
            createFolder();
          } else if (e.key === "Escape") {
            showCreateFolderModal = false;
            newFolderName = "";
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
            newFolderName = "";
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
{#if showRenameModal && renameTarget}
  <div
    class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    onclick={() => {
      showRenameModal = false;
      renameName = "";
      renameTarget = null;
    }}
    onkeydown={(e) => {
      if (e.key === "Escape") {
        showRenameModal = false;
        renameName = "";
        renameTarget = null;
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
        Rename {renameTarget?.is_folder ? "Folder" : "Document"}
      </h3>
      <input
        bind:value={renameName}
        placeholder={renameTarget?.is_folder
          ? "Folder name"
          : "Document name"}
        class="w-full px-4 py-2.5 border border-gray-300 dark:border-zinc-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100"
        onkeydown={(e) => {
          if (e.key === "Enter" && renameName.trim()) {
            renameItem();
          } else if (e.key === "Escape") {
            showRenameModal = false;
            renameName = "";
            renameTarget = null;
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
            renameName = "";
            renameTarget = null;
          }}
          class="flex-1 px-4 py-2.5 border border-gray-300 dark:border-zinc-600 text-gray-700 dark:text-zinc-300 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
{/if}
