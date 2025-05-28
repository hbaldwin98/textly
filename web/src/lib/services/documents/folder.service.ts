import { DocumentService, type Document } from './document.service';

export interface FolderTreeNode {
    document: Document;
    children: FolderTreeNode[];
    expanded?: boolean;
}

export class FolderService {
    private static instance: FolderService;
    private documentService: DocumentService;

    private constructor() {
        this.documentService = DocumentService.getInstance();
    }

    public static getInstance(): FolderService {
        if (!FolderService.instance) {
            FolderService.instance = new FolderService();
        }
        return FolderService.instance;
    }

    /**
     * Get all documents and folders in a hierarchical tree structure
     */
    public async getFolderTree(): Promise<FolderTreeNode[]> {
        try {
            const allDocuments = await this.documentService.getDocuments();
            
            if (!Array.isArray(allDocuments)) {
                console.error('FolderService: Invalid response from getDocuments:', allDocuments);
                throw new Error('Invalid response from document service');
            }
            
            const tree = this.buildTree(allDocuments);
            return tree;
        } catch (error) {
            console.error('FolderService: Error getting folder tree:', error);
            throw error;
        }
    }

    /**
     * Get only folders in a hierarchical tree structure
     */
    public async getFolderTreeFoldersOnly(): Promise<FolderTreeNode[]> {
        const allDocuments = await this.documentService.getDocuments();
        const folders = allDocuments.filter(doc => doc.is_folder);
        return this.buildTree(folders);
    }

    /**
     * Build a hierarchical tree from flat document list
     */
    private buildTree(documents: Document[], parentId: string | null = null): FolderTreeNode[] {
        // Get all documents that belong to this parent
        const children = documents.filter(doc => {
            // Handle both null and empty string parent values
            const docParent = doc.parent || null;
            const matches = docParent === parentId;
            return matches;
        });
        
        
        // Sort children: folders first, then documents, both alphabetically by title
        children.sort((a, b) => {
            if (a.is_folder !== b.is_folder) {
                return a.is_folder ? -1 : 1;
            }
            return (a.title || '').localeCompare(b.title || '');
        });
        
        const result = children.map(doc => {
            const node: FolderTreeNode = {
                document: doc,
                children: this.buildTree(documents, doc.id),
                expanded: false
            };
            return node;
        });
        
        return result;
    }

    /**
     * Get breadcrumb path for navigation
     */
    public async getBreadcrumbs(documentId?: string | null): Promise<Document[]> {
        if (!documentId) return [];
        return await this.documentService.getDocumentPath(documentId);
    }

    /**
     * Get all possible parent folders for a document (excluding itself and its descendants)
     */
    public async getValidParentFolders(excludeDocumentId?: string): Promise<Document[]> {
        const allDocuments = await this.documentService.getDocuments();
        const folders = allDocuments.filter(doc => doc.is_folder);
        
        if (!excludeDocumentId) {
            return folders;
        }

        // Get all descendants of the excluded document to avoid circular references
        const descendants = this.getDescendants(excludeDocumentId, allDocuments);
        const excludeIds = new Set([excludeDocumentId, ...descendants.map(d => d.id)]);
        
        return folders.filter(folder => !excludeIds.has(folder.id));
    }

    /**
     * Get all descendants of a document
     */
    private getDescendants(documentId: string, allDocuments: Document[]): Document[] {
        const directChildren = allDocuments.filter(doc => doc.parent === documentId);
        const descendants: Document[] = [...directChildren];
        
        for (const child of directChildren) {
            descendants.push(...this.getDescendants(child.id, allDocuments));
        }
        
        return descendants;
    }

    /**
     * Create a new folder
     */
    public async createFolder(title: string, parentId?: string): Promise<Document> {
        return await this.documentService.createFolder(title, parentId);
    }

    /**
     * Move document to folder
     */
    public async moveToFolder(documentId: string, targetFolderId?: string | null): Promise<void> {
        return await this.documentService.moveDocument(documentId, targetFolderId);
    }

    /**
     * Check if a document can be moved to a target folder (no circular references)
     */
    public async canMoveToFolder(documentId: string, targetFolderId?: string | null): Promise<boolean> {
        if (!targetFolderId) return true; // Can always move to root
        
        try {
            const targetPath = await this.documentService.getDocumentPath(targetFolderId);
            return !targetPath.some(doc => doc.id === documentId);
        } catch {
            return false;
        }
    }

    /**
     * Get folder statistics (number of items, nested count, etc.)
     */
    public async getFolderStats(folderId: string): Promise<{
        directChildren: number;
        totalDescendants: number;
        folders: number;
        documents: number;
    }> {
        const allDocuments = await this.documentService.getDocuments();
        const directChildren = allDocuments.filter(doc => doc.parent === folderId);
        const descendants = this.getDescendants(folderId, allDocuments);
        
        return {
            directChildren: directChildren.length,
            totalDescendants: descendants.length,
            folders: descendants.filter(doc => doc.is_folder).length,
            documents: descendants.filter(doc => !doc.is_folder).length
        };
    }
} 