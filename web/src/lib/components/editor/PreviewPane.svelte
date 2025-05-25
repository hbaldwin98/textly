<script lang="ts">
  import { marked } from "marked";
  import { onMount } from "svelte";

  // Configure marked options
  marked.setOptions({
    breaks: true,
    gfm: true,
    async: false,
  });

  interface Props {
    content: string;
    class?: string;
  }

  let { content, class: className = "" }: Props = $props();

  let renderedHtml = $derived(marked(content));

  onMount(() => {
    renderedHtml = marked(content);
  });

  $effect(() => {
    renderedHtml = marked(content);
  });
</script>

<div
  class="h-full w-full bg-white dark:bg-zinc-950 overflow-auto px-8 pt-0 pb-8"
>
  <div
    class="prose prose-gray dark:prose-invert max-w-none pt-4
                prose-base
                prose-headings:font-semibold prose-headings:tracking-tight
                prose-h1:text-2xl prose-h1:border-b prose-h1:border-gray-200 prose-h1:pb-2 prose-h1:mb-4
                prose-h2:text-xl prose-h2:border-b prose-h2:border-gray-200 prose-h2:pb-2 prose-h2:mb-3
                prose-h3:text-lg prose-h3:mb-3
                prose-p:mb-4 prose-p:leading-relaxed prose-p:text-base
                prose-blockquote:border-l-4 prose-blockquote:border-gray-300 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-gray-600
                prose-code:bg-gray-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-normal prose-code:before:content-none prose-code:after:content-none
                prose-pre:bg-gray-100 prose-pre:border prose-pre:border-gray-200 prose-pre:rounded-md prose-pre:p-4
                prose-ul:mb-4 prose-ol:mb-4 prose-li:mb-1
                dark:prose-h1:border-zinc-800 dark:prose-h2:border-zinc-800
                dark:prose-blockquote:border-zinc-700 dark:prose-blockquote:text-zinc-400
                dark:prose-code:bg-zinc-800 dark:prose-code:text-zinc-200
                dark:prose-pre:bg-zinc-800 dark:prose-pre:border-zinc-700"
  >
    {@html renderedHtml}
  </div>
</div>
