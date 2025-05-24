<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  
  let darkMode = $state(false);
  
  onMount(() => {
    // Check for saved dark mode preference or default to system preference
    const saved = localStorage.getItem('darkMode');
    if (saved !== null) {
      darkMode = JSON.parse(saved);
    } else {
      darkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    
    updateTheme();
  });
  
  function updateTheme() {
    if (browser) {
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
  if (browser) {
    (window as any).toggleDarkMode = toggleDarkMode;
  }
</script>

<div class="h-screen overflow-hidden bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
  <slot />
</div> 