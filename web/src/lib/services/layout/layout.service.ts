import { writable, derived } from 'svelte/store';

// Breakpoints
export const BREAKPOINTS = {
    sm: 640,
    md: 768,
    lg: 1024,
    xl: 1280,
    '2xl': 1536,
} as const;

// Layout state
interface LayoutState {
    isSidebarOpen: boolean;
    isAIAssistantOpen: boolean;
    windowWidth: number;
    isMobile: boolean;
    isTablet: boolean;
    isDesktop: boolean;
    isFullscreen: boolean;
}

// Storage keys
const STORAGE_KEYS = {
    SIDEBAR_OPEN: 'textly-sidebar-open',
    AI_ASSISTANT_OPEN: 'textly-ai-assistant-open',
    FULLSCREEN: 'textly-fullscreen',
} as const;

// Helper functions for local storage
function getStoredValue<T>(key: string, defaultValue: T): T {
    if (typeof window === 'undefined') return defaultValue;
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : defaultValue;
}

function setStoredValue<T>(key: string, value: T): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(key, JSON.stringify(value));
}

// Create the store
const createLayoutStore = () => {
    const { subscribe, set, update } = writable<LayoutState>({
        isSidebarOpen: getStoredValue(STORAGE_KEYS.SIDEBAR_OPEN, false),
        isAIAssistantOpen: getStoredValue(STORAGE_KEYS.AI_ASSISTANT_OPEN, false),
        windowWidth: typeof window !== 'undefined' ? window.innerWidth : 1024,
        isMobile: false,
        isTablet: false,
        isDesktop: true,
        isFullscreen: getStoredValue(STORAGE_KEYS.FULLSCREEN, false),
    });

    // Initialize window resize listener
    if (typeof window !== 'undefined') {
        const handleResize = () => {
            update(state => {
                const width = window.innerWidth;
                const isMobile = width < BREAKPOINTS.md;
                const isTablet = width >= BREAKPOINTS.md && width < BREAKPOINTS.lg;
                const isDesktop = width >= BREAKPOINTS.lg;

                // Handle panel states based on screen size
                let newState = {
                    ...state,
                    windowWidth: width,
                    isMobile,
                    isTablet,
                    isDesktop,
                };

                // On mobile, ensure only one panel is open
                if (isMobile && state.isSidebarOpen && state.isAIAssistantOpen) {
                    newState.isAIAssistantOpen = false;
                    setStoredValue(STORAGE_KEYS.AI_ASSISTANT_OPEN, false);
                }

                return newState;
            });
        };

        // Initial call
        handleResize();

        // Add listener
        window.addEventListener('resize', handleResize);
    }

    return {
        subscribe,
        set,
        update,
        toggleSidebar: () => update(state => {
            const newState = !state.isSidebarOpen;
            setStoredValue(STORAGE_KEYS.SIDEBAR_OPEN, newState);
            // If opening sidebar on mobile, close AI panel
            if (newState && state.isMobile && state.isAIAssistantOpen) {
                setStoredValue(STORAGE_KEYS.AI_ASSISTANT_OPEN, false);
                return { ...state, isSidebarOpen: newState, isAIAssistantOpen: false };
            }
            return { ...state, isSidebarOpen: newState };
        }),
        toggleAIAssistant: () =>
            update((state) => {
                const newState = !state.isAIAssistantOpen;
                setStoredValue(STORAGE_KEYS.AI_ASSISTANT_OPEN, newState);
                // If opening AI panel on mobile, close sidebar
                if (newState && state.isMobile && state.isSidebarOpen) {
                    setStoredValue(STORAGE_KEYS.SIDEBAR_OPEN, false);
                    return { ...state, isAIAssistantOpen: newState, isSidebarOpen: false };
                }
                return { ...state, isAIAssistantOpen: newState };
            }),
        setSidebarOpen: (isOpen: boolean) =>
            update((state) => {
                setStoredValue(STORAGE_KEYS.SIDEBAR_OPEN, isOpen);
                if (isOpen && state.isMobile && state.isAIAssistantOpen) {
                    setStoredValue(STORAGE_KEYS.AI_ASSISTANT_OPEN, false);
                    return { ...state, isSidebarOpen: isOpen, isAIAssistantOpen: false };
                }
                return { ...state, isSidebarOpen: isOpen };
            }),
        setAIAssistantOpen: (isOpen: boolean) =>
            update((state) => {
                setStoredValue(STORAGE_KEYS.AI_ASSISTANT_OPEN, isOpen);
                if (isOpen && state.isMobile && state.isSidebarOpen) {
                    setStoredValue(STORAGE_KEYS.SIDEBAR_OPEN, false);
                    return { ...state, isAIAssistantOpen: isOpen, isSidebarOpen: false };
                }
                return { ...state, isAIAssistantOpen: isOpen };
            }),
        setFullscreen: (isFullscreen: boolean) =>
            update((state) => {
                setStoredValue(STORAGE_KEYS.FULLSCREEN, isFullscreen);
                return { ...state, isFullscreen };
            }),
        toggleFullscreen: () =>
            update((state) => {
                const newState = !state.isFullscreen;
                setStoredValue(STORAGE_KEYS.FULLSCREEN, newState);
                return { ...state, isFullscreen: newState };
            }),
        closeAll: () =>
            update((state) => {
                setStoredValue(STORAGE_KEYS.SIDEBAR_OPEN, false);
                setStoredValue(STORAGE_KEYS.AI_ASSISTANT_OPEN, false);
                return {
                    ...state,
                    isSidebarOpen: false,
                    isAIAssistantOpen: false,
                };
            }),
    };
};

export const layoutStore = createLayoutStore();

// Derived stores for specific states
export const isMobile = derived(layoutStore, $layout => $layout.isMobile);
export const isTablet = derived(layoutStore, $layout => $layout.isTablet);
export const isDesktop = derived(layoutStore, $layout => $layout.isDesktop);
export const isSidebarOpen = derived(layoutStore, $layout => $layout.isSidebarOpen);
export const isAIAssistantOpen = derived(layoutStore, $layout => $layout.isAIAssistantOpen);
export const isFullscreen = derived(layoutStore, $layout => $layout.isFullscreen); 