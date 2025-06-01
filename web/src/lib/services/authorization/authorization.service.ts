import { type AuthRecord } from 'pocketbase';
import { updateAuthState, clearAuthState } from '$lib/stores/auth.store';
import { PocketBaseService } from '../pocketbase.service';

export class AuthorizationService {
    private static instance: AuthorizationService;
    private readonly pb = PocketBaseService.getInstance().client;

    get token(): string { return this.pb.authStore.token; }
    get user(): AuthRecord | null { return this.pb.authStore.record as AuthRecord | null; }

    private constructor() {
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
        updateAuthState(this.pb.authStore.token, this.pb.authStore.record as AuthRecord | null);
    }

    public async login(email: string, password: string): Promise<void> {
         await this.pb.collection('users').authWithPassword(email, password);
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
