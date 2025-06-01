<script lang="ts">
  import { Button, Input, Card } from '../ui';
  import { AuthorizationService } from '$lib/services/authorization/authorization.service';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  interface Props {
    onSwitchToRegister?: () => void;
  }

  let { onSwitchToRegister }: Props = $props();

  let email = $state('');
  let password = $state('');
  let loading = $state(false);
  let error = $state('');

  let authService: AuthorizationService | null = null;

  onMount(() => {
    authService = AuthorizationService.getInstance();
  });

  async function handleSubmit(event: Event) {
    event.preventDefault();
    
    if (!email || !password) {
      error = 'Please fill in all fields';
      return;
    }

    loading = true;
    error = '';

    try {
      await authService?.login(email, password);
      goto('/'); // Redirect to home page after successful login
    } catch (err: any) {
      error = err.message || 'Login failed. Please check your credentials.';
    } finally {
      loading = false;
    }
  }
</script>

<div class="min-h-screen flex items-center justify-center p-4">
  <Card class="w-full max-w-md p-6 bg-white dark:bg-zinc-900">
    <div class="space-y-6">
      <div class="text-center relative">
        <button
          type="button"
          class="absolute left-0 top-0 text-gray-500 hover:text-gray-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          onclick={() => goto('/')}
          title="Close"
          aria-label="Close"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-zinc-100">Welcome back</h1>
        <p class="text-gray-600 dark:text-zinc-400">Sign in to your account</p>
      </div>

      <form onsubmit={handleSubmit} class="space-y-4">
        <Input
          id="email"
          type="email"
          label="Email"
          placeholder="Enter your email"
          bind:value={email}
          required
          disabled={loading}
          class="dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-100 dark:placeholder-zinc-500"
        />

        <Input
          id="password"
          type="password"
          label="Password"
          placeholder="Enter your password"
          bind:value={password}
          required
          disabled={loading}
          class="dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-100 dark:placeholder-zinc-500"
        />

        {#if error}
          <div class="rounded-lg bg-red-50 p-3 dark:bg-red-900/20">
            <p class="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        {/if}

        <Button
          type="submit"
          class="w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
          {loading}
          disabled={loading}
        >
          {#snippet children()}
            {loading ? 'Signing in...' : 'Sign in'}
          {/snippet}
        </Button>
      </form>

      {#if onSwitchToRegister}
        <div class="text-center">
          <p class="text-sm text-gray-600 dark:text-zinc-400">
            Don't have an account?
            <button
              type="button"
              class="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
              onclick={onSwitchToRegister}
            >
              Sign up
            </button>
          </p>
        </div>
      {/if}
    </div>
  </Card>
</div> 