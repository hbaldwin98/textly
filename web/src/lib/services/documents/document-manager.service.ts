import { DocumentService, type Document } from './document.service';
import { documentActions } from '$lib/stores/document.store';
import { browser } from '$app/environment';

export class DocumentManagerService {
    private static instance: DocumentManagerService;
    private documentService: DocumentService;
    private currentDocumentId: string | null = null;
    private saveTimeout: ReturnType<typeof setTimeout> | null = null;
    private unsubscribeFromDocument: (() => void) | null = null;
    private readonly SAVE_DELAY = 1000; // 1 second delay for auto-save

    private constructor() {
        this.documentService = DocumentService.getInstance();
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
    public async loadDocument(documentId: string): Promise<Document> {
        try {
            // Unsubscribe from previous document if any
            this.unsubscribeFromCurrentDocument();

            const document = await this.documentService.getDocument(documentId);
            this.currentDocumentId = documentId;
            documentActions.setCurrentDocument(document);

            // Subscribe to real-time updates for this document
            this.subscribeToCurrentDocument();

            return document;
        } catch (error) {
            documentActions.setError(error instanceof Error ? error.message : 'Failed to load document');
            throw error;
        }
    }

    /**
     * Create a new document and set it as current
     */
    public async createDocument(title: string, content: string = ''): Promise<Document> {
        try {
            const document = await this.documentService.createDocument(title, content);
            this.currentDocumentId = document.id;
            documentActions.setCurrentDocument(document);
            documentActions.addDocument(document);

            // Subscribe to real-time updates for this document
            this.subscribeToCurrentDocument();

            return document;
        } catch (error) {
            documentActions.setError(error instanceof Error ? error.message : 'Failed to create document');
            throw error;
        }
    }

    /**
     * Update the current document's content (with debounced auto-save)
     */
    public updateContent(content: string): void {
        if (!this.currentDocumentId) return;

        // Clear existing timeout
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }

        // Set new timeout for auto-save
        this.saveTimeout = setTimeout(async () => {
            try {
                await this.saveCurrentDocument({ content });
            } catch (error) {
                console.error('Auto-save failed:', error);
                documentActions.setError('Auto-save failed');
            }
        }, this.SAVE_DELAY);
    }

    /**
     * Update the current document's title
     */
    public async updateTitle(title: string): Promise<void> {
        if (!this.currentDocumentId) return;

        try {
            await this.saveCurrentDocument({ title });
        } catch (error) {
            documentActions.setError(error instanceof Error ? error.message : 'Failed to update title');
            throw error;
        }
    }

    /**
     * Save the current document immediately
     */
    public async saveCurrentDocument(updates: Partial<Pick<Document, 'title' | 'content' | 'metadata'>>): Promise<void> {
        if (!this.currentDocumentId) return;

        try {
            const updatedDocument = await this.documentService.updateDocument(this.currentDocumentId, updates);
            documentActions.updateDocument(updatedDocument);
            documentActions.setCurrentDocument(updatedDocument);
        } catch (error) {
            documentActions.setError(error instanceof Error ? error.message : 'Failed to save document');
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
     * Clear the current document
     */
    public clearCurrentDocument(): void {
        this.unsubscribeFromCurrentDocument();
        this.currentDocumentId = null;
        documentActions.setCurrentDocument(null);
        
        // Clear any pending save
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
            this.saveTimeout = null;
        }
    }

    /**
     * Subscribe to real-time updates for the current document
     */
    private subscribeToCurrentDocument(): void {
        if (!this.currentDocumentId || !browser) return;

        this.unsubscribeFromDocument = this.documentService.subscribeToDocument(
            this.currentDocumentId,
            (data) => {
                // Handle real-time updates
                if (data.action === 'update' && data.record) {
                    const updatedDocument = data.record as Document;
                    documentActions.updateDocument(updatedDocument);
                    documentActions.setCurrentDocument(updatedDocument);
                } else if (data.action === 'delete') {
                    // Document was deleted by another client
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
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }
    }
} 