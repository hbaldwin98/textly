<script lang="ts">
  import { Button, Input, Card } from '../ui';
  import { AuthorizationService } from '$lib/services/authorization/authorization.service';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import { onMount } from 'svelte';

  interface Props {
    onSwitchToLogin?: () => void;
  }

  let { onSwitchToLogin }: Props = $props();

  let email = $state('');
  let password = $state('');
  let confirmPassword = $state('');
  let loading = $state(false);
  let error = $state('');

  let authService: AuthorizationService | null = null;
  
  onMount(() => {
    if (browser) {
      authService = AuthorizationService.getInstance();
    }
  });

  function validateForm(): string | null {
    if (!email || !password || !confirmPassword) {
      return 'Please fill in all fields';
    }

    if (password.length < 8) {
      return 'Password must be at least 8 characters long';
    }

    if (password !== confirmPassword) {
      return 'Passwords do not match';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return 'Please enter a valid email address';
    }

    return null;
  }

  async function handleSubmit(event: Event) {
    event.preventDefault();
    
    if (!authService) {
      error = 'Authentication service not available';
      return;
    }
    
    const validationError = validateForm();
    if (validationError) {
      error = validationError;
      return;
    }

    loading = true;
    error = '';

    try {
      await authService.register(email, password);
      // After successful registration, log the user in
      await authService.login(email, password);
      goto('/'); // Redirect to home page after successful registration
    } catch (err: any) {
      error = err.message || 'Registration failed. Please try again.';
    } finally {
      loading = false;
    }
  }
</script>

<Card class="w-full max-w-md p-6">
  <div class="space-y-6">
    <div class="text-center">
      <h1 class="text-2xl font-bold">Create an account</h1>
      <p class="text-gray-600 dark:text-gray-400">Sign up to get started</p>
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
        placeholder="Create a password"
        bind:value={password}
        required
        disabled={loading}
      />

      <Input
        id="confirmPassword"
        type="password"
        label="Confirm Password"
        placeholder="Confirm your password"
        bind:value={confirmPassword}
        required
        disabled={loading}
      />

      {#if error}
        <div class="rounded-lg bg-red-50 p-3 dark:bg-red-900/20">
          <p class="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      {/if}

      <div class="text-xs text-gray-500 dark:text-gray-400">
        Password must be at least 8 characters long
      </div>

      <Button
        type="submit"
        class="w-full"
        {loading}
        disabled={loading}
      >
        {#snippet children()}
          {loading ? 'Creating account...' : 'Create account'}
        {/snippet}
      </Button>
    </form>

    {#if onSwitchToLogin}
      <div class="text-center">
        <p class="text-sm text-gray-600 dark:text-gray-400">
          Already have an account?
          <button
            type="button"
            class="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
            onclick={onSwitchToLogin}
          >
            Sign in
          </button>
        </p>
      </div>
    {/if}
  </div>
</Card> 