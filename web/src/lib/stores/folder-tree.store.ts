import { writable, derived } from 'svelte/store';
import type { Document } from '$lib/services/documents/document.service';
import type { FolderTreeNode } from '$lib/services/documents/folder.service';

interface FolderTreeState {
    tree: FolderTreeNode[];
    expandedFolders: string[];
    isLoading: boolean;
    error: string | null;
}

const initialState: FolderTreeState = {
    tree: [],
    expandedFolders: [],
    isLoading: false,
    error: null
};

// Create the main folder tree store
const folderTreeStore = writable<FolderTreeState>(initialState);

// Derived stores for easier access
export const folderTree = derived(folderTreeStore, ($store) => $store.tree);
export const expandedFolders = derived(folderTreeStore, ($store) => $store.expandedFolders);
export const isFolderTreeLoading = derived(folderTreeStore, ($store) => $store.isLoading);
export const folderTreeError = derived(folderTreeStore, ($store) => $store.error);

// Helper function to build tree from flat document list
function buildTree(documents: Document[]): FolderTreeNode[] {
    const nodeMap = new Map<string, FolderTreeNode>();
    const rootNodes: FolderTreeNode[] = [];

    // First pass: Create all nodes
    documents.forEach(doc => {
        nodeMap.set(doc.id, {
            document: doc,
            children: []
        });
    });

    // Second pass: Build tree structure
    documents.forEach(doc => {
        const node = nodeMap.get(doc.id)!;
        if (doc.parent) {
            const parentNode = nodeMap.get(doc.parent);
            if (parentNode) {
                parentNode.children.push(node);
            } else {
                // If parent not found, treat as root node
                rootNodes.push(node);
            }
        } else {
            rootNodes.push(node);
        }
    });

    // Sort nodes: folders first, then by title
    const sortNodes = (nodes: FolderTreeNode[]) => {
        nodes.sort((a, b) => {
            if (a.document.is_folder !== b.document.is_folder) {
                return a.document.is_folder ? -1 : 1;
            }
            return a.document.title.localeCompare(b.document.title);
        });
        nodes.forEach(node => sortNodes(node.children));
    };

    sortNodes(rootNodes);
    return rootNodes;
}

// Actions
export const folderTreeActions = {
    // Set loading state
    setLoading: (loading: boolean) => {
        folderTreeStore.update(state => ({ ...state, isLoading: loading }));
    },

    // Set error
    setError: (error: string | null) => {
        folderTreeStore.update(state => ({ ...state, error }));
    },

    // Set the entire tree
    setTree: (documents: Document[]) => {
        folderTreeStore.update(state => ({
            ...state,
            tree: buildTree(documents),
            error: null
        }));
    },

    // Update a document in the tree
    updateDocument: (updatedDocument: Document) => {
        folderTreeStore.update(state => {
            const updateNode = (nodes: FolderTreeNode[]): FolderTreeNode[] => {
                return nodes.map(node => {
                    if (node.document.id === updatedDocument.id) {
                        return { ...node, document: updatedDocument };
                    }
                    if (node.children.length > 0) {
                        return { ...node, children: updateNode(node.children) };
                    }
                    return node;
                });
            };
            return {
                ...state,
                tree: updateNode(state.tree),
                error: null
            };
        });
    },

    // Add a document to the tree
    addDocument: (document: Document) => {
        folderTreeStore.update(state => {
            const addNode = (nodes: FolderTreeNode[]): FolderTreeNode[] => {
                const newNode: FolderTreeNode = { document, children: [] };
                if (!document.parent) {
                    return [...nodes, newNode];
                }
                return nodes.map(node => {
                    if (node.document.id === document.parent) {
                        return { ...node, children: [...node.children, newNode] };
                    }
                    if (node.children.length > 0) {
                        return { ...node, children: addNode(node.children) };
                    }
                    return node;
                });
            };
            return {
                ...state,
                tree: addNode(state.tree),
                error: null
            };
        });
    },

    // Remove a document from the tree
    removeDocument: (documentId: string) => {
        folderTreeStore.update(state => {
            const removeNode = (nodes: FolderTreeNode[]): FolderTreeNode[] => {
                return nodes.filter(node => {
                    if (node.document.id === documentId) {
                        return false;
                    }
                    if (node.children.length > 0) {
                        node.children = removeNode(node.children);
                    }
                    return true;
                });
            };
            return {
                ...state,
                tree: removeNode(state.tree),
                error: null
            };
        });
    },

    // Toggle folder expansion
    toggleFolder: (folderId: string) => {
        folderTreeStore.update(state => {
            const isExpanded = state.expandedFolders.includes(folderId);
            return {
                ...state,
                expandedFolders: isExpanded
                    ? state.expandedFolders.filter(id => id !== folderId)
                    : [...state.expandedFolders, folderId]
            };
        });
    },

    // Expand a folder
    expandFolder: (folderId: string) => {
        folderTreeStore.update(state => ({
            ...state,
            expandedFolders: state.expandedFolders.includes(folderId)
                ? state.expandedFolders
                : [...state.expandedFolders, folderId]
        }));
    },

    // Collapse a folder
    collapseFolder: (folderId: string) => {
        folderTreeStore.update(state => ({
            ...state,
            expandedFolders: state.expandedFolders.filter(id => id !== folderId)
        }));
    },

    // Expand multiple folders
    expandFolders: (folderIds: string[]) => {
        folderTreeStore.update(state => ({
            ...state,
            expandedFolders: [...new Set([...state.expandedFolders, ...folderIds])]
        }));
    },

    // Clear all state
    clear: () => {
        folderTreeStore.set(initialState);
    }
};

// Export the main store for direct access if needed
export { folderTreeStore }; 