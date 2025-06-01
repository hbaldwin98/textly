<script lang="ts">
  import { Button, Input, Card } from '../ui';
  import { AuthorizationService } from '$lib/services/authorization/authorization.service';
  import { goto } from '$app/navigation';
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
    authService = AuthorizationService.getInstance();
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
    
    const validationError = validateForm();
    if (validationError) {
      error = validationError;
      return;
    }

    loading = true;
    error = '';

    try {
      await authService?.register(email, password);
      // After successful registration, log the user in
      await authService?.login(email, password);
      goto('/'); // Redirect to home page after successful registration
    } catch (err: any) {
      error = err.message || 'Registration failed. Please try again.';
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
        <h1 class="text-2xl font-bold text-gray-900 dark:text-zinc-100">Create an account</h1>
        <p class="text-gray-600 dark:text-zinc-400">Sign up to get started</p>
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
        <Input
          id="confirmPassword"
          type="password"
          label="Confirm Password"
          placeholder="Confirm your password"
          bind:value={confirmPassword}
          required
          disabled={loading}
          class="dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-100 dark:placeholder-zinc-500"
        />
        {#if error}
          <div class="text-red-500 text-sm dark:text-red-400">{error}</div>
        {/if}
        <Button 
          type="submit" 
          class="w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600" 
          disabled={loading}
        >
          {loading ? 'Creating account...' : 'Create account'}
        </Button>
      </form>

      <div class="text-center text-sm">
        <p class="text-gray-600 dark:text-zinc-400">
          Already have an account?{' '}
          <button
            type="button"
            class="text-blue-600 dark:text-blue-400 hover:underline"
            onclick={onSwitchToLogin}
          >
            Sign in
          </button>
        </p>
      </div>
    </div>
  </Card>
</div> 