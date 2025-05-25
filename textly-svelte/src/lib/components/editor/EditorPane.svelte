<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { EditorView, basicSetup } from 'codemirror';
  import { markdown } from '@codemirror/lang-markdown';
  import { Compartment } from '@codemirror/state';
  import { syntaxHighlighting, HighlightStyle } from '@codemirror/language';
  import { tags } from '@lezer/highlight';
  
  // Props
  interface Props {
    content: string;
    spellcheck: boolean;
    onContentChange: (content: string) => void;
    class?: string;
    style?: string;
  }
  
  let { content, spellcheck, onContentChange, class: className = '', style = '' }: Props = $props();
  
  let editorElement: HTMLDivElement;
  let editor: EditorView | null = null;
  
  // Theme compartment for dynamic switching
  const themeCompartment = new Compartment();
  
  // Custom light theme that matches Tailwind
  const lightTheme = EditorView.theme({
    '&': {
      color: '#374151', // text-gray-700
      backgroundColor: 'transparent', // Let it inherit from parent
    },
    '.cm-content': {
      padding: '16px',
      caretColor: '#3b82f6', // blue-500
      backgroundColor: 'transparent', // Let it inherit from parent
    },
    '.cm-focused': {
      outline: 'none',
    },
    '.cm-editor.cm-focused': {
      outline: 'none',
    },
    '.cm-selectionBackground': {
      backgroundColor: '#dbeafe', // blue-100
    },
    '.cm-cursor': {
      borderLeftColor: '#3b82f6', // blue-500
    },
    '.cm-activeLine': {
      backgroundColor: '#f9fafb', // gray-50
    },
    '.cm-activeLineGutter': {
      backgroundColor: '#f3f4f6', // gray-100
    },
    '.cm-gutters': {
      backgroundColor: '#f9fafb', // gray-50
      color: '#9ca3af', // gray-400
      border: 'none',
      borderRight: '1px solid #e5e7eb', // gray-200
    },
    '.cm-lineNumbers .cm-gutterElement': {
      padding: '0 12px 0 20px',
    },
    
    // Responsive padding for larger displays
    '@media (min-width: 1024px)': {
      '.cm-content': {
        padding: '20px',
      },
      '.cm-lineNumbers .cm-gutterElement': {
        padding: '0 16px 0 24px',
      }
    },
    
    '@media (min-width: 1536px)': {
      '.cm-content': {
        padding: '24px',
      },
      '.cm-lineNumbers .cm-gutterElement': {
        padding: '0 20px 0 28px',
      }
    }
  }, { dark: false });
  
  // Custom dark theme that matches Tailwind
  const darkTheme = EditorView.theme({
    '&': {
      color: '#f4f4f5', // zinc-100
      backgroundColor: 'transparent', // Let it inherit from parent
    },
    '.cm-content': {
      padding: '16px',
      caretColor: '#60a5fa', // blue-400
      backgroundColor: 'transparent', // Let it inherit from parent
    },
    '.cm-focused': {
      outline: 'none',
    },
    '.cm-editor.cm-focused': {
      outline: 'none',
    },
    '.cm-selectionBackground': {
      backgroundColor: '#1e3a8a', // blue-800 with opacity
    },
    '.cm-cursor': {
      borderLeftColor: '#60a5fa', // blue-400
    },
    '.cm-activeLine': {
      backgroundColor: '#18181b', // zinc-900
    },
    '.cm-activeLineGutter': {
      backgroundColor: '#27272a', // zinc-800
    },
    '.cm-gutters': {
      backgroundColor: '#18181b', // zinc-900
      color: '#71717a', // zinc-500
      border: 'none',
      borderRight: '1px solid #27272a', // zinc-800
    },
    '.cm-lineNumbers .cm-gutterElement': {
      padding: '0 12px 0 20px',
    },
    
    // Responsive padding for larger displays
    '@media (min-width: 1024px)': {
      '.cm-content': {
        padding: '20px',
      },
      '.cm-lineNumbers .cm-gutterElement': {
        padding: '0 16px 0 24px',
      }
    },
    
    '@media (min-width: 1536px)': {
      '.cm-content': {
        padding: '24px',
      },
      '.cm-lineNumbers .cm-gutterElement': {
        padding: '0 20px 0 28px',
      }
    }
  }, { dark: true });
  
  // Light syntax highlighting
  const lightHighlighting = HighlightStyle.define([
    { tag: tags.keyword, color: '#d73a49' }, // Red
    { tag: tags.atom, color: '#005cc5' }, // Blue
    { tag: tags.number, color: '#005cc5' }, // Blue
    { tag: tags.definition(tags.variableName), color: '#6f42c1' }, // Purple
    { tag: tags.variableName, color: '#24292e' }, // Dark gray
    { tag: tags.function(tags.variableName), color: '#6f42c1' }, // Purple
    { tag: tags.string, color: '#032f62' }, // Dark blue
    { tag: tags.comment, color: '#6a737d', fontStyle: 'italic' }, // Gray italic
    { tag: tags.heading, color: '#005cc5', fontWeight: 'bold' }, // Blue bold
    { tag: tags.emphasis, fontStyle: 'italic' },
    { tag: tags.strong, fontWeight: 'bold' },
    { tag: tags.link, color: '#032f62', textDecoration: 'underline' },
    { tag: tags.quote, color: '#6a737d' }, // Gray
  ]);
  
  // Dark syntax highlighting
  const darkHighlighting = HighlightStyle.define([
    { tag: tags.keyword, color: '#ff7b72' }, // Light red
    { tag: tags.atom, color: '#79c0ff' }, // Light blue
    { tag: tags.number, color: '#79c0ff' }, // Light blue
    { tag: tags.definition(tags.variableName), color: '#d2a8ff' }, // Light purple
    { tag: tags.variableName, color: '#f0f6fc' }, // Light gray
    { tag: tags.function(tags.variableName), color: '#d2a8ff' }, // Light purple
    { tag: tags.string, color: '#a5d6ff' }, // Light blue
    { tag: tags.comment, color: '#8b949e', fontStyle: 'italic' }, // Gray italic
    { tag: tags.heading, color: '#79c0ff', fontWeight: 'bold' }, // Light blue bold
    { tag: tags.emphasis, fontStyle: 'italic' },
    { tag: tags.strong, fontWeight: 'bold' },
    { tag: tags.link, color: '#a5d6ff', textDecoration: 'underline' },
    { tag: tags.quote, color: '#8b949e' }, // Gray
  ]);
  
  // Function to check if dark mode is active
  function isDarkMode(): boolean {
    if (typeof window !== 'undefined') {
      return document.documentElement.classList.contains('dark');
    }
    return false;
  }
  
  // Function to get current theme extensions
  function getCurrentTheme() {
    const isDark = isDarkMode();
    return [
      isDark ? darkTheme : lightTheme,
      syntaxHighlighting(isDark ? darkHighlighting : lightHighlighting)
    ];
  }
  
  // Spellcheck extension
  const spellcheckExtension = EditorView.contentAttributes.of(() => ({
    spellcheck: spellcheck ? "true" : "false"
  }));
  
  onMount(() => {
    if (!editorElement) return;
    
    editor = new EditorView({
      parent: editorElement,
      doc: content,
      extensions: [
        basicSetup,
        markdown(),
        EditorView.lineWrapping,
        themeCompartment.of(getCurrentTheme()),
        spellcheckExtension,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onContentChange(update.state.doc.toString());
          }
        })
      ],
    });
    
    // Apply spellcheck class
    updateSpellcheckClass();
    
    // Listen for dark mode changes
    const observer = new MutationObserver(() => {
      updateTheme();
    });
    
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });
    
    return () => {
      observer.disconnect();
    };
  });
  
  onDestroy(() => {
    editor?.destroy();
  });
  
  // Update content when prop changes
  $effect(() => {
    if (editor && content !== editor.state.doc.toString()) {
      editor.dispatch({
        changes: {
          from: 0,
          to: editor.state.doc.length,
          insert: content
        }
      });
    }
  });
  
  // Update spellcheck when prop changes
  $effect(() => {
    updateSpellcheckClass();
    updateSpellcheckAttribute();
  });
  
  function updateTheme() {
    if (!editor) return;
    
    editor.dispatch({
      effects: themeCompartment.reconfigure(getCurrentTheme())
    });
  }
  
  function updateSpellcheckClass() {
    if (!editor) return;
    
    if (spellcheck) {
      editor.dom.classList.add('cm-spellcheck');
    } else {
      editor.dom.classList.remove('cm-spellcheck');
    }
  }
  
  function updateSpellcheckAttribute() {
    if (!editor) return;
    
    const contentElement = editor.dom.querySelector('.cm-content');
    if (contentElement) {
      contentElement.setAttribute('spellcheck', spellcheck.toString());
    }
  }
</script>

<div 
  class="h-full min-w-0 {className}" 
  {style}
>
  <div 
    bind:this={editorElement} 
    class="h-full w-full bg-white dark:bg-zinc-950 overflow-auto"
  ></div>
</div> 