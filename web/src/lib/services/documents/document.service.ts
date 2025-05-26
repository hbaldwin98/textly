import PocketBase, { type RecordModel } from 'pocketbase';
import { AuthorizationService } from '../authorization/authorization.service';

export interface Document extends RecordModel {
    id: string;
    title: string;
    content: string;
    user: string;
    metadata?: any;
    created: string;
    updated: string;
}

export class DocumentService {
    private static instance: DocumentService;
    private readonly pb: PocketBase;
    private authService: AuthorizationService;

    private constructor() {
        this.pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL || 'http://localhost:8080');
        this.authService = AuthorizationService.getInstance();
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
            throw new Error('User not authenticated');
        }

        const records = await this.pb.collection('documents').getFullList<Document>({
            filter: `user = "${this.authService.user.id}"`,
            sort: '-updated',
        });

        return records;
    }

    /**
     * Get a specific document by ID
     */
    public async getDocument(id: string): Promise<Document> {
        const record = await this.pb.collection('documents').getOne<Document>(id);
        
        // Verify the document belongs to the current user
        if (record.user !== this.authService.user?.id) {
            throw new Error('Access denied');
        }

        return record;
    }

    /**
     * Create a new document
     */
    public async createDocument(title: string, content: string = '', metadata?: any): Promise<Document> {
        if (!this.authService.user) {
            throw new Error('User not authenticated');
        }

        const data = {
            title,
            content,
            user: this.authService.user.id,
            metadata: metadata || {}
        };

        const record = await this.pb.collection('documents').create<Document>(data);
        return record;
    }

    /**
     * Update an existing document
     */
    public async updateDocument(id: string, updates: Partial<Pick<Document, 'title' | 'content' | 'metadata'>>): Promise<Document> {
        // First verify the document belongs to the current user
        const existingDoc = await this.getDocument(id);
        
        const record = await this.pb.collection('documents').update<Document>(id, updates);
        return record;
    }

    /**
     * Delete a document
     */
    public async deleteDocument(id: string): Promise<void> {
        // First verify the document belongs to the current user
        await this.getDocument(id);
        
        await this.pb.collection('documents').delete(id);
    }

    /**
     * Subscribe to real-time changes for documents
     */
    public subscribeToDocuments(callback: (data: any) => void): () => void {
        if (!this.authService.user) {
            throw new Error('User not authenticated');
        }

        // Subscribe to changes for the current user's documents
        this.pb.collection('documents').subscribe('*', callback, {
            filter: `user = "${this.authService.user.id}"`
        });

        // Return unsubscribe function
        return () => {
            this.pb.collection('documents').unsubscribe('*');
        };
    }

    /**
     * Subscribe to real-time changes for a specific document
     */
    public subscribeToDocument(documentId: string, callback: (data: any) => void): () => void {
        this.pb.collection('documents').subscribe(documentId, callback);

        // Return unsubscribe function
        return () => {
            this.pb.collection('documents').unsubscribe(documentId);
        };
    }
} 