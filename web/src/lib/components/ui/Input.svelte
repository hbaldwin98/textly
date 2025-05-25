<script lang="ts">
  interface Props {
    type?: 'text' | 'email' | 'password' | 'number';
    placeholder?: string;
    value?: string;
    disabled?: boolean;
    required?: boolean;
    error?: string;
    label?: string;
    id?: string;
    class?: string;
    oninput?: (event: Event) => void;
  }

  let {
    type = 'text',
    placeholder = '',
    value = $bindable(''),
    disabled = false,
    required = false,
    error = '',
    label = '',
    id = '',
    class: className = '',
    oninput,
    ...restProps
  }: Props = $props();

  const baseClasses = 'flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:ring-offset-gray-900 dark:placeholder:text-gray-400 dark:focus-visible:ring-blue-400';
  const errorClasses = 'border-red-500 focus-visible:ring-red-500 dark:border-red-400 dark:focus-visible:ring-red-400';
</script>

<div class="space-y-2">
  {#if label}
    <label for={id} class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
      {label}
      {#if required}
        <span class="text-red-500">*</span>
      {/if}
    </label>
  {/if}
  
  <input
    {id}
    {type}
    {placeholder}
    {disabled}
    {required}
    bind:value
    class="{baseClasses} {error ? errorClasses : ''} {className}"
    oninput={oninput}
    {...restProps}
  />
  
  {#if error}
    <p class="text-sm text-red-600 dark:text-red-400">{error}</p>
  {/if}
</div> 