import { writable } from 'svelte/store';

// Store for clipboard state
export const clipboardStore = writable<{
  content: string | null;
  lastCopied: string | null;
  error: string | null;
}>({
  content: null,
  lastCopied: null,
  error: null
});

class ClipboardService {
  private static instance: ClipboardService;
  private store = clipboardStore;

  private constructor() {}

  public static getInstance(): ClipboardService {
    if (!ClipboardService.instance) {
      ClipboardService.instance = new ClipboardService();
    }
    return ClipboardService.instance;
  }

  public async copy(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.store.update(state => ({
        ...state,
        content: text,
        lastCopied: text,
        error: null
      }));

      // Clear the last copied indicator after 2 seconds
      setTimeout(() => {
        this.store.update(state => ({
          ...state,
          lastCopied: null
        }));
      }, 2000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to copy text';
      this.store.update(state => ({
        ...state,
        error: errorMessage
      }));
      throw new Error(errorMessage);
    }
  }

  public async paste(): Promise<string> {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) {
        throw new Error('No text in clipboard');
      }

      this.store.update(state => ({
        ...state,
        content: text,
        error: null
      }));

      return text;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to paste text';
      this.store.update(state => ({
        ...state,
        error: errorMessage
      }));
      throw new Error(errorMessage);
    }
  }

  public clearError(): void {
    this.store.update(state => ({
      ...state,
      error: null
    }));
  }

  public getStore() {
    return this.store;
  }
}

export const clipboardService = ClipboardService.getInstance(); 