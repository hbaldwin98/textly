import { writable, derived } from 'svelte/store';
import type { Document } from '$lib/services/documents/document.service';

interface DocumentState {
    documents: Document[];
    currentDocument: Document | null;
    isLoading: boolean;
    error: string | null;
}

const initialState: DocumentState = {
    documents: [],
    currentDocument: null,
    isLoading: false,
    error: null
};

// Create the main document store
const documentStore = writable<DocumentState>(initialState);

// Derived stores for easier access
export const documents = derived(documentStore, ($store) => $store.documents);
export const currentDocument = derived(documentStore, ($store) => $store.currentDocument);
export const isLoading = derived(documentStore, ($store) => $store.isLoading);
export const error = derived(documentStore, ($store) => $store.error);

// Actions
export const documentActions = {
    // Set loading state
    setLoading: (loading: boolean) => {
        documentStore.update(state => ({ ...state, isLoading: loading }));
    },

    // Set error
    setError: (error: string | null) => {
        documentStore.update(state => ({ ...state, error }));
    },

    // Set documents list
    setDocuments: (documents: Document[]) => {
        documentStore.update(state => ({ ...state, documents }));
    },

    // Add a new document to the list
    addDocument: (document: Document) => {
        documentStore.update(state => ({
            ...state,
            documents: [...state.documents, document]
        }));
    },

    // Update a document in the list
    updateDocument: (updatedDocument: Document) => {
        documentStore.update(state => ({
            ...state,
            documents: state.documents.map(doc => 
                doc.id === updatedDocument.id ? updatedDocument : doc
            )
        }));
    },

    // Remove a document from the list
    removeDocument: (documentId: string) => {
        documentStore.update(state => ({
            ...state,
            documents: state.documents.filter(doc => doc.id !== documentId)
        }));
    },

    // Set current document
    setCurrentDocument: (document: Document | null) => {
        documentStore.update(state => ({ ...state, currentDocument: document }));
    },

    // Clear all state (useful for logout)
    clear: () => {
        documentStore.set(initialState);
    }
};

// Export the main store for direct access if needed
export { documentStore }; 