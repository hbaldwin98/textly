<script lang="ts">
  import { LoginForm, RegisterForm } from "$lib/components/auth";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { AuthorizationService } from "$lib/services/authorization/authorization.service";

  let isLogin = $state(true);
  let authService: AuthorizationService | null = null;

  // Redirect if already logged in
  onMount(() => {
    authService = AuthorizationService.getInstance();
    if (authService.token && authService.user) {
      goto("/");
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
  <title>{isLogin ? "Sign In" : "Sign Up"} - Textly</title>
</svelte:head>

<div
  class="h-screen bg-gradient-to-br from-gray-100 via-gray-50 to-gray-100 dark:from-zinc-950 dark:via-zinc-950 dark:to-zinc-950 flex items-center justify-center"
>
  <div class="max-w-md w-full space-y-8">
    {#if isLogin}
      <LoginForm onSwitchToRegister={switchToRegister} />
    {:else}
      <RegisterForm onSwitchToLogin={switchToLogin} />
    {/if}
  </div>
</div>
