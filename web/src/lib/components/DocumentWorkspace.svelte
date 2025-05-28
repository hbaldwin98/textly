<script lang="ts">
    import FolderTree from './FolderTree.svelte';
    import { DocumentManagerService } from '$lib/services/documents/document-manager.service';
    import type { Document } from '$lib/services/documents/document.service';

    let documentManager = DocumentManagerService.getInstance();
    let currentFolderId: string | null = null;
    let currentDocument: Document | null = null;
    let sidebarVisible = true;

    function handleDocumentSelect(document: Document) {
        if (!document.is_folder) {
            documentManager.loadDocument(document.id);
            currentDocument = document;
        }
    }

    function handleFolderSelect(folderId: string | null) {
        currentFolderId = folderId;
        // Clear current document when navigating folders
        currentDocument = null;
        documentManager.clearCurrentDocument();
    }

    function toggleSidebar() {
        sidebarVisible = !sidebarVisible;
    }
</script>

<div class="workspace">
    <!-- Sidebar Toggle -->
    <button class="sidebar-toggle" on:click={toggleSidebar}>
        {sidebarVisible ? '◀' : '▶'}
    </button>

    <!-- Folder Sidebar -->
    {#if sidebarVisible}
        <div class="sidebar">
            <FolderTree 
                {currentFolderId}
                onDocumentSelect={handleDocumentSelect}
                onFolderSelect={handleFolderSelect}
            />
        </div>
    {/if}

    <!-- Main Content Area -->
    <div class="main-content" class:full-width={!sidebarVisible}>
        {#if currentDocument}
            <div class="document-header">
                <h1>{currentDocument.title}</h1>
                <div class="document-meta">
                    <span>Created: {new Date(currentDocument.created).toLocaleDateString()}</span>
                    <span>Modified: {new Date(currentDocument.updated).toLocaleDateString()}</span>
                </div>
            </div>
            <div class="document-content">
                <!-- This is where your document editor would go -->
                <textarea 
                    value={currentDocument.content}
                    placeholder="Start writing..."
                    class="editor"
                ></textarea>
            </div>
        {:else}
            <div class="empty-state">
                <h2>Welcome to Textly</h2>
                <p>Select a document from the sidebar to start editing, or create a new one.</p>
                {#if currentFolderId}
                    <p class="current-folder">
                        📁 Current folder: <strong>{currentFolderId}</strong>
                    </p>
                {/if}
            </div>
        {/if}
    </div>
</div>

<style>
    .workspace {
        display: flex;
        height: 100vh;
        position: relative;
    }

    .sidebar-toggle {
        position: absolute;
        top: 1rem;
        left: 0.5rem;
        z-index: 1002;
        background: var(--bg-primary, white);
        border: 1px solid var(--border-color, #e1e5e9);
        border-radius: 4px;
        padding: 0.5rem;
        cursor: pointer;
        font-size: 0.8rem;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .sidebar {
        width: 300px;
        min-width: 250px;
        max-width: 400px;
        background: var(--bg-secondary, #f8f9fa);
        border-right: 1px solid var(--border-color, #e1e5e9);
        overflow: hidden;
        resize: horizontal;
    }

    .main-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        background: var(--bg-primary, white);
        overflow: hidden;
    }

    .main-content.full-width {
        margin-left: 0;
    }

    .document-header {
        padding: 2rem 2rem 1rem 2rem;
        border-bottom: 1px solid var(--border-color, #e1e5e9);
        background: var(--bg-primary, white);
    }

    .document-header h1 {
        margin: 0 0 0.5rem 0;
        font-size: 1.5rem;
        font-weight: 600;
        color: var(--text-primary, #212529);
    }

    .document-meta {
        display: flex;
        gap: 1rem;
        font-size: 0.875rem;
        color: var(--text-secondary, #6c757d);
    }

    .document-content {
        flex: 1;
        padding: 2rem;
        overflow: auto;
    }

    .editor {
        width: 100%;
        height: 100%;
        min-height: 400px;
        border: 1px solid var(--border-color, #e1e5e9);
        border-radius: 8px;
        padding: 1rem;
        font-family: 'Monaco', 'Consolas', monospace;
        font-size: 0.9rem;
        line-height: 1.6;
        resize: none;
        outline: none;
        background: var(--bg-primary, white);
    }

    .editor:focus {
        border-color: var(--primary-color, #007bff);
        box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
    }

    .empty-state {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        padding: 2rem;
        color: var(--text-secondary, #6c757d);
    }

    .empty-state h2 {
        margin: 0 0 1rem 0;
        font-size: 2rem;
        font-weight: 300;
        color: var(--text-primary, #212529);
    }

    .empty-state p {
        margin: 0 0 0.5rem 0;
        font-size: 1.1rem;
    }

    .current-folder {
        margin-top: 1rem !important;
        padding: 1rem;
        background: var(--bg-tertiary, #f0f1f2);
        border-radius: 8px;
        font-size: 0.9rem !important;
    }

    @media (max-width: 768px) {
        .sidebar {
            position: absolute;
            top: 0;
            left: 0;
            height: 100%;
            z-index: 1001;
            box-shadow: 2px 0 8px rgba(0,0,0,0.1);
        }

        .sidebar-toggle {
            left: 0.5rem;
        }
    }
</style> 