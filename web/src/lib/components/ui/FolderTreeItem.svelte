<script lang="ts">
  import type { Document } from "$lib/services/documents/document.service";
  import type { FolderTreeNode } from "$lib/services/documents/folder.service";
  import { contextMenu, handleClickOutside, handleEscapeKey } from "$lib/stores/context-menu.store";

  export let node: FolderTreeNode & { depth: number };
  export let isExpanded: boolean;
  export let isSelected: boolean;
  export let dragOverItem: Document | null = null;
  export let dragPosition: "top" | "bottom" | null = null;

  // Events
  export let onToggle: (folderId: string, event?: MouseEvent) => void;
  export let onSelect: (document: Document) => void;
  export let onDelete: (event: MouseEvent, document: Document) => void;
  export let onDeleteAll: (event: MouseEvent, document: Document) => void;
  export let onRename: (document: Document) => void;
  export let onDragStart: (event: DragEvent, document: Document) => void;
  export let onDragEnd: (event: DragEvent) => void;
  export let onDragOver: (event: DragEvent, document: Document | null) => void;
  export let onDragLeave: (event: DragEvent) => void;
  export let onDrop: (event: DragEvent, document: Document | null) => void;

  function handleRightClick(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    contextMenu.show('document', event.clientX, event.clientY, node.document.id, {
      document: node.document,
      isFolder: node.document.is_folder,
      hasChildren: node.children.length > 0
    });
  }

  // Add and remove event listeners
  import { onMount } from "svelte";
  onMount(() => {
    window.addEventListener("click", (e) => handleClickOutside(e, ".context-menu", "[data-context-menu-trigger]"));
    window.addEventListener("keydown", handleEscapeKey);
    return () => {
      window.removeEventListener("click", (e) => handleClickOutside(e, ".context-menu", "[data-context-menu-trigger]"));
      window.removeEventListener("keydown", handleEscapeKey);
    };
  });
</script>

<div
  class="flex items-center gap-2 px-2 py-1 text-sm rounded cursor-pointer transition-all duration-200 hover:bg-gray-100 dark:hover:bg-zinc-800 group relative {dragOverItem?.id ===
  node.document.id
    ? 'bg-blue-50 dark:bg-blue-900 border-2 border-blue-300 dark:border-blue-600 border-dashed'
    : ''} {isSelected
    ? 'bg-blue-100 dark:bg-blue-900/50'
    : ''}"
  style="padding-left: {8 + node.depth * 12}px"
  draggable="true"
  ondragstart={(e) => onDragStart(e, node.document)}
  ondragend={onDragEnd}
  ondragover={(e) => onDragOver(e, node.document)}
  ondragleave={onDragLeave}
  ondrop={(e) => onDrop(e, node.document)}
  onclick={() => onSelect(node.document)}
  oncontextmenu={handleRightClick}
  data-context-menu-trigger
  onkeydown={() => onSelect(node.document)}
  tabindex="0"
  role="treeitem"
  aria-selected={isSelected}
  aria-level={node.depth + 1}
>
  <!-- Drag indicators (only for non-folders) -->
  {#if dragOverItem?.id === node.document.id && !node.document.is_folder}
    {#if dragPosition === "top"}
      <div class="absolute inset-x-2 -top-0.5 h-0.5 bg-blue-500"></div>
    {:else if dragPosition === "bottom"}
      <div class="absolute inset-x-2 -bottom-0.5 h-0.5 bg-blue-500"></div>
    {/if}
  {/if}

  <!-- Node content -->
  {#if node.children.length > 0}
    <button
      class="flex-shrink-0 w-4 h-4 flex items-center justify-center text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200"
      onclick={(e) => onToggle(node.document.id, e)}
    >
      {#if isExpanded}
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
    class:text-blue-700={isSelected}
    class:dark:text-blue-300={isSelected}
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
    onclick={(e) => onDelete(e, node.document)}
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

  <!-- Context Menu -->
  {#if $contextMenu.visible && $contextMenu.type === 'document' && $contextMenu.targetId === node.document.id}
    <div
      class="context-menu fixed z-50 w-48 bg-white dark:bg-zinc-800 rounded-lg shadow-lg border border-gray-200 dark:border-zinc-700 py-1"
      style="left: {$contextMenu.x}px; top: {$contextMenu.y}px"
    >
      <button
        class="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-700 flex items-center gap-2"
        onclick={() => {
          onRename(node.document);
          contextMenu.hide();
        }}
      >
        <svg
          class="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
          />
        </svg>
        Rename
      </button>

      <button
        class="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-700 flex items-center gap-2"
        onclick={(e) => {
          onDelete(e, node.document);
          contextMenu.hide();
        }}
      >
        <svg
          class="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          />
        </svg>
        Delete
      </button>

      {#if node.document.is_folder && node.children.length > 0}
        <button
          class="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-zinc-700 flex items-center gap-2"
          onclick={(e) => {
            onDeleteAll(e, node.document);
            contextMenu.hide();
          }}
        >
          <svg
            class="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
          Delete All
        </button>
      {/if}
    </div>
  {/if}
</div> 