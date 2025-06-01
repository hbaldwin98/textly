<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  
  let { children } = $props();
  let darkMode = $state(false);
  
  onMount(() => {
    const saved = localStorage.getItem('darkMode');
    if (saved !== null) {
      darkMode = JSON.parse(saved);
    } else {
      darkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    
    updateTheme();
  });
  
  function updateTheme() {
    if (typeof document !== 'undefined') {
      if (darkMode) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      localStorage.setItem('darkMode', JSON.stringify(darkMode));
    }
  }
  
  function toggleDarkMode() {
    darkMode = !darkMode;
    updateTheme();
  }
  
  // Make toggleDarkMode available globally
  onMount(() => {
    (window as any).toggleDarkMode = toggleDarkMode;
  });
</script>

<svelte:head>
  <title>Textly</title>
</svelte:head>

<div class="h-screen overflow-hidden bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
  {@render children()}
</div> 