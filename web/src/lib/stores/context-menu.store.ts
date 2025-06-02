import { writable } from 'svelte/store';

type ContextMenuState = {
  visible: boolean;
  type: string | null;
  x: number;
  y: number;
  targetId: string | null;
  data?: any; // Additional data specific to the menu type
};

function createContextMenuStore() {
  const { subscribe, set, update } = writable<ContextMenuState>({
    visible: false,
    type: null,
    x: 0,
    y: 0,
    targetId: null,
    data: null
  });

  return {
    subscribe,
    show: (type: string, x: number, y: number, targetId: string | null = null, data?: any) => {
      set({ visible: true, type, x, y, targetId, data });
    },
    hide: () => {
      set({ visible: false, type: null, x: 0, y: 0, targetId: null, data: null });
    },
    // Utility function to check if a click is outside a context menu
    isClickOutside: (event: MouseEvent, menuSelector: string, triggerSelector?: string): boolean => {
      const target = event.target as HTMLElement;
      return !target.closest(menuSelector) && (!triggerSelector || !target.closest(triggerSelector));
    }
  };
}

export const contextMenu = createContextMenuStore();

// Shared click outside handler
export function handleClickOutside(event: MouseEvent, menuSelector: string, triggerSelector?: string) {
  if (contextMenu.isClickOutside(event, menuSelector, triggerSelector)) {
    contextMenu.hide();
  }
}

// Shared escape key handler
export function handleEscapeKey(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    contextMenu.hide();
  }
} 