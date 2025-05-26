import { writable } from 'svelte/store';
import type { AuthRecord } from 'pocketbase';

interface AuthState {
  isLoggedIn: boolean;
  user: AuthRecord | null;
  token: string;
}

const initialState: AuthState = {
  isLoggedIn: false,
  user: null,
  token: ''
};

export const authStore = writable<AuthState>(initialState);

export function updateAuthState(token: string, user: AuthRecord | null) {
  const newState = {
    isLoggedIn: !!(token && user),
    user,
    token
  };

  authStore.set(newState);
}

export function clearAuthState() {
  authStore.set(initialState);
} 