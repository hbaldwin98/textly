import PocketBase, { type SendOptions, type BeforeSendResult } from 'pocketbase';
import { VITE_POCKETBASE_URL } from '$env/static/private';

export class PocketBaseService {
    private static instance: PocketBaseService;
    private readonly pb: PocketBase;
    private connectionState: 'connected' | 'disconnected' | 'connecting' = 'disconnected';
    private isBrowser: boolean;

    private constructor() {
        this.pb = new PocketBase(VITE_POCKETBASE_URL || 'http://localhost:8080');
        this.isBrowser = typeof window !== 'undefined';
        
        // Listen for connection state changes
        this.pb.beforeSend = (url: string, options: SendOptions): BeforeSendResult => {
            this.connectionState = 'connecting';
            return { url, options };
        };

        this.pb.afterSend = (response: Response, data: any) => {
            this.connectionState = 'connected';
            return data;
        };

        // Only initialize realtime features in browser environment
        if (this.isBrowser) {
            // Handle connection state through the realtime connection
            this.pb.realtime.subscribe('*', () => {
                this.connectionState = 'connected';
            });

            // Handle disconnection
            this.pb.realtime.subscribe('disconnect', () => {
                this.connectionState = 'disconnected';
            });
        }
    }

    public static getInstance(): PocketBaseService {
        if (!PocketBaseService.instance) {
            PocketBaseService.instance = new PocketBaseService();
        }
        return PocketBaseService.instance;
    }

    public get client(): PocketBase {
        return this.pb;
    }

    public get isConnected(): boolean {
        return this.connectionState === 'connected';
    }

    public get connectionStatus(): 'connected' | 'disconnected' | 'connecting' {
        return this.connectionState;
    }

    /**
     * Subscribe to a collection with automatic reconnection
     */
    public subscribeWithRetry(
        collection: string,
        callback: (data: any) => void,
        options?: { filter?: string }
    ): () => void {
        // If not in browser, return a no-op function
        if (!this.isBrowser) {
            return () => {};
        }

        const subscribe = () => {
            try {
                this.pb.collection(collection).subscribe('*', callback, options);
            } catch (error) {
                console.error(`Failed to subscribe to ${collection}:`, error);
                // Retry after a delay
                setTimeout(subscribe, 5000);
            }
        };

        // Initial subscription
        subscribe();

        // Return unsubscribe function
        return () => {
            this.pb.collection(collection).unsubscribe('*');
        };
    }
} 