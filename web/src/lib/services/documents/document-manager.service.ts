import { DocumentService, type Document } from './document.service';
import { documentActions, documentStore } from '$lib/stores/document.store';
import { get } from 'svelte/store';

export class DocumentManagerService {
    private static instance: DocumentManagerService;
    private documentService: DocumentService;
    private currentDocumentId: string | null = null;
    private unsubscribeFromDocument: (() => void) | null = null;
    private readonly SAVE_DELAY = 1000;
    private debouncedSave: ((content: string) => Promise<void>) | null = null;

    private constructor() {
        this.documentService = DocumentService.getInstance();
        this.debouncedSave = this.createDebouncedSave();
    }

    /**
     * Create a debounced save function
     */
    private createDebouncedSave(): (content: string) => Promise<void> {
        let timeoutId: ReturnType<typeof setTimeout> | null = null;
        let currentResolve: (() => void) | null = null;
        let currentReject: ((error: any) => void) | null = null;
        let targetDocumentId: string | null = null;

        return (content: string): Promise<void> => {
            return new Promise((resolve, reject) => {
                // Clear any existing timeout and reject previous promise
                if (timeoutId) {
                    clearTimeout(timeoutId);
                    if (currentResolve) {
                        currentResolve(); // Resolve previous promise since it's being superseded
                    }
                }

                currentResolve = resolve;
                currentReject = reject;
                targetDocumentId = this.currentDocumentId;

                timeoutId = setTimeout(async () => {
                    try {
                        // Only save if we're still editing the same document
                        if (targetDocumentId && targetDocumentId === this.currentDocumentId) {
                            await this.documentService.updateDocument(targetDocumentId, { content });
                        }
                        if (currentResolve) {
                            currentResolve();
                            currentResolve = null;
                            currentReject = null;
                        }
                    } catch (error) {
                        console.error('Failed to save document:', error);
                        if (currentReject) {
                            currentReject(error);
                            currentResolve = null;
                            currentReject = null;
                        }
                    }
                }, this.SAVE_DELAY);
            });
        };
    }

    public static getInstance(): DocumentManagerService {
        if (!DocumentManagerService.instance) {
            DocumentManagerService.instance = new DocumentManagerService();
        }
        return DocumentManagerService.instance;
    }

    /**
     * Load a document and set it as current
     */
    public async loadDocument(documentId: string): Promise<void> {
        try {
            // Clear any pending saves on the previous document
            this.clearCurrentDocument();

            const document = await this.documentService.getDocument(documentId);
            this.currentDocumentId = documentId;

            documentActions.setCurrentDocument(document);
            this.debouncedSave = this.createDebouncedSave();
            this.subscribeToCurrentDocument();
        } catch (error) {
            console.error('Failed to load document:', error);
            throw error;
        }
    }

    /**
     * Create a new document and set it as current
     */
    public async createDocument(title: string, content: string = '', parentId?: string): Promise<Document> {
        try {
            const document = await this.documentService.createDocument(title, content, undefined, parentId || undefined);
            this.currentDocumentId = document.id;
            documentActions.setCurrentDocument(document);
            documentActions.addDocument(document);

            this.subscribeToCurrentDocument();

            return document;
        } catch (error) {
            documentActions.setError(error instanceof Error ? error.message : 'Failed to create document');
            throw error;
        }
    }

    /**
     * Create a new folder
     */
    public async createFolder(title: string, parentId?: string): Promise<Document> {
        try {
            const folder = await this.documentService.createFolder(title, parentId || undefined);
            documentActions.addDocument(folder);
            return folder;
        } catch (error) {
            documentActions.setError(error instanceof Error ? error.message : 'Failed to create folder');
            throw error;
        }
    }

    /**
     * Update the current document's content (with debounced auto-save)
     */
    public async updateContent(content: string): Promise<void> {
        if (!this.currentDocumentId) return;

        // Immediately update the local store for instant UI feedback
        const currentDoc = get(documentStore).currentDocument;
        if (currentDoc) {
            const updatedDocument = {
                ...currentDoc,
                content,
                updated: new Date().toISOString()
            };
            documentActions.updateDocument(updatedDocument);
            documentActions.setCurrentDocument(updatedDocument);
        }

        if (!this.debouncedSave) return;
        // Debounce the server save in the background
        try {
            await this.debouncedSave(content);
        } catch (error) {
            // Error is already logged in debouncedSave
        }
    }

    /**
     * Update the document's title
     */
    public async updateTitle(documentId: string, title: string): Promise<void> {
        try {
            await this.documentService.updateDocument(documentId, { title });
        } catch (error) {
            console.error('Failed to update title:', error);
            throw error;
        }
    }

    /**
     * Delete a document by ID
     */
    public async deleteDocument(documentId: string): Promise<void> {
        try {
            // If we're deleting the current document, clear it first to prevent any pending saves
            if (this.currentDocumentId === documentId) {
                this.clearCurrentDocument();
            }

            await this.documentService.deleteDocument(documentId);
            documentActions.removeDocument(documentId);
        } catch (error) {
            documentActions.setError(error instanceof Error ? error.message : 'Failed to delete document');
            throw error;
        }
    }

    /**
     * Delete the current document
     */
    public async deleteCurrentDocument(): Promise<void> {
        if (!this.currentDocumentId) return;

        try {
            await this.documentService.deleteDocument(this.currentDocumentId);
            documentActions.removeDocument(this.currentDocumentId);
            this.unsubscribeFromCurrentDocument();
            this.currentDocumentId = null;
            documentActions.setCurrentDocument(null);
        } catch (error) {
            documentActions.setError(error instanceof Error ? error.message : 'Failed to delete document');
            throw error;
        }
    }

    /**
     * Get the current document ID
     */
    public getCurrentDocumentId(): string | null {
        return this.currentDocumentId;
    }

    /**
     * Clear the current document and any pending saves
     */
    public clearCurrentDocument(): void {
        this.unsubscribeFromCurrentDocument();
        this.currentDocumentId = null;
        documentActions.setCurrentDocument(null);

        // Reset debounced save to clear any pending saves
        this.debouncedSave = this.createDebouncedSave();
    }

    /**
     * Subscribe to real-time updates for the current document
     */
    private subscribeToCurrentDocument(): void {
        if (!this.currentDocumentId) return;

        this.unsubscribeFromDocument = this.documentService.subscribeToDocument(
            this.currentDocumentId,
            (data) => {
                if (data.action === 'update' && data.record) {
                    const updatedDocument = data.record as Document;
                    // Always update with server content - components decide how to handle updates
                    documentActions.updateDocument(updatedDocument);
                    documentActions.setCurrentDocument(updatedDocument);
                } else if (data.action === 'delete') {
                    documentActions.removeDocument(this.currentDocumentId!);
                    this.clearCurrentDocument();
                }
            }
        );
    }

    /**
     * Unsubscribe from current document updates
     */
    private unsubscribeFromCurrentDocument(): void {
        if (this.unsubscribeFromDocument) {
            this.unsubscribeFromDocument();
            this.unsubscribeFromDocument = null;
        }
    }

    /**
     * Cleanup when service is destroyed
     */
    public destroy(): void {
        this.unsubscribeFromCurrentDocument();
        // Clear any pending saves by setting debouncedSave to null
        this.debouncedSave = null;
    }
} 