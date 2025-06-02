<script lang="ts">
  import type { ChatMessage } from "$lib/services/ai";
  import { markedHighlight } from "marked-highlight";
  import { Marked } from "marked";
  import hljs from "highlight.js";
  import { isMobile } from "$lib/services/layout/layout.service";

  export let message: ChatMessage;
  export let isEditing: boolean = false;
  export let isLastMessage: boolean = false;
  export let isStreaming: boolean = false;
  export let isActiveMenu: boolean = false;
  export let editingContent: string = "";
  export let editingElement: HTMLElement | null = null;
  export let onCancel: () => void = () => {};
  export let onApply: () => void = () => {};
  export let onInput: (event: Event) => void = () => {};
  export let onKeydown: (event: KeyboardEvent) => void = () => {};
  export let onEdit: (messageId: string) => void = () => {};
  export let onMenuToggle: (messageId: string) => void = () => {};

  const marked = new Marked(
    markedHighlight({
      async: true,
      emptyLangClass: "hljs",
      langPrefix: "hljs language-",
      highlight(code, lang, _) {
        const language = hljs.getLanguage(lang) ? lang : "plaintext";
        return hljs.highlight(code, { language }).value;
      },
    })
  );

  function formatThinkingContent(content: string): string {
    if (!content?.trim()?.length) return content;

    try {
      const unescaped = JSON.parse(`"${content.replace(/^"|"$/g, "")}"`).trim();
      return unescaped.replace(/\n/g, "<br>");
    } catch (e) {
      console.warn("Failed to parse thinking content:", e);
      return content
        .replace(/\\n/g, "\n")
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, "\\")
        .trim()
        .replace(/\n/g, "<br>");
    }
  }

  function formatMessageTime(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
</script>

<div class="flex {message.role === 'user' ? 'justify-end' : 'justify-start'} my-8">
  <div class="{message.role === 'user' ? ($isMobile ? 'w-full' : 'w-[90%] sm:w-[85%] md:w-[80%] lg:w-[75%] xl:w-[70%]') + ' order-2 transition-[width] duration-300 ease-in-out' : 'w-full order-1'}">
    <div class="relative">
      <div
        class="{message.role === 'user'
          ? 'px-3 py-2 rounded-lg text-sm bg-blue-500 text-white group relative'
          : 'text-sm text-gray-900 dark:text-zinc-100'}"
      >
        {#if message.role === "user"}
          {#if isEditing}
            <div class="flex flex-col">
              <div
                contenteditable="true"
                bind:this={editingElement}
                bind:innerHTML={editingContent}
                on:input={onInput}
                on:keydown={onKeydown}
                class="w-full bg-transparent outline-none whitespace-pre-wrap break-words min-h-[1.5em]"
                role="textbox"
                aria-multiline="true"
                tabindex="0"
              ></div>
              <div class="flex justify-end gap-2 mt-2">
                <button
                  class="text-xs font-semibold px-3 py-1.5 text-white hover:bg-white/10 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  on:click={onCancel}
                  title="Cancel editing"
                  disabled={isStreaming}
                >
                  Cancel
                </button>
                <button
                  class="text-xs font-semibold px-3 py-1.5 bg-white hover:bg-gray-100 text-gray-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  on:click={onApply}
                  disabled={!editingContent.trim() || isStreaming}
                  title="Save changes and resubmit"
                >
                  Save
                </button>
              </div>
            </div>
          {:else}
            <div
              class="whitespace-pre-wrap break-words overflow-hidden {!isEditing
                ? 'pr-8'
                : ''}"
            >
              {message.content}
            </div>
          {/if}
        {:else if message.role === "assistant"}
          {#if message.thinking}
            <div
              class="flex items-center space-x-2 text-gray-500 dark:text-zinc-400"
            >
              <div class="flex items-center space-x-1">
                <div
                  class="w-2 h-2 bg-gray-400 dark:bg-zinc-400 rounded-full animate-bounce"
                ></div>
                <div
                  class="w-2 h-2 bg-gray-400 dark:bg-zinc-400 rounded-full animate-bounce"
                  style="animation-delay: 0.1s"
                ></div>
                <div
                  class="w-2 h-2 bg-gray-400 dark:bg-zinc-400 rounded-full animate-bounce"
                  style="animation-delay: 0.2s"
                ></div>
              </div>
              <span class="text-sm">Thinking...</span>
            </div>
          {:else}
            <div class="prose prose-sm dark:prose-invert max-w-none">
              {#await marked.parse(message.content) then rendered}
                {@html rendered}
              {:catch}
                {@html message.content.replace(/\n/g, "<br>")}
              {/await}
            </div>
          {/if}
        {/if}

        {#if message.thinkingContent}
          <details class="mt-2">
            <summary
              class="cursor-pointer text-gray-600 dark:text-zinc-300 hover:text-gray-800 dark:hover:text-zinc-100"
            >
              <span class="text-xs">💭 View thought process</span>
            </summary>
            <div
              class="mt-2 p-3 bg-gray-50 dark:bg-zinc-800 rounded-md border-l-4 border-blue-300 dark:border-blue-600"
            >
              <div class="text-gray-700 dark:text-zinc-300 font-mono text-xs">
                {@html formatThinkingContent(message.thinkingContent)}
              </div>
            </div>
          </details>
        {/if}

        {#if message.role === "user" && !isEditing}
          <div class="absolute -bottom-6 left-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              class="p-1 text-gray-400 hover:text-blue-500 transition-colors"
              on:click={() => onEdit(message.id)}
              title="Edit message"
              aria-label="Edit message"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-4 w-4"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"
                />
              </svg>
            </button>
          </div>
        {/if}
      </div>

      {#if message.role === "user" && !isEditing && isActiveMenu}
        <div
          class="message-menu absolute right-0 top-full mt-1 bg-white dark:bg-zinc-900 shadow-lg rounded-lg py-1 z-50 min-w-[120px]"
        >
          <button
            class="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors flex items-center gap-2 text-gray-700 dark:text-zinc-100"
            on:click={() => onEdit(message.id)}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-4 w-4"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"
              />
            </svg>
            Edit message
          </button>
        </div>
      {/if}

      {#if isStreaming && isLastMessage && message.role === "assistant" && !message.thinking}
        <div class="flex items-center space-x-1 mt-2">
          <div
            class="w-1.5 h-1.5 bg-gray-400 dark:bg-zinc-400 rounded-full animate-bounce"
          ></div>
          <div
            class="w-1.5 h-1.5 bg-gray-400 dark:bg-zinc-400 rounded-full animate-bounce"
            style="animation-delay: 0.1s"
          ></div>
          <div
            class="w-1.5 h-1.5 bg-gray-400 dark:bg-zinc-400 rounded-full animate-bounce"
            style="animation-delay: 0.2s"
          ></div>
        </div>
      {/if}
    </div>
    <div
      class="text-xs text-gray-500 dark:text-zinc-400 mt-1 {message.role ===
      'user'
        ? 'text-right'
        : 'text-left'}"
    >
      {#if !(message.role === "assistant" && isStreaming && isLastMessage)}
        {formatMessageTime(message.timestamp)}
      {/if}
    </div>
  </div>
</div>

<style>
  :global(.prose pre) {
    background-color: #f0f2f5;
    border-radius: 6px;
    padding: 16px;
    margin: 1em 0;
    overflow-x: auto;
    border: none !important;
    outline: none !important;
  }

  :global(.dark .prose pre) {
    background-color: #1a1b26;
  }

  :global(.prose code) {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
      "Liberation Mono", "Courier New", monospace;
    font-size: 0.875em;
  }

  :global(.prose pre code) {
    background: none !important;
    padding: 0;
    border-radius: 0;
    font-size: 0.875em;
    color: #1a1f36;
    border: none !important;
    outline: none !important;
  }

  :global(.dark .prose pre code) {
    color: #f8f8f2;
  }

  :global(.prose p code) {
    background-color: #f0f2f5;
    padding: 0.2em 0.4em;
    border-radius: 3px;
    font-size: 0.875em;
    color: #1a1f36;
    border: none !important;
    outline: none !important;
  }

  :global(.dark .prose p code) {
    background-color: #1a1b26;
    color: #f8f8f2;
  }

  /* Override highlight.js theme styles */
  :global(.hljs) {
    background: none !important;
    border: none !important;
    outline: none !important;
  }

  /* Custom syntax highlighting colors for light mode */
  :global(.hljs-string) {
    color: #0550ae !important;
  }

  :global(.hljs-comment) {
    color: #6a737d !important;
  }

  :global(.hljs-keyword) {
    color: #d73a49 !important;
  }

  :global(.hljs-function) {
    color: #6f42c1 !important;
  }

  :global(.hljs-number) {
    color: #005cc5 !important;
  }

  :global(.hljs-attr) {
    color: #005cc5 !important;
  }

  :global(.hljs-title) {
    color: #6f42c1 !important;
  }

  :global(.hljs-params) {
    color: #24292e !important;
  }

  :global(.hljs-variable) {
    color: #e36209 !important;
  }

  :global(.hljs-property) {
    color: #005cc5 !important;
  }

  :global(.hljs-attribute) {
    color: #005cc5 !important;
  }

  :global(.hljs-built_in) {
    color: #6f42c1 !important;
  }

  /* Dark mode syntax highlighting colors */
  :global(.dark .hljs-string) {
    color: #a5d6ff !important;
  }

  :global(.dark .hljs-comment) {
    color: #6b7280 !important;
  }

  :global(.dark .hljs-keyword) {
    color: #ff7b72 !important;
  }

  :global(.dark .hljs-function) {
    color: #d2a8ff !important;
  }

  :global(.dark .hljs-number) {
    color: #79c0ff !important;
  }

  :global(.dark .hljs-attr) {
    color: #79c0ff !important;
  }

  :global(.dark .hljs-title) {
    color: #d2a8ff !important;
  }

  :global(.dark .hljs-params) {
    color: #c9d1d9 !important;
  }

  :global(.dark .hljs-variable) {
    color: #ffa657 !important;
  }

  :global(.dark .hljs-property) {
    color: #79c0ff !important;
  }

  :global(.dark .hljs-attribute) {
    color: #79c0ff !important;
  }

  :global(.dark .hljs-built_in) {
    color: #d2a8ff !important;
  }

  :global(.dark .prose pre code) {
    color: #f8f8f2;
  }

  :global(.prose p code) {
    background-color: #f0f2f5;
    padding: 0.2em 0.4em;
    border-radius: 3px;
    font-size: 0.875em;
    color: #1a1f36;
    border: none !important;
    outline: none !important;
  }

  :global(.dark .prose p code) {
    background-color: #1a1b26;
    color: #f8f8f2;
  }

  /* Override highlight.js theme styles */
  :global(.hljs) {
    background: none !important;
    border: none !important;
    outline: none !important;
  }

  /* Custom syntax highlighting colors for light mode */
  :global(.hljs-string) {
    color: #0550ae !important;
  }

  :global(.hljs-comment) {
    color: #6a737d !important;
  }

  :global(.hljs-keyword) {
    color: #d73a49 !important;
  }

  :global(.hljs-function) {
    color: #6f42c1 !important;
  }

  :global(.hljs-number) {
    color: #005cc5 !important;
  }

  :global(.hljs-attr) {
    color: #005cc5 !important;
  }

  :global(.hljs-title) {
    color: #6f42c1 !important;
  }

  :global(.hljs-params) {
    color: #24292e !important;
  }

  :global(.hljs-variable) {
    color: #e36209 !important;
  }

  :global(.hljs-property) {
    color: #005cc5 !important;
  }

  :global(.hljs-attribute) {
    color: #005cc5 !important;
  }

  :global(.hljs-built_in) {
    color: #6f42c1 !important;
  }

  /* Dark mode syntax highlighting colors */
  :global(.dark .hljs-string) {
    color: #a5d6ff !important;
  }

  :global(.dark .hljs-comment) {
    color: #6b7280 !important;
  }

  :global(.dark .hljs-keyword) {
    color: #ff7b72 !important;
  }

  :global(.dark .hljs-function) {
    color: #d2a8ff !important;
  }

  :global(.dark .hljs-number) {
    color: #79c0ff !important;
  }

  :global(.dark .hljs-attr) {
    color: #79c0ff !important;
  }

  :global(.dark .hljs-title) {
    color: #d2a8ff !important;
  }

  :global(.dark .hljs-params) {
    color: #c9d1d9 !important;
  }

  :global(.dark .hljs-variable) {
    color: #ffa657 !important;
  }

  :global(.dark .hljs-property) {
    color: #79c0ff !important;
  }

  :global(.dark .hljs-attribute) {
    color: #79c0ff !important;
  }

  :global(.dark .hljs-built_in) {
    color: #d2a8ff !important;
  }

  :global(.code-block) {
    font-family: var(--font-family-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace) !important;
    font-size: 0.875em;
    line-height: 1.5;
    padding: 1em;
    margin: 0.5em 0;
    overflow-x: auto;
    background-color: #f8fafc;
    border-radius: 0.375rem;
  }

  :global(.dark .code-block) {
    background-color: #1e293b;
  }
</style>
