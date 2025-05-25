<script lang="ts">
  import { Button, Input, Card } from '../ui';
  import { AuthorizationService } from '$lib/services/authorization/authorization.service';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
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
    if (browser) {
      authService = AuthorizationService.getInstance();
    }
  });

  async function handleSubmit(event: Event) {
    event.preventDefault();
    
    if (!authService) {
      error = 'Authentication service not available';
      return;
    }
    
    if (!email || !password) {
      error = 'Please fill in all fields';
      return;
    }

    loading = true;
    error = '';

    try {
      await authService.login(email, password);
      goto('/'); // Redirect to home page after successful login
    } catch (err: any) {
      error = err.message || 'Login failed. Please check your credentials.';
    } finally {
      loading = false;
    }
  }
</script>

<Card class="w-full max-w-md p-6">
  <div class="space-y-6">
    <div class="text-center">
      <h1 class="text-2xl font-bold">Welcome back</h1>
      <p class="text-gray-600 dark:text-gray-400">Sign in to your account</p>
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
      />

      <Input
        id="password"
        type="password"
        label="Password"
        placeholder="Enter your password"
        bind:value={password}
        required
        disabled={loading}
      />

      {#if error}
        <div class="rounded-lg bg-red-50 p-3 dark:bg-red-900/20">
          <p class="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      {/if}

      <Button
        type="submit"
        class="w-full"
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
        <p class="text-sm text-gray-600 dark:text-gray-400">
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