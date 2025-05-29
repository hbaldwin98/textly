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
    isAIPanelOpen: boolean;
    windowWidth: number;
    isMobile: boolean;
    isTablet: boolean;
    isDesktop: boolean;
}

// Create the store
const createLayoutStore = () => {
    const { subscribe, set, update } = writable<LayoutState>({
        isSidebarOpen: false,
        isAIPanelOpen: false,
        windowWidth: typeof window !== 'undefined' ? window.innerWidth : 1024,
        isMobile: false,
        isTablet: false,
        isDesktop: true,
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
                if (isMobile && state.isSidebarOpen && state.isAIPanelOpen) {
                    newState.isAIPanelOpen = false;
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
            // If opening sidebar on mobile, close AI panel
            if (!state.isSidebarOpen && state.isMobile && state.isAIPanelOpen) {
                return { ...state, isSidebarOpen: true, isAIPanelOpen: false };
            }
            return { ...state, isSidebarOpen: !state.isSidebarOpen };
        }),
        toggleAIPanel: () =>
            update((state) => {
                // If opening AI panel on mobile, close sidebar
                if (!state.isAIPanelOpen && state.isMobile && state.isSidebarOpen) {
                    return { ...state, isAIPanelOpen: true, isSidebarOpen: false };
                }
                return { ...state, isAIPanelOpen: !state.isAIPanelOpen };
            }),
        setSidebarOpen: (isOpen: boolean) =>
            update((state) => {
                if (isOpen && state.isMobile && state.isAIPanelOpen) {
                    return { ...state, isSidebarOpen: true, isAIPanelOpen: false };
                }
                return { ...state, isSidebarOpen: isOpen };
            }),
        setAIPanelOpen: (isOpen: boolean) =>
            update((state) => {
                if (isOpen && state.isMobile && state.isSidebarOpen) {
                    return { ...state, isAIPanelOpen: true, isSidebarOpen: false };
                }
                return { ...state, isAIPanelOpen: isOpen };
            }),
        closeAll: () =>
            update((state) => ({
                ...state,
                isSidebarOpen: false,
                isAIPanelOpen: false,
            })),
    };
};

export const layoutStore = createLayoutStore();

// Derived stores for specific states
export const isMobile = derived(layoutStore, $layout => $layout.isMobile);
export const isTablet = derived(layoutStore, $layout => $layout.isTablet);
export const isDesktop = derived(layoutStore, $layout => $layout.isDesktop);
export const isSidebarOpen = derived(layoutStore, $layout => $layout.isSidebarOpen);
export const isAIPanelOpen = derived(layoutStore, $layout => $layout.isAIPanelOpen); 