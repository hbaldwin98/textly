import PocketBase, { type AuthRecord } from 'pocketbase';
import { updateAuthState, clearAuthState } from '$lib/stores/auth.store';
import { browser } from '$app/environment';

export class AuthorizationService {
    private static instance: AuthorizationService;
    private readonly pb: PocketBase;

    get token(): string { return this.pb.authStore.token; }
    get user(): AuthRecord { return this.pb.authStore.record as AuthRecord; }

    private constructor() {
        this.pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL || 'http://localhost:8080');
        
        // PocketBase automatically loads from localStorage by default
        // The auth store will automatically restore the auth state if valid data exists
        
        // In browser, check if we have stored auth data and ensure it's loaded
        if (browser) {
            // Check all localStorage keys to find PocketBase auth data
            console.log('All localStorage keys:', Object.keys(localStorage));
            
            // Common PocketBase localStorage keys
            const possibleKeys = ['pocketbase_auth', 'pb_auth', `pb_auth_${import.meta.env.VITE_POCKETBASE_URL}`];
            for (const key of possibleKeys) {
                const storedAuth = localStorage.getItem(key);
                if (storedAuth) {
                    console.log(`Found auth data in key "${key}":`, storedAuth.substring(0, 100) + '...');
                }
            }
        }
        
        // Update the reactive store with the current auth state (including any restored state)
        this.updateReactiveStore();
        
        // Listen for auth store changes and update reactive store
        this.pb.authStore.onChange(() => {
            this.updateReactiveStore();
        });
        
        // Debug: Log the initial auth state
        if (browser) {
            console.log('PocketBase auth initialized:', {
                isValid: this.pb.authStore.isValid,
                token: this.pb.authStore.token ? 'present' : 'missing',
                user: this.pb.authStore.record ? 'present' : 'missing',
                localStorageKeys: Object.keys(localStorage).filter(key => key.includes('pb') || key.includes('pocket'))
            });
        }
    }
    
    private updateReactiveStore() {
        updateAuthState(this.pb.authStore.token, this.pb.authStore.record as AuthRecord);
    }

    public static getInstance(): AuthorizationService {
        if (!AuthorizationService.instance) {
            AuthorizationService.instance = new AuthorizationService();
        }

        return AuthorizationService.instance;
    }

    public async login(email: string, password: string): Promise<void> {
        // PocketBase automatically saves to localStorage when using authWithPassword
        const authData = await this.pb.collection('users').authWithPassword(email, password);
        
        if (browser) {
            console.log('Login successful:', {
                token: authData.token ? 'present' : 'missing',
                record: authData.record ? 'present' : 'missing',
                authStoreValid: this.pb.authStore.isValid,
                localStorageKeys: Object.keys(localStorage).filter(key => key.includes('pb') || key.includes('pocket'))
            });
        }
    }

    public async logout(): Promise<void> {
        if (browser) {
            console.log('Logout - before clear:', {
                isValid: this.pb.authStore.isValid,
                localStorageKeys: Object.keys(localStorage).filter(key => key.includes('pb') || key.includes('pocket'))
            });
        }
        
        // PocketBase clear() automatically removes from localStorage
        this.pb.authStore.clear();
        
        if (browser) {
            console.log('Logout - after clear:', {
                isValid: this.pb.authStore.isValid,
                localStorageKeys: Object.keys(localStorage).filter(key => key.includes('pb') || key.includes('pocket'))
            });
        }
        
        // Update reactive store
        clearAuthState();
    }

    public async register(email: string, password: string): Promise<void> {
         await this.pb.collection('users').create({ 
            email, 
            password, 
            passwordConfirm: password 
        });
    }
}
