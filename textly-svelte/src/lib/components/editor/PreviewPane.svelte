<script lang="ts">
  import { marked } from 'marked';
  import { onMount } from 'svelte';
  
  // Configure marked options
  marked.setOptions({
    breaks: true, // Convert line breaks to <br>
    gfm: true, // GitHub Flavored Markdown
    async: false // Disable async rendering for now
  });
  
  // Props
  interface Props {
    content: string;
    class?: string;
  }
  
  let { content, class: className = '' }: Props = $props();
  
  // Reactive statement to render markdown
  let renderedHtml = $derived(marked(content));
  
  // Initialize on mount
  onMount(() => {
    // Force initial render
    renderedHtml = marked(content);
  });
  
  // Watch for content changes and re-render using $effect
  $effect(() => {
    renderedHtml = marked(content);
  });
</script>

<div class="h-full w-full bg-white dark:bg-zinc-950 overflow-auto p-8">
  <div class="p-6 max-w-none lg:p-8 xl:p-10 2xl:p-12">
    <div class="prose prose-gray dark:prose-invert max-w-none
                lg:prose-lg xl:prose-xl 2xl:prose-2xl
                prose-headings:font-semibold prose-headings:tracking-tight
                prose-h1:text-2xl prose-h1:border-b prose-h1:border-gray-200 prose-h1:pb-2 prose-h1:mb-4
                lg:prose-h1:text-3xl lg:prose-h1:pb-3 lg:prose-h1:mb-6
                xl:prose-h1:text-4xl xl:prose-h1:pb-4 xl:prose-h1:mb-8
                prose-h2:text-xl prose-h2:border-b prose-h2:border-gray-200 prose-h2:pb-2 prose-h2:mb-3
                lg:prose-h2:text-2xl lg:prose-h2:pb-3 lg:prose-h2:mb-4
                xl:prose-h2:text-3xl xl:prose-h2:pb-4 xl:prose-h2:mb-6
                prose-h3:text-lg prose-h3:mb-3
                lg:prose-h3:text-xl lg:prose-h3:mb-4
                xl:prose-h3:text-2xl xl:prose-h3:mb-6
                prose-p:mb-4 prose-p:leading-relaxed
                lg:prose-p:mb-6 lg:prose-p:leading-relaxed
                xl:prose-p:mb-8 xl:prose-p:leading-relaxed
                prose-blockquote:border-l-4 prose-blockquote:border-gray-300 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-gray-600
                lg:prose-blockquote:pl-6 xl:prose-blockquote:pl-8
                prose-code:bg-gray-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-normal prose-code:before:content-none prose-code:after:content-none
                lg:prose-code:px-2 lg:prose-code:py-1 lg:prose-code:text-base
                xl:prose-code:px-3 xl:prose-code:py-1.5 xl:prose-code:text-lg
                prose-pre:bg-gray-100 prose-pre:border prose-pre:border-gray-200 prose-pre:rounded-md prose-pre:p-4
                lg:prose-pre:p-6 xl:prose-pre:p-8
                prose-ul:mb-4 prose-ol:mb-4 prose-li:mb-1
                lg:prose-ul:mb-6 lg:prose-ol:mb-6 lg:prose-li:mb-2
                xl:prose-ul:mb-8 xl:prose-ol:mb-8 xl:prose-li:mb-3
                dark:prose-h1:border-zinc-800 dark:prose-h2:border-zinc-800
                dark:prose-blockquote:border-zinc-700 dark:prose-blockquote:text-zinc-400
                dark:prose-code:bg-zinc-800 dark:prose-code:text-zinc-200
                dark:prose-pre:bg-zinc-800 dark:prose-pre:border-zinc-700"
    >
      {@html renderedHtml}
    </div>
  </div>
</div> 