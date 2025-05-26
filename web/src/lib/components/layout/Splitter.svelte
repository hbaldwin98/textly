<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  
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
    if (!splitterElement) return;
    
    splitterElement.addEventListener('mousedown', handleMouseDown);
  });
  
  onDestroy(() => {
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
    }
  });
  
  function handleMouseDown(e: MouseEvent) {
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
  
  function handleMouseUp() {
    isResizing = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  }
  
  function updateSplitterPosition(currentMouseX: number) {
    const deltaX = currentMouseX - startMouseX;
    const containerWidth = document.documentElement.clientWidth;
    const deltaPercent = (deltaX / containerWidth) * 100;
    
    // Calculate new width percentage, clamped between 20% and 80%
    const newWidth = Math.max(20, Math.min(80, startLeftPercent + deltaPercent));
    
    // Update the width
    onWidthChange(newWidth);
    
    // Reset animation frame ID
    animationFrameId = null;
  }
</script>

<div
  bind:this={splitterElement}
  class="w-1 h-full bg-gray-200 dark:bg-gray-700 hover:bg-blue-500 dark:hover:bg-blue-400 cursor-col-resize transition-colors duration-200"
  role="separator"
  aria-orientation="vertical"
  aria-valuenow={currentWidth}
  aria-valuemin="20"
  aria-valuemax="80"
  title="Drag to resize"
></div> 