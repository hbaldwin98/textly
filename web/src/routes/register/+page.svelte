<script lang="ts">
  import { RegisterForm } from '$lib/components/auth';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { AuthorizationService } from '$lib/services/authorization/authorization.service';
  import { browser } from '$app/environment';

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

  function switchToLogin() {
    goto('/login');
  }
</script>

<svelte:head>
  <title>Sign Up - Textly</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
  <div class="max-w-md w-full space-y-8">
    <RegisterForm onSwitchToLogin={switchToLogin} />
  </div>
</div> 