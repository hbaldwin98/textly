import PocketBase, { type RecordModel } from 'pocketbase';
import { AuthorizationService } from '../authorization/authorization.service';
import { PocketBaseService } from '../pocketbase.service';

export interface Document extends RecordModel {
    id: string;
    title: string;
    content: string;
    user: string;
    parent?: string | null; // Parent document ID for hierarchical structure
    is_folder: boolean; // Whether this is a folder or a document
    metadata?: any;
    created: string;
    updated: string;
}

export class DocumentService {
    private static instance: DocumentService;
    private readonly pb: PocketBase;
    private readonly pbService = PocketBaseService.getInstance();
    private authService: AuthorizationService;
    private documentCache: Map<string, Document> = new Map();
    private unsubscribeFromCache: (() => void) | null = null;

    private constructor() {
        this.pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL || 'http://localhost:8080');
        this.authService = AuthorizationService.getInstance();
    }

    private async initializeCache() {
        if (!this.authService.token) {
            console.log('DocumentService: Not authenticated, skipping cache initialization');
            return;
        }

        try {
            const records = await this.pb.collection('documents').getFullList<Document>({
                filter: `user = "${this.authService.user?.id}"`,
                sort: '-updated',
            });
            
            records.forEach(doc => this.documentCache.set(doc.id, doc));

            // Subscribe to realtime updates
            this.unsubscribeFromCache = this.subscribeToDocuments((data) => {
                if (data.action === 'create' || data.action === 'update') {
                    this.documentCache.set(data.record.id, data.record);
                } else if (data.action === 'delete') {
                    this.documentCache.delete(data.record.id);
                }
            });
        } catch (error) {
            console.error('Failed to initialize document cache:', error);
        }
    }

    public static getInstance(): DocumentService {
        if (!DocumentService.instance) {
            DocumentService.instance = new DocumentService();
        }
        return DocumentService.instance;
    }

    /**
     * Get all documents for the current user
     */
    public async getDocuments(): Promise<Document[]> {
        if (!this.authService.user) {
            console.log('DocumentService: User not authenticated');
            throw new Error('User not authenticated');
        }

        // Initialize cache if empty
        if (this.documentCache.size === 0) {
            await this.initializeCache();
        }

        // If we have a populated cache, use it
        if (this.documentCache.size > 0) {
            return Array.from(this.documentCache.values())
                .filter(doc => doc.user === this.authService.user?.id)
                .sort((a, b) => new Date(b.updated).getTime() - new Date(a.updated).getTime());
        }

        // Fallback to direct PocketBase query if cache is still empty
        try {
            const records = await this.pb.collection('documents').getFullList<Document>({
                filter: `user = "${this.authService.user.id}"`,
                sort: '-updated',
            });
            return records;
        } catch (error) {
            // If it's an auto-cancellation error, return cached documents or empty array
            if (error instanceof Error && error.message.includes('autocancelled')) {
                return Array.from(this.documentCache.values())
                    .filter(doc => doc.user === this.authService.user?.id)
                    .sort((a, b) => new Date(b.updated).getTime() - new Date(a.updated).getTime());
            }
            console.error('DocumentService: Error fetching documents:', error);
            throw error;
        }
    }

    /**
     * Get all documents with minimal data (titles and metadata only) for performance
     */
    public async getDocumentTitles(): Promise<Pick<Document, 'id' | 'title' | 'user' | 'created' | 'updated' | 'is_folder'>[]> {
        if (!this.authService.user) {
            throw new Error('User not authenticated');
        }

        // Initialize cache if empty
        if (this.documentCache.size === 0) {
            await this.initializeCache();
        }

        // If we have a populated cache, use it
        if (this.documentCache.size > 0) {
            return Array.from(this.documentCache.values())
                .filter(doc => doc.user === this.authService.user?.id)
                .map(doc => ({
                    id: doc.id,
                    title: doc.title,
                    user: doc.user,
                    created: doc.created,
                    updated: doc.updated,
                    is_folder: doc.is_folder
                }))
                .sort((a, b) => new Date(b.updated).getTime() - new Date(a.updated).getTime());
        }

        try {
            const records = await this.pb.collection('documents').getFullList<Document>({
                filter: `user = "${this.authService.user.id}"`,
                sort: '-updated',
                fields: 'id,title,user,created,updated,is_folder',
            });
            return records;
        } catch (error) {
            // If it's an auto-cancellation error, return cached documents or empty array
            if (error instanceof Error && error.message.includes('autocancelled')) {
                return Array.from(this.documentCache.values())
                    .filter(doc => doc.user === this.authService.user?.id)
                    .map(doc => ({
                        id: doc.id,
                        title: doc.title,
                        user: doc.user,
                        created: doc.created,
                        updated: doc.updated,
                        is_folder: doc.is_folder
                    }))
                    .sort((a, b) => new Date(b.updated).getTime() - new Date(a.updated).getTime());
            }
            throw error;
        }
    }

    /**
     * Get a specific document by ID
     */
    public async getDocument(id: string): Promise<Document | null> {
        // Check cache first
        const cachedDoc = this.documentCache.get(id);
        if (cachedDoc) return cachedDoc;

        try {
            const record = await this.pb.collection('documents').getOne<Document>(id);

            // Verify the document belongs to the current user
            if (record.user !== this.authService.user?.id) {
                throw new Error('Access denied');
            }

            // Update cache
            this.documentCache.set(id, record);
            return record;
        } catch (error) {
            // If it's an auto-cancellation error, return null instead of throwing
            if (error instanceof Error && error.message.includes('autocancelled')) {
                return null;
            }
            throw error;
        }
    }

    /**
     * Create a new document
     */
    public async createDocument(title: string, content: string = '', metadata?: any, parent?: string): Promise<Document> {
        if (!this.authService.user) {
            throw new Error('User not authenticated');
        }

        const data = {
            title,
            content,
            user: this.authService.user.id,
            parent: parent || null,
            is_folder: false,
            metadata: metadata || {}
        };

        const record = await this.pb.collection('documents').create<Document>(data);
        return record;
    }

    /**
     * Create a new folder
     */
    public async createFolder(title: string, parent?: string): Promise<Document> {
        if (!this.authService.user) {
            throw new Error('User not authenticated');
        }

        const data = {
            title,
            content: '', // Folders don't have content
            user: this.authService.user.id,
            parent: parent || null,
            is_folder: true,
            metadata: {}
        };

        const record = await this.pb.collection('documents').create<Document>(data);
        return record;
    }

    /**
     * Get documents in a specific folder (or root level if no parent specified)
     */
    public async getDocumentsInFolder(parentId?: string | null): Promise<Document[]> {
        if (!this.authService.user) {
            throw new Error('User not authenticated');
        }

        const filter = parentId 
            ? `user = "${this.authService.user.id}" && parent = "${parentId}"`
            : `user = "${this.authService.user.id}" && parent = null`;

        const records = await this.pb.collection('documents').getFullList<Document>({
            filter,
            sort: 'is_folder desc, title',
            expand: 'parent',
        });

        return records;
    }

    /**
     * Get the full path to a document (breadcrumb trail)
     */
    public async getDocumentPath(documentId: string): Promise<Document[]> {
        const path: Document[] = [];
        let currentDoc = await this.getDocument(documentId);
        
        if (!currentDoc) return path;
        
        path.unshift(currentDoc);
        
        while (currentDoc.parent) {
            currentDoc = await this.getDocument(currentDoc.parent);
            if (!currentDoc) break;
            path.unshift(currentDoc);
        }
        
        return path;
    }

    /**
     * Move a document to a different folder
     */
    public async moveDocument(documentId: string, newParentId?: string | null): Promise<void> {
        // Validate that we're not creating a circular reference
        if (newParentId) {
            const documentPath = await this.getDocumentPath(newParentId);
            if (documentPath.some(doc => doc.id === documentId)) {
                throw new Error('Cannot move folder into itself or its descendants');
            }
        }

        await this.pb.collection('documents').update<Document>(documentId, {
            parent: newParentId || null
        });
    }

    /**
     * Update an existing document
     */
    public async updateDocument(id: string, updates: Partial<Pick<Document, 'title' | 'content' | 'metadata' | 'parent'>>): Promise<void> {
        await this.pb.collection('documents').update<Document>(id, updates, {
            fields: 'id',
        });
    }

    /**
     * Delete a document
     */
    public async deleteDocument(id: string): Promise<void> {
        await this.pb.collection('documents').delete(id);
    }

    /**
     * Subscribe to real-time changes for documents
     */
    public subscribeToDocuments(callback: (data: any) => void): () => void {
        if (!this.authService.user) {
            throw new Error('User not authenticated');
        }

        // Subscribe to changes for the current user's documents with retry
        return this.pbService.subscribeWithRetry('documents', callback, {
            filter: `user = "${this.authService.user.id}"`
        });
    }

    /**
     * Subscribe to real-time changes for a specific document
     */
    public subscribeToDocument(documentId: string, callback: (data: any) => void): () => void {
        // Subscribe to changes for a specific document with retry
        return this.pbService.subscribeWithRetry('documents', callback, {
            filter: `id = "${documentId}"`
        });
    }

    /**
     * Clear the document cache
     */
    public clearCache(): void {
        this.documentCache.clear();
        if (this.unsubscribeFromCache) {
            this.unsubscribeFromCache();
            this.unsubscribeFromCache = null;
        }
    }

    /**
     * Cleanup when service is destroyed
     */
    public destroy(): void {
        this.clearCache();
    }
} 