<script lang="ts">
  import { LoginForm, RegisterForm } from '$lib/components/auth';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { AuthorizationService } from '$lib/services/authorization/authorization.service';
  import { browser } from '$app/environment';

  let isLogin = $state(true);
  let authService: AuthorizationService | null = null;

  // Redirect if already logged in
  onMount(() => {
    if (browser) {
      authService = AuthorizationService.getInstance();
      if (authService.token && authService.user) {
        goto('/');
      }
    }
  });

  function switchToRegister() {
    isLogin = false;
  }

  function switchToLogin() {
    isLogin = true;
  }
</script>

<svelte:head>
  <title>{isLogin ? 'Sign In' : 'Sign Up'} - Textly</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
  <div class="max-w-md w-full space-y-8">
    {#if isLogin}
      <LoginForm onSwitchToRegister={switchToRegister} />
    {:else}
      <RegisterForm onSwitchToLogin={switchToLogin} />
    {/if}
  </div>
</div> 