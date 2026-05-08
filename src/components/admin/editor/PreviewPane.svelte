<script lang="ts">
type Props = {
  html?: string;
  loading?: boolean;
  error?: string;
  onScrollElementChange?: (element: HTMLElement | null) => void;
};

let {
  html = '',
  loading = false,
  error = '',
  onScrollElementChange
}: Props = $props();

let previewScrollElement = $state<HTMLElement | null>(null);

$effect(() => {
  onScrollElementChange?.(previewScrollElement);

  return () => {
    onScrollElementChange?.(null);
  };
});
</script>

<section class="admin-editor-preview" aria-label="Markdown preview">
  {#if html}
    <article
      bind:this={previewScrollElement}
      class="admin-editor-preview__article prose"
      data-refreshing={loading ? 'true' : undefined}
    >
      {@html html}
    </article>
  {:else if loading}
    <div bind:this={previewScrollElement} class="admin-editor-preview__empty" role="status" aria-live="polite">
      正在生成预览…
    </div>
  {:else if error}
    <div bind:this={previewScrollElement} class="admin-editor-preview__error" role="alert">{error}</div>
  {:else}
    <div bind:this={previewScrollElement} class="admin-editor-preview__empty">预览将在正文载入后自动生成。</div>
  {/if}

  {#if error && html}
    <div class="admin-editor-preview__error admin-editor-preview__error--inline" role="alert">{error}</div>
  {/if}
</section>
