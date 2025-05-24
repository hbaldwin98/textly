<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  
  // Props
  interface Props {
    onWidthChange: (width: number) => void;
    currentWidth: number;
  }
  
  let { onWidthChange, currentWidth }: Props = $props();
  
  let splitterElement: HTMLDivElement;
  let isResizing = false;
  let animationFrameId: number | null = null;
  let startMouseX = 0;
  let startLeftPercent = 0;
  
  onMount(() => {
    if (!browser || !splitterElement) return;
    
    splitterElement.addEventListener('mousedown', handleMouseDown);
  });
  
  onDestroy(() => {
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
    }
  });
  
  function handleMouseDown(e: MouseEvent) {
    if (!browser) return;
    
    isResizing = true;
    startMouseX = e.clientX;
    startLeftPercent = currentWidth; // Use the current width state directly
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    e.preventDefault();
  }
  
  function handleMouseMove(e: MouseEvent) {
    if (!isResizing) return;
    
    // Use requestAnimationFrame to throttle updates for smoother performance
    if (animationFrameId === null) {
      animationFrameId = requestAnimationFrame(() => updateSplitterPosition(e.clientX));
    }
  }
  
  function updateSplitterPosition(currentMouseX: number) {
    if (!isResizing || !browser) {
      animationFrameId = null;
      return;
    }
    
    const container = splitterElement.parentElement;
    if (!container) {
      animationFrameId = null;
      return;
    }
    
    const containerRect = container.getBoundingClientRect();
    const mouseDelta = currentMouseX - startMouseX;
    const deltaPercent = (mouseDelta / containerRect.width) * 100;
    
    // Calculate new percentage with min/max constraints (expanded range)
    const newLeftPercent = Math.max(10, Math.min(90, startLeftPercent + deltaPercent));
    
    onWidthChange(newLeftPercent);
    
    animationFrameId = null;
  }
  
  function handleMouseUp() {
    isResizing = false;
    
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    
    if (browser) {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    }
  }
</script>

<div 
  bind:this={splitterElement}
  class="w-1 bg-gray-200 dark:bg-gray-700 hover:bg-blue-500 dark:hover:bg-blue-400 cursor-col-resize transition-colors relative shrink-0 z-10"
  role="separator"
  aria-label="Resize panes"
>
  <!-- Invisible wider hit area for easier grabbing -->
  <div class="absolute inset-y-0 -left-2 -right-2 cursor-col-resize"></div>
</div> 