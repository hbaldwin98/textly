<script lang="ts">
  import { onMount } from "svelte";
  import {
    Sidebar,
    EditorPane,
    PreviewPane,
    ImmersivePane,
    Splitter,
    AIPanel,
  } from "$lib";
  import { currentDocument } from "$lib/stores/document.store";
  import { authStore } from "$lib/stores/auth.store";
  import { DocumentManagerService } from "$lib/services/documents";
  import { DocumentCommandPalette } from "$lib/components/documents";

  // Reactive state
  let viewMode = $state("split"); // 'split', 'editor', 'preview', 'focus'
  let isSpellcheckEnabled = $state(true);
  let isAISidebarOpen = $state(false);
  let isCommandPaletteOpen = $state(false);

  // Auth and document state
  let authState = $derived($authStore);
  let isLoggedIn = $derived(authState.isLoggedIn);
  let activeDocument = $derived($currentDocument);
  let hasDocument = $derived(!!activeDocument);
  let documentManager: DocumentManagerService | null = null;

  // Fallback content for when no document is active (must be declared before derived)
  let fallbackContent = $state("");

  // Content state - derived from document or fallback content
  let editorContent = $derived.by(() => {
    if (activeDocument) {
      return activeDocument.content || "";
    }

    // Fallback content for non-logged-in users or when no document is selected
    return fallbackContent;
  });

  onMount(async () => {
    documentManager = DocumentManagerService.getInstance();

    const savedViewMode = localStorage.getItem("textly-view-mode");
    if (savedViewMode) {
      viewMode = savedViewMode;
    }

    await initializeDocumentState();
  });

  let leftPaneWidth = $state(50); // Percentage
  let contentWidth = $state<
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
  >("5xl");

  // Functions to handle state changes
  function handleViewModeChange(newMode: string) {
    viewMode = newMode;
    // Save view mode to localStorage
    localStorage.setItem("textly-view-mode", newMode);
    if (newMode === "split") {
      leftPaneWidth = 50; // Reset to 50/50 when switching back to split
    }
  }

  function handleSplitterWidthChange(newWidth: number) {
    leftPaneWidth = newWidth;
  }

  function handleContentWidthChange(
    newWidth:
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
  ) {
    contentWidth = newWidth;
  }

  function handleSpellcheckToggle() {
    isSpellcheckEnabled = !isSpellcheckEnabled;
  }

  function handleContentChange(newContent: string) {
    if (hasDocument && documentManager) {
      documentManager.updateContent(newContent);
    } else {
      fallbackContent = newContent;
      localStorage.setItem("textly-content", newContent);
    }
  }

  async function restorePreviousDocument() {
    if (!documentManager || !isLoggedIn) return;

    const savedDocumentId = localStorage.getItem("textly-current-document-id");
    if (savedDocumentId) {
      try {
        await documentManager.loadDocument(savedDocumentId);
      } catch (error) {
        localStorage.removeItem("textly-current-document-id");
      }
    }
  }

  async function initializeDocumentState() {
    if (!documentManager) return;

    if (isLoggedIn) {
      await restorePreviousDocument();
    }
  }



  // Effect to handle auth state changes - clear document when user logs out
  $effect(() => {
    if (!isLoggedIn && documentManager) {
      documentManager.clearCurrentDocument();
      localStorage.removeItem("textly-current-document-id");
    }
  });

  // Save current document ID to localStorage when it changes
  $effect(() => {
    if (activeDocument) {
      localStorage.setItem("textly-current-document-id", activeDocument.id);
    } else if (!activeDocument) {
      localStorage.removeItem("textly-current-document-id");
    }
  });

  // Keyboard shortcuts
  onMount(() => {
    function handleKeydown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
        switch (e.key) {
          case "1":
            e.preventDefault();
            handleViewModeChange("split");
            break;
          case "2":
            e.preventDefault();
            handleViewModeChange("editor");
            break;
          case "3":
            e.preventDefault();
            handleViewModeChange("preview");
            break;
          case "4":
            e.preventDefault();
            handleViewModeChange("focus");
            break;
          case "s":
            e.preventDefault();
            handleSpellcheckToggle();
            break;
          case "p":
            e.preventDefault();
            isCommandPaletteOpen = true;
            break;
        }
      }
    }

    document.addEventListener("keydown", handleKeydown);

    return () => {
      document.removeEventListener("keydown", handleKeydown);
    };
  });
</script>

<div
  class="h-screen bg-gradient-to-br from-gray-100 via-gray-50 to-gray-100 dark:from-zinc-950 dark:via-zinc-950 dark:to-zinc-950"
>
  <div class="flex h-full relative">
    <!-- Main Content -->
    <div
      class="flex-1 transition-all duration-300 relative z-10"
      class:mr-80={isAISidebarOpen}
    >
      <Sidebar
        {viewMode}
        {isSpellcheckEnabled}
        onViewModeChange={handleViewModeChange}
        onSpellcheckToggle={handleSpellcheckToggle}
        currentWidth={contentWidth}
        onWidthChange={handleContentWidthChange}
      />

      <div class="h-full overflow-hidden">
        {#if viewMode === "editor"}
          <EditorPane
            content={editorContent}
            spellcheck={isSpellcheckEnabled}
            onContentChange={handleContentChange}
            class="w-full h-full"
          />
        {:else if viewMode === "preview"}
          <PreviewPane content={editorContent} class="w-full h-full" />
        {:else if viewMode === "focus"}
          <ImmersivePane
            content={editorContent}
            spellcheck={isSpellcheckEnabled}
            currentWidth={contentWidth}
            onContentChange={handleContentChange}
          />
        {:else}
          <!-- Split view -->
          <div class="flex h-full w-full">
            <EditorPane
              content={editorContent}
              spellcheck={isSpellcheckEnabled}
              onContentChange={handleContentChange}
              class="transition-none flex-shrink-0"
              style="width: {leftPaneWidth}%"
            />
            <Splitter
              onWidthChange={handleSplitterWidthChange}
              currentWidth={leftPaneWidth}
            />
            <PreviewPane content={editorContent} class="flex-1 min-w-0" />
          </div>
        {/if}
      </div>
    </div>

    <!-- AI Suggestions Sidebar -->
    <div class="absolute right-0 top-0 h-full z-20">
      <AIPanel
        bind:isOpen={isAISidebarOpen}
        context={editorContent}
        onSuggestionAccept={(suggestion) => {
          // TODO: Implement suggestion insertion
          console.log("Suggestion accepted:", suggestion);
        }}
      />
    </div>
  </div>
</div>

<!-- Document Command Palette -->
<DocumentCommandPalette
  isOpen={isCommandPaletteOpen}
  on:close={() => (isCommandPaletteOpen = false)}
  on:select={() => (isCommandPaletteOpen = false)}
/>
