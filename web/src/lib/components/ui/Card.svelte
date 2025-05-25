<script lang="ts">
  interface Props {
    class?: string;
    children?: any;
  }

  let {
    class: className = '',
    children,
    ...restProps
  }: Props = $props();
</script>

<div class="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800 {className}" {...restProps}>
  {@render children?.()}
</div> 