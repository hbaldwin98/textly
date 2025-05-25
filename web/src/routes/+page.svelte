<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { 
    Sidebar, 
    EditorPane, 
    PreviewPane, 
    ImmersivePane, 
    Splitter, 
    AIPanel 
  } from '$lib';
  
  // Reactive state
  let viewMode = $state('split'); // 'split', 'editor', 'preview', 'focus'
  let isSpellcheckEnabled = $state(true);
  let editorContent = $state('');
  let isAISidebarOpen = $state(false);
  
  // Load content and view mode from localStorage on mount
  onMount(() => {
    if (browser) {
      // Load saved view mode
      const savedViewMode = localStorage.getItem('textly-view-mode');
      if (savedViewMode) {
        viewMode = savedViewMode;
      }

      // Load saved content
      const savedContent = localStorage.getItem('textly-content');
      if (savedContent) {
        editorContent = savedContent;
      } else {
        // Set default content if nothing is saved
        editorContent = `# Welcome to Textly

This is a **markdown editor** with *live preview* built with **Svelte**!

## Features

- Real-time preview
- Syntax highlighting  
- Beautiful styling with **Tailwind CSS**
- Draggable splitter (optimized!)
- Line wrapping
- Full height editor
- **Toggle view modes** (Editor / Preview / Split / **Focus**)
- **Spellcheck support** (try typing "teh" or "helo")
- **Dark mode** with easy toggle
- **🎯 Immersive Focus Mode** - Distraction-free writing experience!
- **🤖 AI Assistant** - Get writing help, suggestions, and have conversations!

### AI Assistant Features

The new **AI Assistant** provides:
- 📝 **Quick Actions** - Right-click selected text for instant improvements, synonyms, and descriptions
- 💬 **Chat Interface** - Have full conversations with the AI for writing help, research, and brainstorming
- 🧠 **Context Retention** - The AI remembers your conversation history for better assistance
- ⚡ **Smart Suggestions** - Get contextual writing improvements and alternatives
- 🎯 **Writing Focus** - Specialized prompts for editing and content creation

### Focus Mode Features

The **Focus Mode** provides:
- 📝 **Centered writing area** with optimal line length for readability
- 🎨 **Clean, minimal interface** with hidden distractions  
- ⚡ **Quick toggle** between edit and preview with \`Ctrl+E\`
- 🎯 **Enhanced typography** with comfortable reading fonts
- 🌙 **Beautiful dark mode** support
- 📱 **Mobile-friendly** responsive design

### Code Example

\`\`\`javascript
function createFocusMode() {
  const writer = new ImmersiveWriter({
    maxWidth: '2xl',
    hideLineNumbers: true,
    enhancedTypography: true
  });
  
  return writer.engage();
}
\`\`\`

> Focus mode is perfect for long-form writing, blog posts, documentation, and any content where you want to minimize distractions and maximize flow.

### Keyboard Shortcuts

- **Ctrl/Cmd + 1**: Split view
- **Ctrl/Cmd + 2**: Editor only  
- **Ctrl/Cmd + 3**: Preview only
- **Ctrl/Cmd + 4**: **Focus mode** 🎯
- **Ctrl/Cmd + S**: Toggle spellcheck
- **Ctrl + E** (in Focus mode): Toggle edit/preview

### AI Assistant Usage

- **Right-click** selected text for quick AI actions
- **Click the AI button** in the top-right to open the assistant panel
- **Switch between tabs** for quick actions vs. full chat
- **Start conversations** to get help with writing, research, or brainstorming

---

Happy writing! ✨`;
      }
    }
  });
  
  let leftPaneWidth = $state(50); // Percentage
  let contentWidth = $state<'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl' | '7xl' | 'full'>('5xl'); // Default width for focus mode
  
  // Functions to handle state changes
  function handleViewModeChange(newMode: string) {
    viewMode = newMode;
    // Save view mode to localStorage
    if (browser) {
      localStorage.setItem('textly-view-mode', newMode);
    }
    if (newMode === 'split') {
      leftPaneWidth = 50; // Reset to 50/50 when switching back to split
    }
  }
  
  function handleSplitterWidthChange(newWidth: number) {
    leftPaneWidth = newWidth;
  }
  
  function handleContentWidthChange(newWidth: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl' | '7xl' | 'full') {
    contentWidth = newWidth;
  }
  
  function handleSpellcheckToggle() {
    isSpellcheckEnabled = !isSpellcheckEnabled;
  }
  
  function handleContentChange(newContent: string) {
    editorContent = newContent;
    // Save to localStorage whenever content changes
    if (browser) {
      localStorage.setItem('textly-content', newContent);
    }
  }
  
  // Keyboard shortcuts
  onMount(() => {
    if (!browser) return;
    
    function handleKeydown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
        switch (e.key) {
          case '1':
            e.preventDefault();
            handleViewModeChange('split');
            break;
          case '2':
            e.preventDefault();
            handleViewModeChange('editor');
            break;
          case '3':
            e.preventDefault();
            handleViewModeChange('preview');
            break;
          case '4':
            e.preventDefault();
            handleViewModeChange('focus');
            break;
          case 's':
            e.preventDefault();
            handleSpellcheckToggle();
            break;
        }
      }
    }
    
    document.addEventListener('keydown', handleKeydown);
    
    return () => {
      document.removeEventListener('keydown', handleKeydown);
    };
  });
</script>

<div class="h-screen bg-gradient-to-br from-gray-100 via-gray-50 to-gray-100 dark:from-zinc-950 dark:via-zinc-950 dark:to-zinc-950">
  <div class="flex h-full relative">
    <!-- Main Content -->
    <div class="flex-1 transition-all duration-300 relative z-10" class:mr-80={isAISidebarOpen}>
      <Sidebar 
        {viewMode} 
        {isSpellcheckEnabled} 
        onViewModeChange={handleViewModeChange}
        onSpellcheckToggle={handleSpellcheckToggle}
        currentWidth={contentWidth}
        onWidthChange={handleContentWidthChange}
      />
      
      <div class="h-full overflow-hidden">
        {#if viewMode === 'editor'}
          <EditorPane 
            content={editorContent}
            spellcheck={isSpellcheckEnabled}
            onContentChange={handleContentChange}
            class="w-full h-full"
          />
        {:else if viewMode === 'preview'}
          <PreviewPane 
            content={editorContent}
            class="w-full h-full"
          />
        {:else if viewMode === 'focus'}
          <ImmersivePane 
            content={editorContent}
            currentWidth={contentWidth}
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
            <Splitter onWidthChange={handleSplitterWidthChange} currentWidth={leftPaneWidth} />
            <PreviewPane 
              content={editorContent}
              class="flex-1 min-w-0"
            />
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
          console.log('Suggestion accepted:', suggestion);
        }}
      />
    </div>
  </div>
</div>
