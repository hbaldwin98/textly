<script lang="ts">
  import { Editor, rootCtx, defaultValueCtx } from "@milkdown/core";
  import { commonmark } from "@milkdown/preset-commonmark";
  import { gfm } from "@milkdown/preset-gfm";
  import { history } from "@milkdown/plugin-history";
  import { clipboard } from "@milkdown/plugin-clipboard";
  import { listener, listenerCtx } from "@milkdown/plugin-listener";
  import { nord } from "@milkdown/theme-nord";
  import { onMount } from "svelte";
  import { replaceAll } from "@milkdown/kit/utils";
  import PreviewPane from "../editor/PreviewPane.svelte";
  import { documentStore } from "$lib/stores/document.store";
  import { cursor } from "@milkdown/kit/plugin/cursor";
  import { trailing } from "@milkdown/kit/plugin/trailing";

  // Props
  interface Props {
    spellcheck?: boolean;
    maxWidth?:
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
    currentWidth?: string;
    onContentChange?: ((content: string) => void) | undefined;
  }

  let {
    spellcheck = true,
    maxWidth = "2xl",
    currentWidth = maxWidth,
    onContentChange = undefined,
  }: Props = $props();

  let showPreview = $state(false);
  let editorElement: HTMLElement;
  let editorInstance: Editor | null = null;
  let currentSpellcheck = spellcheck;
  let currentDocumentId: string | null = null; // Track current document ID

  // Get document from store
  let currentDoc = $derived($documentStore.currentDocument);

  function getMaxWidthClass(width: string): string {
    switch (width) {
      case "sm":
        return "max-w-sm"; // ~384px - Very narrow, like mobile
      case "md":
        return "max-w-md"; // ~448px - Narrow
      case "lg":
        return "max-w-lg"; // ~512px - Compact
      case "xl":
        return "max-w-xl"; // ~576px - Standard
      case "2xl":
        return "max-w-2xl"; // ~672px - Comfortable (default)
      case "3xl":
        return "max-w-3xl"; // ~768px - Wide
      case "4xl":
        return "max-w-4xl"; // ~896px - Very wide
      case "5xl":
        return "max-w-5xl"; // ~1024px - Extra wide
      case "6xl":
        return "max-w-6xl"; // ~1152px - Ultra wide
      case "7xl":
        return "max-w-7xl"; // ~1280px - Maximum wide
      case "full":
        return "max-w-full"; // 100% - Full width
      default:
        return "max-w-2xl";
    }
  }

  // Update editor content when document ID changes
  $effect(() => {
    let document = currentDoc;
    if (editorInstance && document && document.id !== currentDocumentId) {
      updateEditorContent(document.content);
      currentDocumentId = document.id;
    }
  });

  function updateEditorContent(newContent: string) {
    if (!editorInstance) return;
    try {
      editorInstance.action(replaceAll(newContent));
    } catch (error) {
      console.warn("Error updating editor content:", error);
    }
  }

  function updateSpellcheck() {
    if (!editorElement) return;
    
    // Set spellcheck on the root editor element
    editorElement.setAttribute("spellcheck", spellcheck.toString());
    
    // Set spellcheck on the ProseMirror element
    const proseMirrorElement = editorElement.querySelector('.ProseMirror');
    if (proseMirrorElement) {
      (proseMirrorElement as HTMLElement).setAttribute('spellcheck', spellcheck.toString());
    }
  }

  // Update spellcheck when the prop changes
  $effect(() => {
    updateSpellcheck();
  });

  function createMilkdownEditor() {
    if (!editorElement) return;

    const makeEditor = Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, editorElement);
        ctx.set(defaultValueCtx, currentDoc?.content || "");
        ctx.get(listenerCtx).markdownUpdated((_, markdown, prevMarkdown) => {
          if (markdown !== prevMarkdown) {
            currentDocumentId = currentDoc?.id || null;
            onContentChange?.(markdown);
            // Add or remove empty class based on content
            const proseMirrorElement = editorElement.querySelector('.ProseMirror');
            if (proseMirrorElement) {
              if (!markdown.trim()) {
                proseMirrorElement.classList.add('is-empty');
              } else {
                proseMirrorElement.classList.remove('is-empty');
              }
            }
          }
        });
      })
      .config(nord)
      .use(commonmark)
      .use(gfm)
      .use(history)
      .use(clipboard)
      .use(trailing)
      .use(cursor)
      .use(listener)
      .create();

    makeEditor
      .then((editor) => {
        editorInstance = editor;
        // Set initial empty state and spellcheck
        const proseMirrorElement = editorElement.querySelector('.ProseMirror');
        if (proseMirrorElement) {
          if (!currentDoc?.content?.trim()) {
            proseMirrorElement.classList.add('is-empty');
          }
          updateSpellcheck();
        }
      })
      .catch((error) => {
        console.error("Failed to create Milkdown editor:", error);
      });
  }

  function editor(dom: HTMLElement) {
    editorElement = dom;
    createMilkdownEditor();
  }

  function togglePreview() {
    showPreview = !showPreview;
  }

  function handleKeydown(event: KeyboardEvent) {
    if ((event.ctrlKey || event.metaKey) && event.key === "e") {
      event.preventDefault();
      togglePreview();
    }
  }

  onMount(() => {
    return () => {
      editorInstance?.destroy?.();
    };
  });
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="h-full w-full bg-gray-50 dark:bg-zinc-950 relative">
  <div class="h-full overflow-auto">
    <div
      class="{getMaxWidthClass(
        currentWidth
      )} mx-auto px-8 py-2 lg:px-12 lg:py-4 xl:px-16 xl:py-6"
    >
      {#if showPreview}
        <PreviewPane content={currentDoc?.content || ""} />
      {:else}
        <div
          use:editor
          role="textbox"
          tabindex="0"
          spellcheck={spellcheck}
          onfocus={() => {
            const proseMirrorElement = editorElement?.querySelector('.ProseMirror');
            if (proseMirrorElement) {
              (proseMirrorElement as HTMLElement).focus();
              updateSpellcheck();
            }
          }}
          onkeydown={(e) => {
            if (e.key === 'Tab') {
              e.preventDefault();
              const proseMirrorElement = editorElement?.querySelector('.ProseMirror');
              if (proseMirrorElement) {
                (proseMirrorElement as HTMLElement).focus();
                updateSpellcheck();
              }
            }
          }}
          class="w-full min-h-[500px] text-lg leading-relaxed text-gray-900 dark:text-gray-100 milkdown-immersive
                 lg:min-h-[600px] lg:text-xl xl:min-h-[700px] xl:text-2xl"
        ></div>
      {/if}
    </div>
  </div>
</div>

<style>
  :global(.milkdown-immersive) {
    font-family: var(--font-family) !important;
    font-size: 1.125rem !important;
    line-height: 1.7 !important;
    width: 100% !important;
  }

  /* Scale up typography on larger displays */
  @media (min-width: 1024px) {
    :global(.milkdown-immersive) {
      font-size: 1.25rem !important;
      line-height: 1.8 !important;
    }
  }

  @media (min-width: 1536px) {
    :global(.milkdown-immersive) {
      font-size: 1.375rem !important;
      line-height: 1.8 !important;
    }
  }

  @media (min-width: 2560px) {
    :global(.milkdown-immersive) {
      font-size: 1.5rem !important;
      line-height: 1.9 !important;
    }
  }

  :global(.milkdown-immersive .milkdown) {
    background: transparent !important;
    border: none !important;
    outline: none !important;
    padding: 0 !important;
    margin: 0 !important;
    font-family: inherit !important;
    font-size: inherit !important;
    line-height: inherit !important;
    color: inherit !important;
    width: 100% !important;
  }

  :global(.milkdown-immersive .ProseMirror) {
    background: transparent !important;
    border: none !important;
    outline: none !important;
    padding: 0 !important;
    margin: 0 !important;
    font-family: inherit !important;
    font-size: inherit !important;
    line-height: inherit !important;
    color: inherit !important;
    width: 100% !important;
    box-sizing: border-box !important;
    overflow-wrap: break-word !important;
    word-wrap: break-word !important;
    word-break: break-word !important;
    white-space: pre-wrap !important;
  }

  /* Add subtle background for empty paragraphs */
  :global(.milkdown-immersive .ProseMirror p:empty::before) {
    content: "" !important;
    display: block !important;
    background-color: rgba(243, 244, 246, 0.1) !important;
    border-radius: 0.375rem !important;
    min-height: 1.5em !important;
    padding: 0.25rem 0.5rem !important;
    margin-left: -0.5rem !important;
    margin-right: -0.5rem !important;
  }

  :global(.dark .milkdown-immersive .ProseMirror p:empty::before) {
    background-color: rgba(63, 63, 70, 0.1) !important;
  }

  /* Add hover effect for editable lines */
  :global(.milkdown-immersive .ProseMirror p:not(:empty)),
  :global(.milkdown-immersive .ProseMirror h1),
  :global(.milkdown-immersive .ProseMirror h2),
  :global(.milkdown-immersive .ProseMirror h3),
  :global(.milkdown-immersive .ProseMirror ul),
  :global(.milkdown-immersive .ProseMirror ol),
  :global(.milkdown-immersive .ProseMirror blockquote) {
    transition: background-color 0.2s ease !important;
    border-radius: 0.375rem !important;
    padding: 0.25rem 0.5rem !important;
    margin-left: -0.5rem !important;
    margin-right: -0.5rem !important;
  }

  :global(.milkdown-immersive .ProseMirror p:not(:empty):hover),
  :global(.milkdown-immersive .ProseMirror h1:hover),
  :global(.milkdown-immersive .ProseMirror h2:hover),
  :global(.milkdown-immersive .ProseMirror h3:hover),
  :global(.milkdown-immersive .ProseMirror ul:hover),
  :global(.milkdown-immersive .ProseMirror ol:hover),
  :global(.milkdown-immersive .ProseMirror blockquote:hover) {
    background-color: rgba(
      243,
      244,
      246,
      0.2
    ) !important; /* light gray with opacity */
  }

  :global(.dark .milkdown-immersive .ProseMirror p:not(:empty):hover),
  :global(.dark .milkdown-immersive .ProseMirror h1:hover),
  :global(.dark .milkdown-immersive .ProseMirror h2:hover),
  :global(.dark .milkdown-immersive .ProseMirror h3:hover),
  :global(.dark .milkdown-immersive .ProseMirror ul:hover),
  :global(.dark .milkdown-immersive .ProseMirror ol:hover),
  :global(.dark .milkdown-immersive .ProseMirror blockquote:hover) {
    background-color: rgba(
      63,
      63,
      70,
      0.2
    ) !important; /* dark gray with opacity */
  }

  /* Adjust existing styles to work with hover effects */
  :global(.milkdown-immersive .ProseMirror p) {
    margin-bottom: 1.5rem !important;
    line-height: inherit !important;
    width: 100% !important;
  }

  :global(.milkdown-immersive .ProseMirror blockquote) {
    border-left: 4px solid #e5e7eb !important;
    padding-left: 1.5rem !important;
    margin: 1.5rem 0 !important;
    font-style: italic !important;
    color: #6b7280 !important;
    width: 100% !important;
    box-sizing: border-box !important;
  }

  :global(.milkdown-immersive .ProseMirror-focused) {
    outline: none !important;
    box-shadow: none !important;
  }

  /* Clean typography for immersive experience */
  :global(.milkdown-immersive .ProseMirror h1) {
    font-size: 2.25rem !important;
    font-weight: 700 !important;
    margin-top: 2rem !important;
    margin-bottom: 1rem !important;
    line-height: 1.2 !important;
    width: 100% !important;
  }

  @media (min-width: 1024px) {
    :global(.milkdown-immersive .ProseMirror h1) {
      font-size: 2.5rem !important;
      margin-top: 2.5rem !important;
      margin-bottom: 1.25rem !important;
    }
  }

  @media (min-width: 1536px) {
    :global(.milkdown-immersive .ProseMirror h1) {
      font-size: 3rem !important;
      margin-top: 3rem !important;
      margin-bottom: 1.5rem !important;
    }
  }

  :global(.milkdown-immersive .ProseMirror h2) {
    font-size: 1.875rem !important;
    font-weight: 600 !important;
    margin-top: 1.75rem !important;
    margin-bottom: 0.875rem !important;
    line-height: 1.3 !important;
    width: 100% !important;
  }

  @media (min-width: 1024px) {
    :global(.milkdown-immersive .ProseMirror h2) {
      font-size: 2.125rem !important;
      margin-top: 2rem !important;
      margin-bottom: 1rem !important;
    }
  }

  @media (min-width: 1536px) {
    :global(.milkdown-immersive .ProseMirror h2) {
      font-size: 2.5rem !important;
      margin-top: 2.5rem !important;
      margin-bottom: 1.25rem !important;
    }
  }

  :global(.milkdown-immersive .ProseMirror h3) {
    font-size: 1.5rem !important;
    font-weight: 600 !important;
    margin-top: 1.5rem !important;
    margin-bottom: 0.75rem !important;
    width: 100% !important;
  }

  @media (min-width: 1024px) {
    :global(.milkdown-immersive .ProseMirror h3) {
      font-size: 1.75rem !important;
      margin-top: 1.75rem !important;
      margin-bottom: 0.875rem !important;
    }
  }

  @media (min-width: 1536px) {
    :global(.milkdown-immersive .ProseMirror h3) {
      font-size: 2rem !important;
      margin-top: 2rem !important;
      margin-bottom: 1rem !important;
    }
  }

  /* List styles with reduced spacing */
  :global(.milkdown-immersive .ProseMirror ul),
  :global(.milkdown-immersive .ProseMirror ol) {
    margin: 0 !important;
    padding-left: 1.5rem !important;
    line-height: 1 !important;
    width: 100% !important;
    box-sizing: border-box !important;
  }

  @media (min-width: 1024px) {
    :global(.milkdown-immersive .ProseMirror ul),
    :global(.milkdown-immersive .ProseMirror ol) {
      margin: 0 !important;
      padding-left: 2rem !important;
      line-height: 1 !important;
    }
  }

  @media (min-width: 1536px) {
    :global(.milkdown-immersive .ProseMirror ul),
    :global(.milkdown-immersive .ProseMirror ol) {
      margin: 0 !important;
      padding-left: 2.5rem !important;
      line-height: 1 !important;
    }
  }

  :global(.milkdown-immersive .ProseMirror li) {
    margin: 0 !important;
    padding: 0 !important;
    line-height: 1 !important;
    width: 100% !important;
    box-sizing: border-box !important;
  }

  @media (min-width: 1024px) {
    :global(.milkdown-immersive .ProseMirror li) {
      margin: 0 !important;
      padding: 0 !important;
      line-height: 1 !important;
    }
  }

  @media (min-width: 1536px) {
    :global(.milkdown-immersive .ProseMirror li) {
      margin: 0 !important;
      padding: 0 !important;
      line-height: 1 !important;
    }
  }

  /* Nested lists */
  :global(.milkdown-immersive .ProseMirror li ul),
  :global(.milkdown-immersive .ProseMirror li ol) {
    margin: 0 !important;
    padding: 0 !important;
    line-height: 1 !important;
  }

  @media (min-width: 1024px) {
    :global(.milkdown-immersive .ProseMirror blockquote) {
      padding-left: 1.5rem !important;
      margin: 2rem 0 !important;
    }
  }

  @media (min-width: 1536px) {
    :global(.milkdown-immersive .ProseMirror blockquote) {
      padding-left: 2rem !important;
      margin: 2.5rem 0 !important;
    }
  }

  :global(.dark .milkdown-immersive .ProseMirror blockquote) {
    border-left-color: #4b5563 !important;
    color: #9ca3af !important;
  }

  /* Hide line numbers and decorations for immersive experience */
  :global(.milkdown-immersive .ProseMirror .heading-anchor),
  :global(.milkdown-immersive .ProseMirror .heading-decoration) {
    display: none !important;
  }

  /* Ensure all content spans full width and handles overflow properly */
  :global(.milkdown-immersive .ProseMirror > *) {
    width: 100% !important;
    box-sizing: border-box !important;
    overflow-wrap: break-word !important;
    word-wrap: break-word !important;
    word-break: break-word !important;
    white-space: pre-wrap !important;
  }

  /* Horizontal rule (dividing line) styles */
  :global(.milkdown-immersive .ProseMirror hr) {
    margin: 1rem 0 !important;
    border: none !important;
    border-top: 1px solid #e5e7eb !important;
  }

  :global(.dark .milkdown-immersive .ProseMirror hr) {
    border-top-color: #4b5563 !important;
  }

  /* Spellcheck styles */
  :global(.milkdown-immersive .ProseMirror) {
    /* Ensure spellcheck underlines are visible */
    text-decoration-skip-ink: none !important;
  }

  /* Style spellcheck underlines to be more visible */
  :global(.milkdown-immersive .ProseMirror *::-webkit-spelling-error) {
    text-decoration: underline wavy #ef4444 !important;
    text-decoration-thickness: 2px !important;
  }

  :global(.milkdown-immersive .ProseMirror *::-webkit-grammar-error) {
    text-decoration: underline wavy #f59e0b !important;
    text-decoration-thickness: 2px !important;
  }

  :global(.milkdown-immersive .ProseMirror *::-moz-spelling-error) {
    text-decoration: underline wavy #ef4444 !important;
    text-decoration-thickness: 2px !important;
  }

  :global(.milkdown-immersive .ProseMirror *::-moz-grammar-error) {
    text-decoration: underline wavy #f59e0b !important;
    text-decoration-thickness: 2px !important;
  }

  /* Custom slider styles */
  .slider::-webkit-slider-thumb {
    appearance: none;
    height: 10px;
    width: 10px;
    border-radius: 50%;
    background: #3b82f6;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .slider::-webkit-slider-thumb:hover {
    background: #2563eb;
    transform: scale(1.1);
  }

  .slider::-moz-range-thumb {
    height: 10px;
    width: 10px;
    border-radius: 50%;
    background: #3b82f6;
    cursor: pointer;
    border: none;
    transition: all 0.2s ease;
  }

  .slider::-moz-range-thumb:hover {
    background: #2563eb;
    transform: scale(1.1);
  }

  .slider::-webkit-slider-track {
    height: 4px;
    border-radius: 2px;
    background: #e5e7eb;
  }

  .slider::-moz-range-track {
    height: 4px;
    border-radius: 2px;
    background: #e5e7eb;
    border: none;
  }

  /* Dark mode slider styles */
  :global(.dark) .slider::-webkit-slider-track {
    background: #52525b; /* zinc-600 */
  }

  :global(.dark) .slider::-moz-range-track {
    background: #52525b; /* zinc-600 */
  }

  /* Scale up slightly on larger displays */
  @media (min-width: 1024px) {
    .slider::-webkit-slider-thumb {
      height: 12px;
      width: 12px;
    }

    .slider::-moz-range-thumb {
      height: 12px;
      width: 12px;
    }

    .slider::-webkit-slider-track {
      height: 6px;
      border-radius: 3px;
    }

    .slider::-moz-range-track {
      height: 6px;
      border-radius: 3px;
    }
  }

  /* Scale up floating controls on larger displays */
  @media (min-width: 2560px) {
    .fixed.bottom-6.right-6 {
      bottom: 2rem !important;
      right: 2rem !important;
      padding: 1rem !important;
    }

    .fixed.bottom-6.left-6 {
      bottom: 2rem !important;
      left: 2rem !important;
    }

    .slider::-webkit-slider-thumb {
      height: 16px !important;
      width: 16px !important;
    }

    .slider::-moz-range-thumb {
      height: 16px !important;
      width: 16px !important;
    }

    .slider::-webkit-slider-track {
      height: 8px !important;
    }

    .slider::-moz-range-track {
      height: 8px !important;
    }
  }

  /* Empty editor state */
  :global(.milkdown-immersive .ProseMirror.is-empty) {
    position: relative !important;
  }

  :global(.milkdown-immersive .ProseMirror.is-empty::before) {
    content: "" !important;
    position: absolute !important;
    top: 0 !important;
    left: -0.5rem !important;
    right: 0.5rem !important;
    bottom: 0 !important;
    background-color: rgba(75, 85, 99, 0.5) !important; /* gray-600 with 50% opacity */
    border-radius: 0.375rem !important;
    pointer-events: none !important;
    transition: opacity 0.2s ease !important;
    padding: 0.25rem 0.5rem !important;
  }

  :global(.milkdown-immersive .ProseMirror.is-empty:focus::before),
  :global(.milkdown-immersive .ProseMirror.is-empty.ProseMirror-focused::before) {
    opacity: 0 !important;
  }

  :global(.dark .milkdown-immersive .ProseMirror.is-empty::before) {
    background-color: rgba(63, 63, 70, 0.2) !important; /* zinc-700 with 20% opacity */
  }

  /* Add hover effect for editable lines */
  :global(.milkdown-immersive .ProseMirror p:not(:empty)),
  :global(.milkdown-immersive .ProseMirror h1),
  :global(.milkdown-immersive .ProseMirror h2),
  :global(.milkdown-immersive .ProseMirror h3),
  :global(.milkdown-immersive .ProseMirror ul),
  :global(.milkdown-immersive .ProseMirror ol),
  :global(.milkdown-immersive .ProseMirror blockquote) {
    transition: background-color 0.2s ease !important;
    border-radius: 0.375rem !important;
    padding: 0.25rem 0.5rem !important;
    margin-left: -0.5rem !important;
    margin-right: -0.5rem !important;
  }

  :global(.milkdown-immersive:focus) {
    outline: none !important;
  }

  :global(.dark .milkdown-immersive:focus) {
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.3) !important;
  }
</style>
