<script lang="ts">
  import { Editor, rootCtx, defaultValueCtx } from "@milkdown/core";
  import { commonmark } from "@milkdown/preset-commonmark";
  import { gfm } from "@milkdown/preset-gfm";
  import { history } from "@milkdown/plugin-history";
  import { clipboard } from "@milkdown/plugin-clipboard";
  import { listener, listenerCtx } from "@milkdown/plugin-listener";
  import { nord } from "@milkdown/theme-nord";
  import { marked } from "marked";
  import { onMount } from "svelte";

  // Props
  export let content = "";
  export let onContentChange = (newContent: string) => {};
  export let maxWidth:
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
    | "full" = "2xl";
  export let currentWidth = maxWidth;

  let showPreview = false;
  let editorElement: HTMLElement;
  let editorInstance: any = null;
  // Get the Tailwind class for max width
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

  // Reactive statement to handle content changes from parent
  $: if (editorInstance && content !== getCurrentEditorContent()) {
    updateEditorContent(content);
  }

  function getCurrentEditorContent(): string {
    if (!editorInstance) return "";
    try {
      // This would need to be implemented with Milkdown's action API
      return content; // Fallback for now
    } catch {
      return "";
    }
  }

  function updateEditorContent(newContent: string) {
    if (!editorInstance) return;
    try {
      createMilkdownEditor();
    } catch (error) {
      console.warn("Error updating editor content:", error);
    }
  }

  function createMilkdownEditor() {
    if (!editorElement) return;

    const makeEditor = Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, editorElement);
        ctx.set(defaultValueCtx, content);
      })
      .config((ctx) => {
        // Listen for content changes
        ctx.get(listenerCtx).markdownUpdated((_, markdown) => {
          onContentChange(markdown);
        });
      })
      .config(nord)
      .use(commonmark)
      .use(gfm)
      .use(history)
      .use(clipboard)
      .use(listener)
      .create();

    makeEditor
      .then((editor) => {
        editorInstance = editor;
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

  $: renderedContent = showPreview ? marked(content || "") : "";

  onMount(() => {
    return () => {
      if (editorInstance) {
        editorInstance.destroy?.();
      }
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
        <!-- Preview Mode -->
        <div
          class="w-full bg-gray-50 dark:bg-zinc-950 rounded-lg p-4 min-h-[600px]
                    lg:p-6 lg:min-h-[700px] xl:p-8 xl:min-h-[800px]"
        >
          <div
            class="prose prose-lg prose-gray dark:prose-invert max-w-none w-full
                      lg:prose-xl xl:prose-2xl
                      prose-headings:font-semibold prose-headings:tracking-tight
                      prose-h1:text-3xl prose-h1:border-b prose-h1:border-gray-200 prose-h1:pb-3 prose-h1:mb-6
                      lg:prose-h1:text-4xl lg:prose-h1:pb-4 lg:prose-h1:mb-8
                      xl:prose-h1:text-5xl xl:prose-h1:pb-5 xl:prose-h1:mb-10
                      prose-h2:text-2xl prose-h2:border-b prose-h2:border-gray-200 prose-h2:pb-2 prose-h2:mb-4
                      lg:prose-h2:text-3xl lg:prose-h2:pb-3 lg:prose-h2:mb-6
                      xl:prose-h2:text-4xl xl:prose-h2:pb-4 xl:prose-h2:mb-8
                      prose-h3:text-xl prose-h3:mb-4
                      lg:prose-h3:text-2xl lg:prose-h3:mb-6
                      xl:prose-h3:text-3xl xl:prose-h3:mb-8
                      prose-p:mb-5 prose-p:leading-relaxed prose-p:text-base
                      lg:prose-p:mb-7 lg:prose-p:text-lg
                      xl:prose-p:mb-9 xl:prose-p:text-xl
                      prose-blockquote:border-l-4 prose-blockquote:border-blue-500 prose-blockquote:pl-6 prose-blockquote:italic prose-blockquote:text-gray-600
                      lg:prose-blockquote:pl-8 xl:prose-blockquote:pl-10
                      prose-code:bg-gray-100 prose-code:px-2 prose-code:py-1 prose-code:rounded prose-code:text-sm prose-code:font-normal prose-code:before:content-none prose-code:after:content-none
                      lg:prose-code:px-3 lg:prose-code:py-1.5 lg:prose-code:text-base
                      xl:prose-code:px-4 xl:prose-code:py-2 xl:prose-code:text-lg
                      prose-pre:bg-gray-100 prose-pre:border prose-pre:border-gray-200 prose-pre:rounded-lg prose-pre:p-4
                      lg:prose-pre:p-6 xl:prose-pre:p-8
                      prose-ul:mb-5 prose-ol:mb-5 prose-li:mb-2
                      lg:prose-ul:mb-7 lg:prose-ol:mb-7 lg:prose-li:mb-3
                      xl:prose-ul:mb-9 xl:prose-ol:mb-9 xl:prose-li:mb-4
                      dark:prose-h1:border-zinc-800 dark:prose-h2:border-zinc-800
                      dark:prose-blockquote:border-zinc-700 dark:prose-blockquote:text-zinc-400
                      dark:prose-code:bg-zinc-800 dark:prose-code:text-zinc-200
                      dark:prose-pre:bg-zinc-800 dark:prose-pre:border-zinc-700"
          >
            {@html renderedContent}
          </div>
        </div>
      {:else}
        <!-- Editor Mode -->
        <div
          class="w-full bg-gray-50 dark:bg-zinc-950 rounded-lg p-4 min-h-[600px]
                    lg:p-6 lg:min-h-[700px] xl:p-8 xl:min-h-[800px]"
        >
          <div
            use:editor
            class="w-full min-h-[500px] font-serif text-lg leading-relaxed text-gray-900 dark:text-gray-100 milkdown-immersive
                   lg:min-h-[600px] lg:text-xl xl:min-h-[700px] xl:text-2xl"
          ></div>
        </div>
      {/if}
    </div>
  </div>

  <!-- Subtle bottom hint -->
  <div
    class="text-center py-3 text-xs text-gray-400/50 dark:text-gray-500/50 opacity-0 hover:opacity-100 transition-opacity
              lg:py-4 lg:text-xs"
  >
    Press <kbd
      class="px-1 py-0.5 bg-gray-200/50 dark:bg-gray-700/50 text-gray-700/50 dark:text-gray-300/50 rounded text-xs
                     lg:px-1.5 lg:py-0.5 lg:text-xs">Ctrl+E</kbd
    > to toggle between edit and preview
  </div>
</div>

<style>
  :global(.milkdown-immersive) {
    font-family: "Inter", "Georgia", serif !important;
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

  :global(.milkdown-immersive .ProseMirror p) {
    margin-bottom: 1.5rem !important;
    line-height: inherit !important;
    width: 100% !important;
  }

  @media (min-width: 1024px) {
    :global(.milkdown-immersive .ProseMirror p) {
      margin-bottom: 1.75rem !important;
    }
  }

  @media (min-width: 1536px) {
    :global(.milkdown-immersive .ProseMirror p) {
      margin-bottom: 2rem !important;
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

  :global(.milkdown-immersive .ProseMirror blockquote) {
    border-left: 4px solid #e5e7eb !important;
    padding-left: 1rem !important;
    margin: 1.5rem 0 !important;
    font-style: italic !important;
    color: #6b7280 !important;
    width: 100% !important;
    box-sizing: border-box !important;
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
</style>
