import PocketBase, { type AuthRecord } from 'pocketbase';
import { updateAuthState, clearAuthState } from '$lib/stores/auth.store';

export class AuthorizationService {
    private static instance: AuthorizationService;
    private readonly pb: PocketBase;

    get token(): string { return this.pb.authStore.token; }
    get user(): AuthRecord | null { return this.pb.authStore.model as AuthRecord | null; }

    private constructor() {
        this.pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL || 'http://localhost:8080');
        this.updateReactiveStore();

        this.pb.authStore.onChange(() => {
            this.updateReactiveStore();
        });
    }

    public static getInstance(): AuthorizationService {
        if (!AuthorizationService.instance) {
            AuthorizationService.instance = new AuthorizationService();
        }
        return AuthorizationService.instance;
    }

    private updateReactiveStore() {
        updateAuthState(this.pb.authStore.token, this.pb.authStore.model as AuthRecord | null);
    }

    public async login(email: string, password: string): Promise<void> {
        const authData = await this.pb.collection('users').authWithPassword(email, password);
    }

    public async register(email: string, password: string): Promise<void> {
        await this.pb.collection('users').create({
            email,
            password,
            passwordConfirm: password,
        });
    }

    public async logout(): Promise<void> {
        this.pb.authStore.clear();
        clearAuthState();
    }
}
