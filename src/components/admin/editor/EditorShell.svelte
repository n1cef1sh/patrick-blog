<script lang="ts">
import type { AdminEssayEditorValues } from '../../../lib/admin-console/content-shared';
import { shouldGuardAdminNavigation } from '../../../scripts/admin-console/navigation-guard';
import { initAdminDetailsMenus } from '../../../scripts/admin-content/details-menu';
import {
  getPayloadErrors,
  getPayloadEssayBody,
  getPayloadEssayValues,
  getPayloadIssues,
  getPayloadPreviewResult,
  getPayloadResult,
  getPayloadRevision,
  isRecord,
  parseResponseBody,
  type AdminContentIssue,
  type AdminContentWriteResult
} from '../../../scripts/admin-content/entry-transport';
import { flattenEntryIdToSlug } from '../../../utils/slug-rules';
import AdminEditorIcon from './AdminEditorIcon.svelte';
import ArticleInfoDialog from './ArticleInfoDialog.svelte';
import BodyEditor from './BodyEditor.svelte';
import ImageInsertDialog from './ImageInsertDialog.svelte';
import { type MarkdownHeadingLevel, type MarkdownToolbarCommand, type MarkdownToolId } from './markdown-tools';
import PreviewPane from './PreviewPane.svelte';

type StatusState = 'idle' | 'loading' | 'ready' | 'ok' | 'warn' | 'error';
type EditorScrollSource = 'body' | 'preview';
type StoredWriteFeedback = {
  statusState: StatusState;
  statusText: string;
  result: AdminContentWriteResult;
  createdAt: number;
};

const getPreviewDebounceMs = (source: string): number => {
  const length = source.length;
  if (length >= 12000) return 700;
  if (length >= 6000) return 480;
  if (length >= 3000) return 320;
  return 220;
};

const LEAVE_CONFIRM_MESSAGE = '当前有未保存更改，确定要离开此页吗？';
const ARTICLE_INFO_TRIGGER_SELECTOR = '[data-admin-article-info-trigger]';
const FRONTMATTER_PANEL_ID = 'admin-editor-frontmatter-panel';
const FRONTMATTER_ISSUE_PATHS = new Set(['title', 'date', 'description', 'tags', 'slug', 'badge', 'cover']);
const STATUS_WAITING_SAVE = '等待保存';
const STATUS_CLEAN = '无未保存更改';
const STATUS_STATES: readonly StatusState[] = ['idle', 'loading', 'ready', 'ok', 'warn', 'error'];
const WRITE_FEEDBACK_STORAGE_PREFIX = 'astro-whono:admin-editor:write-feedback:';
const WRITE_FEEDBACK_STORAGE_TTL_MS = 60 * 1000;
const WRITE_FIELD_LABELS: Readonly<Record<string, string>> = {
  title: '标题',
  description: '摘要',
  date: '日期',
  publishedAt: '发布时间',
  tags: '标签',
  draft: '草稿状态',
  archive: '归档状态',
  slug: '链接别名',
  cover: '封面图',
  badge: '徽标',
  body: '正文'
};

const headingTool = { label: '标题', icon: 'heading' } as const;
const headingLevelItems: readonly { level: MarkdownHeadingLevel; label: string; description: string }[] = [
  { level: 2, label: 'H2', description: '小节标题' },
  { level: 3, label: 'H3', description: '三级标题' },
  { level: 4, label: 'H4', description: '四级标题' },
  { level: 5, label: 'H5', description: '五级标题' }
];

const markdownTools = [
  { id: 'bold', label: '加粗', icon: 'bold' },
  { id: 'italic', label: '斜体', icon: 'italic' },
  { id: 'quote', label: '引用', icon: 'quote' },
  { id: 'link', label: '链接', icon: 'link' },
  { id: 'image', label: '图片', icon: 'image' },
  { id: 'code', label: '行内代码', icon: 'code' },
  { id: 'codeBlock', label: '代码块', icon: 'code-block' },
  { id: 'list', label: '无序列表', icon: 'list' },
  { id: 'orderedList', label: '有序列表', icon: 'ordered-list' },
  { id: 'taskList', label: '任务列表', icon: 'task-list' },
  { id: 'table', label: '表格', icon: 'table' }
] as const;

type Props = {
  endpoint: string;
  previewEndpoint: string;
  imageUploadEndpoint: string;
  collection: 'essay';
  entryId: string;
  defaultPublicSlug: string;
  revision: string;
  initialFrontmatter: AdminEssayEditorValues;
  initialBody: string;
  initialArticleInfoOpen?: boolean;
};

let {
  endpoint,
  previewEndpoint,
  imageUploadEndpoint,
  collection,
  entryId,
  defaultPublicSlug,
  revision,
  initialFrontmatter,
  initialBody,
  initialArticleInfoOpen = false
}: Props = $props();

const cloneFrontmatter = (value: AdminEssayEditorValues): AdminEssayEditorValues => ({
  title: value.title,
  description: value.description,
  date: value.date,
  publishedAt: value.publishedAt,
  tagsText: value.tagsText,
  draft: value.draft,
  archive: value.archive,
  slug: value.slug,
  cover: value.cover,
  badge: value.badge
});

const isEqualFrontmatter = (left: AdminEssayEditorValues, right: AdminEssayEditorValues): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

const slugPlaceholder = $derived(defaultPublicSlug || flattenEntryIdToSlug(entryId));

const createInitialSnapshot = () => ({
  revision,
  frontmatter: cloneFrontmatter(initialFrontmatter),
  body: initialBody,
  articleInfoOpen: initialArticleInfoOpen
});

const initialSnapshot = createInitialSnapshot();
const writeFeedbackStorageKey = $derived(`${WRITE_FEEDBACK_STORAGE_PREFIX}${collection}:${entryId}`);

const isWriteResult = (value: unknown): value is AdminContentWriteResult => {
  if (!isRecord(value)) return false;
  return (
    typeof value.changed === 'boolean' &&
    typeof value.written === 'boolean' &&
    typeof value.relativePath === 'string' &&
    Array.isArray(value.changedFields) &&
    value.changedFields.every((field) => typeof field === 'string')
  );
};

const isStoredWriteFeedback = (value: unknown): value is StoredWriteFeedback => {
  if (!isRecord(value)) return false;
  return (
    STATUS_STATES.includes(value.statusState as StatusState) &&
    typeof value.statusText === 'string' &&
    typeof value.createdAt === 'number' &&
    isWriteResult(value.result)
  );
};

const getWriteFieldLabel = (field: string): string => WRITE_FIELD_LABELS[field] ?? field;

const clearStoredWriteFeedback = () => {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(writeFeedbackStorageKey);
  } catch {
    // 部分浏览器环境可能禁用 sessionStorage。
  }
};

const readStoredWriteFeedback = (): StoredWriteFeedback | null => {
  if (typeof window === 'undefined') return null;
  try {
    const rawFeedback = window.sessionStorage.getItem(writeFeedbackStorageKey);
    if (!rawFeedback) return null;

    const feedback: unknown = JSON.parse(rawFeedback);
    if (!isStoredWriteFeedback(feedback) || Date.now() - feedback.createdAt > WRITE_FEEDBACK_STORAGE_TTL_MS) {
      clearStoredWriteFeedback();
      return null;
    }

    return feedback;
  } catch {
    clearStoredWriteFeedback();
    return null;
  }
};

const storeWriteFeedback = (result: AdminContentWriteResult, statusState: StatusState, statusText: string) => {
  if (typeof window === 'undefined') return;
  try {
    const feedback: StoredWriteFeedback = {
      statusState,
      statusText,
      result,
      createdAt: Date.now()
    };
    window.sessionStorage.setItem(writeFeedbackStorageKey, JSON.stringify(feedback));
  } catch {
    // 反馈保留只改善刷新后的可见性，不应影响保存主流程。
  }
};

let currentRevision = $state(initialSnapshot.revision);
let baselineFrontmatter = $state(cloneFrontmatter(initialSnapshot.frontmatter));
let baselineBody = $state(initialSnapshot.body);
let frontmatter = $state(cloneFrontmatter(initialSnapshot.frontmatter));
let body = $state(initialSnapshot.body);
let busy = $state(false);
let previewBusy = $state(false);
let statusState = $state<StatusState>('idle');
let statusText = $state('');
let errors = $state<string[]>([]);
let issues = $state<AdminContentIssue[]>([]);
let writeResult = $state<AdminContentWriteResult | null>(null);
let previewHtml = $state('');
let previewWarnings = $state<string[]>([]);
let previewError = $state('');
let previewRequestId = 0;
let previewTimer: number | null = null;
let activePreviewAbortController: AbortController | null = null;
let latestPreviewSource = '';
let previewInitialized = false;
let toolbarCommandId = 0;
let toolbarCommand = $state<MarkdownToolbarCommand | null>(null);
let headingMenuOpen = $state(false);
let headingMenuEl = $state<HTMLDetailsElement | null>(null);
let frontmatterPanelOpen = $state(initialSnapshot.articleInfoOpen);
let articleInfoDialog = $state<ArticleInfoDialog | null>(null);
let imageInsertOpen = $state(false);
let bodyScrollElement = $state<HTMLTextAreaElement | null>(null);
let previewScrollElement = $state<HTMLElement | null>(null);
let syncScrollEnabled = $state(true);
let writeFeedbackRestored = false;
let lastScrollSource: EditorScrollSource = 'body';
let pendingScrollSyncSource: EditorScrollSource | null = null;
let scrollSyncFrame: number | null = null;
let scrollSyncReleaseFrame: number | null = null;
let applyingScrollSync = false;

const bodyLineCount = $derived(body.length === 0 ? 1 : body.split(/\r\n|\r|\n/).length);
const bodyCharCount = $derived(body.length);
const frontmatterDirty = $derived(!isEqualFrontmatter(frontmatter, baselineFrontmatter));
const bodyDirty = $derived(body !== baselineBody);
const isDirty = $derived(frontmatterDirty || bodyDirty);
const canWriteContent = $derived(!busy && isDirty);
const frontmatterIssueCount = $derived(issues.filter((issue) => FRONTMATTER_ISSUE_PATHS.has(issue.path)).length);
const visibleWriteResult = $derived(!isDirty ? writeResult : null);
const scrollSyncToggleLabel = $derived(syncScrollEnabled ? '关闭同步滚动' : '开启同步滚动');
const scrollSyncControlDisabled = $derived(!bodyScrollElement || !previewScrollElement);
const scrollTopControlDisabled = $derived(!bodyScrollElement && !previewScrollElement);

const setStatus = (state: StatusState, text: string) => {
  statusState = state;
  statusText = text;
};

const clearWriteFeedback = () => {
  errors = [];
  issues = [];
  writeResult = null;
};

const syncDirtyStatus = () => {
  if (busy || previewBusy || statusState === 'warn' || statusState === 'error') return;

  if (isDirty) {
    if (statusText !== STATUS_WAITING_SAVE) {
      setStatus('ready', STATUS_WAITING_SAVE);
    }
    return;
  }

  if (statusState === 'ready' && statusText === STATUS_WAITING_SAVE) {
    setStatus('ready', STATUS_CLEAN);
  }
};

const applyToolbarTool = (toolId: MarkdownToolId) => {
  if (busy) return;
  if (toolId === 'image') {
    imageInsertOpen = true;
    return;
  }

  toolbarCommandId += 1;
  toolbarCommand = { id: toolbarCommandId, kind: 'tool', toolId };
};

const closeHeadingMenu = () => {
  if (headingMenuEl) headingMenuEl.open = false;
  headingMenuOpen = false;
};

const syncHeadingMenuOpen = () => {
  headingMenuOpen = headingMenuEl?.open ?? false;
};

const handleHeadingSummaryClick = (event: MouseEvent) => {
  if (!busy) return;

  event.preventDefault();
  event.stopPropagation();
};

const applyHeadingLevel = (level: MarkdownHeadingLevel) => {
  if (busy) return;

  closeHeadingMenu();
  toolbarCommandId += 1;
  toolbarCommand = { id: toolbarCommandId, kind: 'heading', level };
};

const insertMarkdownText = (text: string) => {
  toolbarCommandId += 1;
  toolbarCommand = { id: toolbarCommandId, kind: 'insert', text };
};

const closeImageInsert = () => {
  imageInsertOpen = false;
};

const setBodyScrollElement = (element: HTMLTextAreaElement | null) => {
  bodyScrollElement = element;
};

const setPreviewScrollElement = (element: HTMLElement | null) => {
  previewScrollElement = element;
};

const getScrollElement = (source: EditorScrollSource): HTMLElement | null =>
  source === 'body' ? bodyScrollElement : previewScrollElement;

const getOppositeScrollSource = (source: EditorScrollSource): EditorScrollSource =>
  source === 'body' ? 'preview' : 'body';

const getScrollableDistance = (element: HTMLElement): number =>
  Math.max(0, element.scrollHeight - element.clientHeight);

const getScrollRatio = (element: HTMLElement): number => {
  const scrollableDistance = getScrollableDistance(element);
  if (scrollableDistance === 0) return 0;

  return Math.min(1, Math.max(0, element.scrollTop / scrollableDistance));
};

const cancelQueuedScrollSync = () => {
  if (scrollSyncFrame === null) return;
  window.cancelAnimationFrame(scrollSyncFrame);
  scrollSyncFrame = null;
  pendingScrollSyncSource = null;
};

const releaseScrollSyncGuard = () => {
  if (scrollSyncReleaseFrame !== null) {
    window.cancelAnimationFrame(scrollSyncReleaseFrame);
  }

  scrollSyncReleaseFrame = window.requestAnimationFrame(() => {
    applyingScrollSync = false;
    scrollSyncReleaseFrame = null;
  });
};

const applyScrollSync = (source: EditorScrollSource) => {
  const sourceElement = getScrollElement(source);
  const targetElement = getScrollElement(getOppositeScrollSource(source));
  if (!sourceElement || !targetElement) return;

  const scrollRatio = getScrollRatio(sourceElement);
  applyingScrollSync = true;
  targetElement.scrollTop = getScrollableDistance(targetElement) * scrollRatio;
  releaseScrollSyncGuard();
};

const queueScrollSync = (source: EditorScrollSource) => {
  pendingScrollSyncSource = source;
  if (scrollSyncFrame !== null) return;

  scrollSyncFrame = window.requestAnimationFrame(() => {
    const queuedSource = pendingScrollSyncSource;
    scrollSyncFrame = null;
    pendingScrollSyncSource = null;

    if (!queuedSource || !syncScrollEnabled) return;
    applyScrollSync(queuedSource);
  });
};

const handleEditorPaneScroll = (source: EditorScrollSource) => {
  if (applyingScrollSync) return;

  lastScrollSource = source;
  if (!syncScrollEnabled) return;

  queueScrollSync(source);
};

const toggleScrollSync = () => {
  const nextEnabled = !syncScrollEnabled;
  syncScrollEnabled = nextEnabled;

  if (nextEnabled) {
    queueScrollSync(lastScrollSource);
  }
};

const scrollEditorPanesToTop = () => {
  const scrollElements = [bodyScrollElement, previewScrollElement].filter(
    (element): element is HTMLElement => element !== null
  );
  if (scrollElements.length === 0) return;

  lastScrollSource = 'body';
  cancelQueuedScrollSync();
  applyingScrollSync = true;
  scrollElements.forEach((element) => {
    element.scrollTop = 0;
  });
  releaseScrollSyncGuard();
};

const closeFrontmatterPanel = () => {
  frontmatterPanelOpen = false;
};

const openFrontmatterPanel = (trigger?: HTMLElement | null) => {
  if (!frontmatterPanelOpen) {
    articleInfoDialog?.captureReturnFocus(trigger);
  }
  frontmatterPanelOpen = true;
};

const toggleFrontmatterPanel = (trigger?: HTMLElement | null) => {
  if (frontmatterPanelOpen) {
    closeFrontmatterPanel();
    return;
  }

  openFrontmatterPanel(trigger);
};

const clearPreviewTimer = () => {
  if (previewTimer === null) return;
  window.clearTimeout(previewTimer);
  previewTimer = null;
};

const abortActivePreviewRequest = (invalidate = false) => {
  if (invalidate) previewRequestId += 1;
  activePreviewAbortController?.abort();
  activePreviewAbortController = null;
  if (invalidate) previewBusy = false;
};

const requestContentWrite = async () => {
  busy = true;
  clearWriteFeedback();
  clearStoredWriteFeedback();
  setStatus('loading', '内容保存中');

  try {
    const requestPayload = {
      collection,
      entryId,
      revision: currentRevision,
      frontmatter,
      ...(bodyDirty ? { body } : {})
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json; charset=utf-8'
      },
      cache: 'no-store',
      body: JSON.stringify(requestPayload)
    });

    const payload = await parseResponseBody(response);
    const nextRevision = getPayloadRevision(payload);
    if (nextRevision && response.ok) currentRevision = nextRevision;

    if (!response.ok || !isRecord(payload) || payload.ok !== true) {
      const nextIssues = getPayloadIssues(payload);
      issues = nextIssues;
      errors = getPayloadErrors(payload);
      if (errors.length === 0) {
        errors = ['保存失败，检查控制台日志'];
      }
      if (response.status === 409) {
        window.alert(errors[0] ?? '检测到内容文件已在外部更新，已拒绝覆盖，请刷新当前条目后再保存');
      }
      setStatus(response.status === 409 ? 'warn' : 'error', '保存失败');
      return;
    }

    const result = getPayloadResult(payload);
    if (!result) {
      errors = ['响应体缺少 result 字段，请检查开发日志'];
      setStatus('error', '保存失败');
      return;
    }

    writeResult = result;
    const latestValues = getPayloadEssayValues(payload);
    const latestBody = getPayloadEssayBody(payload);
    const nextBaseline = latestValues ? cloneFrontmatter(latestValues) : cloneFrontmatter(frontmatter);
    frontmatter = cloneFrontmatter(nextBaseline);
    baselineFrontmatter = cloneFrontmatter(nextBaseline);
    baselineBody = latestBody ?? body;
    body = baselineBody;

    const nextStatusState: StatusState = result.changed ? 'ok' : 'ready';
    const nextStatusText = result.changed ? '内容已保存' : STATUS_CLEAN;
    storeWriteFeedback(result, nextStatusState, nextStatusText);
    setStatus(nextStatusState, nextStatusText);
  } catch {
    errors = ['保存请求失败，请稍后重试'];
    setStatus('error', '保存失败');
  } finally {
    busy = false;
  }
};

const requestPreview = async ({ silent = false }: { silent?: boolean } = {}) => {
  const requestId = previewRequestId + 1;
  previewRequestId = requestId;
  const sourceSnapshot = body;
  latestPreviewSource = sourceSnapshot;

  activePreviewAbortController?.abort();
  const abortController = new AbortController();
  activePreviewAbortController = abortController;

  previewBusy = true;
  previewError = '';
  previewWarnings = [];
  if (!silent) {
    setStatus('loading', '正在生成预览');
  }

  try {
    const response = await fetch(previewEndpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json; charset=utf-8'
      },
      cache: 'no-store',
      signal: abortController.signal,
      body: JSON.stringify({
        collection,
        entryId,
        source: sourceSnapshot
      })
    });

    const payload = await parseResponseBody(response);
    if (requestId !== previewRequestId) return;
    if (sourceSnapshot !== body) {
      return;
    }

    const previewResult = getPayloadPreviewResult(payload);
    if (!response.ok || !isRecord(payload) || payload.ok !== true || !previewResult) {
      const payloadErrors = getPayloadErrors(payload);
      previewError = payloadErrors[0] ?? '预览生成失败，请检查响应与控制台日志';
      setStatus('error', '预览生成失败');
      return;
    }

    previewHtml = previewResult.html;
    previewWarnings = previewResult.warnings;
    if (!silent) {
      setStatus('ready', isDirty ? STATUS_WAITING_SAVE : '预览已更新');
    }
  } catch {
    if (abortController.signal.aborted) return;
    if (requestId !== previewRequestId) return;
    previewError = '预览请求失败，请稍后重试';
    setStatus('error', '预览请求失败');
  } finally {
    if (requestId === previewRequestId) {
      previewBusy = false;
      if (activePreviewAbortController === abortController) {
        activePreviewAbortController = null;
      }
    }
  }
};

const resetToBaseline = () => {
  frontmatter = cloneFrontmatter(baselineFrontmatter);
  body = baselineBody;
  clearWriteFeedback();
  clearStoredWriteFeedback();
  setStatus('ready', '已还原');
};

const handleGuardedNavigationClick = (event: MouseEvent) => {
  if (!isDirty) return;
  if (!(event.target instanceof Element)) return;

  const anchor = event.target.closest('a[href]');
  if (!(anchor instanceof HTMLAnchorElement)) return;

  if (
    !shouldGuardAdminNavigation({
      isDirty,
      currentUrl: window.location.href,
      nextUrl: anchor.href,
      button: event.button,
      metaKey: event.metaKey,
      ctrlKey: event.ctrlKey,
      shiftKey: event.shiftKey,
      altKey: event.altKey,
      target: anchor.target,
      download: anchor.hasAttribute('download')
    })
  ) {
    return;
  }

  if (window.confirm(LEAVE_CONFIRM_MESSAGE)) return;

  event.preventDefault();
  event.stopPropagation();
  setStatus('warn', '请先保存或还原');
};

const handleBeforeUnload = (event: BeforeUnloadEvent) => {
  if (!isDirty) return;

  event.preventDefault();
  Reflect.set(event, 'returnValue', '');
};

const handleArticleInfoTriggerClick = (event: MouseEvent) => {
  if (!(event.target instanceof Element)) return;
  const trigger = event.target.closest(ARTICLE_INFO_TRIGGER_SELECTOR);
  if (!(trigger instanceof HTMLButtonElement)) return;

  event.preventDefault();
  toggleFrontmatterPanel(trigger);
};

$effect(() => {
  if (writeFeedbackRestored) return;
  writeFeedbackRestored = true;

  const storedFeedback = readStoredWriteFeedback();
  if (!storedFeedback) return;

  writeResult = storedFeedback.result;
  setStatus(storedFeedback.statusState, storedFeedback.statusText);
  clearStoredWriteFeedback();
});

$effect(() => {
  const cleanupDetailsMenus = [
    initAdminDetailsMenus({
      selector: '.admin-editor-shell__preview-detail'
    }),
    initAdminDetailsMenus({
      selector: '.admin-editor-markdown-toolbar__heading'
    })
  ];

  document.addEventListener('click', handleGuardedNavigationClick, true);
  document.addEventListener('click', handleArticleInfoTriggerClick);
  window.addEventListener('beforeunload', handleBeforeUnload);

  return () => {
    cleanupDetailsMenus.forEach((cleanup) => cleanup());
    document.removeEventListener('click', handleGuardedNavigationClick, true);
    document.removeEventListener('click', handleArticleInfoTriggerClick);
    window.removeEventListener('beforeunload', handleBeforeUnload);
  };
});

$effect(() => {
  if (busy && headingMenuOpen) {
    closeHeadingMenu();
  }
});

$effect(() => {
  const bodyElement = bodyScrollElement;
  const previewElement = previewScrollElement;
  if (!bodyElement || !previewElement) return;

  const handleBodyScroll = () => {
    handleEditorPaneScroll('body');
  };

  const handlePreviewScroll = () => {
    handleEditorPaneScroll('preview');
  };

  const handlePreviewContentLoad = () => {
    if (syncScrollEnabled) {
      queueScrollSync(lastScrollSource);
    }
  };

  bodyElement.addEventListener('scroll', handleBodyScroll, { passive: true });
  previewElement.addEventListener('scroll', handlePreviewScroll, { passive: true });
  previewElement.addEventListener('load', handlePreviewContentLoad, true);

  if (syncScrollEnabled) {
    queueScrollSync(lastScrollSource);
  }

  return () => {
    bodyElement.removeEventListener('scroll', handleBodyScroll);
    previewElement.removeEventListener('scroll', handlePreviewScroll);
    previewElement.removeEventListener('load', handlePreviewContentLoad, true);
  };
});

$effect(() => {
  return () => {
    cancelQueuedScrollSync();
    if (scrollSyncReleaseFrame !== null) {
      window.cancelAnimationFrame(scrollSyncReleaseFrame);
      scrollSyncReleaseFrame = null;
    }
  };
});

$effect(() => {
  const triggers = document.querySelectorAll<HTMLButtonElement>(ARTICLE_INFO_TRIGGER_SELECTOR);
  triggers.forEach((trigger) => {
    trigger.setAttribute('aria-controls', FRONTMATTER_PANEL_ID);
    trigger.setAttribute('aria-expanded', frontmatterPanelOpen ? 'true' : 'false');
    trigger.dataset.state = frontmatterPanelOpen ? 'open' : 'closed';
    trigger.dataset.dirty = frontmatterDirty ? 'true' : 'false';
    trigger.dataset.invalid = frontmatterIssueCount > 0 ? 'true' : 'false';
  });
});

$effect(() => {
  if (frontmatterIssueCount > 0 && !frontmatterPanelOpen) {
    openFrontmatterPanel();
  }
});

$effect(() => {
  syncDirtyStatus();
});

$effect(() => {
  const currentBody = body;

  if (!previewInitialized) {
    previewInitialized = true;
    void requestPreview({ silent: true });
    return;
  }

  if (currentBody === latestPreviewSource) {
    clearPreviewTimer();
    return;
  }

  abortActivePreviewRequest(true);
  previewTimer = window.setTimeout(() => {
    previewTimer = null;
    void requestPreview();
  }, getPreviewDebounceMs(currentBody));

  return clearPreviewTimer;
});
</script>

<section class="admin-editor-shell">
  <div class="admin-editor-shell__format-row">
    <div class="admin-editor-markdown-toolbar" role="toolbar" aria-label="Markdown 常用格式">
      <details
        class="admin-editor-markdown-toolbar__heading"
        class:is-open={headingMenuOpen}
        bind:this={headingMenuEl}
        ontoggle={syncHeadingMenuOpen}
      >
        <summary
          class="admin-btn admin-btn--tool admin-btn--compact admin-btn--icon admin-editor-markdown-toolbar__button"
          data-tooltip={headingTool.label}
          aria-label={headingTool.label}
          aria-disabled={busy ? 'true' : undefined}
          onclick={handleHeadingSummaryClick}
        >
          <AdminEditorIcon name={headingTool.icon} size={16} strokeWidth={2} />
        </summary>

        <div
          class="admin-content-menu-panel admin-editor-heading-menu"
          id="admin-editor-heading-menu"
          aria-label="标题级别"
        >
          {#each headingLevelItems as item}
            <button
              class="admin-content-menu-item admin-editor-heading-menu__item"
              type="button"
              disabled={busy}
              onclick={() => applyHeadingLevel(item.level)}
            >
              <span class="admin-editor-heading-menu__level">{item.label}</span>
              <span class="admin-editor-heading-menu__text">{item.description}</span>
            </button>
          {/each}
        </div>
      </details>

      {#each markdownTools as tool}
        <button
          class="admin-btn admin-btn--tool admin-btn--compact admin-btn--icon admin-editor-markdown-toolbar__button"
          type="button"
          data-tooltip={tool.label}
          aria-label={tool.label}
          disabled={busy}
          onclick={() => applyToolbarTool(tool.id)}
        >
          <AdminEditorIcon name={tool.icon} size={16} strokeWidth={2} />
        </button>
      {/each}
    </div>
  </div>

  <div class="admin-editor-shell__layout">
    <div class="admin-editor-shell__workspace">
      <div class="admin-editor-shell__pane admin-editor-shell__pane--body">
        <BodyEditor
          bind:value={body}
          disabled={busy}
          {toolbarCommand}
          onScrollElementChange={setBodyScrollElement}
        />
      </div>
      <div class="admin-editor-shell__preview-bar" aria-label="正文统计与预览状态">
        <div class="admin-editor-shell__preview-bar-counts">
          <div class="admin-editor-shell__preview-stats" aria-label="正文统计">
            <span class="admin-editor-shell__preview-stat">行数: {bodyLineCount}</span>
            <span class="admin-editor-shell__preview-separator" aria-hidden="true">|</span>
            <span class="admin-editor-shell__preview-stat">字数: {bodyCharCount}</span>
          </div>

          {#if errors.length > 0}
            <details class="admin-editor-shell__preview-detail admin-editor-shell__preview-detail--error">
              <summary class="admin-editor-shell__preview-detail-trigger">
                <AdminEditorIcon name="triangle-alert" size={13} strokeWidth={2} class="admin-icon" />
                <span>保存失败 {errors.length}</span>
              </summary>
              <div class="admin-editor-shell__preview-detail-panel" role="group" aria-label="保存错误详情">
                <p class="admin-editor-shell__preview-detail-label">保存失败</p>
                <ul class="admin-editor-shell__preview-detail-list">
                  {#each errors as error}
                    <li>{error}</li>
                  {/each}
                </ul>
              </div>
            </details>
          {/if}

          {#if issues.length > 0}
            <details class="admin-editor-shell__preview-detail admin-editor-shell__preview-detail--warning">
              <summary class="admin-editor-shell__preview-detail-trigger">
                <AdminEditorIcon name="triangle-alert" size={13} strokeWidth={2} class="admin-icon" />
                <span>字段 {issues.length}</span>
              </summary>
              <div class="admin-editor-shell__preview-detail-panel" role="group" aria-label="字段问题详情">
                <p class="admin-editor-shell__preview-detail-label">字段问题</p>
                <ul class="admin-editor-shell__preview-detail-list">
                  {#each issues as issue}
                    <li>
                      <span class="admin-editor-shell__preview-detail-path">{issue.path}</span>
                      {issue.message}
                    </li>
                  {/each}
                </ul>
              </div>
            </details>
          {/if}

          {#if previewError}
            <details class="admin-editor-shell__preview-detail admin-editor-shell__preview-detail--error">
              <summary class="admin-editor-shell__preview-detail-trigger">
                <AdminEditorIcon name="triangle-alert" size={13} strokeWidth={2} class="admin-icon" />
                <span>预览失败</span>
              </summary>
              <div class="admin-editor-shell__preview-detail-panel" role="group" aria-label="预览错误详情">
                <p class="admin-editor-shell__preview-detail-label">预览失败</p>
                <p class="admin-editor-shell__preview-detail-copy">{previewError}</p>
              </div>
            </details>
          {/if}

          {#if previewWarnings.length > 0}
            <details class="admin-editor-shell__preview-detail admin-editor-shell__preview-detail--warning">
              <summary class="admin-editor-shell__preview-detail-trigger">
                <AdminEditorIcon name="triangle-alert" size={13} strokeWidth={2} class="admin-icon" />
                <span>预览 {previewWarnings.length}</span>
              </summary>
              <div class="admin-editor-shell__preview-detail-panel" role="group" aria-label="预览警告详情">
                <p class="admin-editor-shell__preview-detail-label">预览警告</p>
                <ul class="admin-editor-shell__preview-detail-list">
                  {#each previewWarnings as warning}
                    <li>{warning}</li>
                  {/each}
                </ul>
              </div>
            </details>
          {/if}

          {#if visibleWriteResult}
            {@const result = visibleWriteResult}
            <details class="admin-editor-shell__preview-detail admin-editor-shell__preview-detail--ok">
              <summary class="admin-editor-shell__preview-detail-trigger">
                <AdminEditorIcon name="check" size={13} strokeWidth={2} class="admin-icon" />
                <span>{result.changed ? `写入 ${result.changedFields.length}` : '无改动'}</span>
              </summary>
              <div class="admin-editor-shell__preview-detail-panel" role="group" aria-label="写入结果详情">
                <p class="admin-editor-shell__preview-detail-label">写入结果</p>
                <p class="admin-editor-shell__preview-detail-copy">
                  {result.changed
                    ? `${result.relativePath || '当前条目'} 已更新，本次更新 ${result.changedFields.length} 个字段。`
                    : '当前内容无改动。'}
                </p>
                {#if result.changedFields.length > 0}
                  <ul class="admin-editor-shell__preview-detail-list">
                    {#each result.changedFields as field}
                      <li>{getWriteFieldLabel(field)}</li>
                    {/each}
                  </ul>
                {/if}
              </div>
            </details>
          {/if}
        </div>
        <div class="admin-editor-shell__preview-bar-actions" aria-label="预览滚动控制">
          <button
            class="admin-btn admin-btn--ghost admin-btn--compact admin-editor-shell__preview-action"
            type="button"
            data-active={syncScrollEnabled ? 'true' : 'false'}
            aria-label={scrollSyncToggleLabel}
            aria-pressed={syncScrollEnabled ? 'true' : 'false'}
            disabled={scrollSyncControlDisabled}
            onclick={toggleScrollSync}
          >
            <AdminEditorIcon name={syncScrollEnabled ? 'lock' : 'lock-open'} size={14} strokeWidth={2} />
            <span>同步滚动</span>
          </button>
          <span class="admin-editor-shell__preview-separator" aria-hidden="true">|</span>
          <button
            class="admin-btn admin-btn--ghost admin-btn--compact admin-editor-shell__preview-action"
            type="button"
            aria-label="回到顶部"
            disabled={scrollTopControlDisabled}
            onclick={scrollEditorPanesToTop}
          >
            <AdminEditorIcon name="arrow-up-to-line" size={14} strokeWidth={2} />
            <span>回到顶部</span>
          </button>
        </div>
      </div>
      <div class="admin-editor-shell__pane admin-editor-shell__pane--preview">
        <PreviewPane
          html={previewHtml}
          loading={previewBusy}
          error={previewError}
          onScrollElementChange={setPreviewScrollElement}
        />
      </div>
    </div>
  </div>

  <ArticleInfoDialog
    bind:this={articleInfoDialog}
    bind:value={frontmatter}
    open={frontmatterPanelOpen}
    {issues}
    disabled={busy}
    dirty={isDirty}
    canSave={canWriteContent}
    {slugPlaceholder}
    onClose={closeFrontmatterPanel}
    onReset={resetToBaseline}
    onSave={() => void requestContentWrite()}
  />

  <ImageInsertDialog
    open={imageInsertOpen}
    uploadEndpoint={imageUploadEndpoint}
    {entryId}
    disabled={busy}
    onClose={closeImageInsert}
    onInsert={(markdown) => {
      insertMarkdownText(markdown);
      setStatus('ok', '已插入图片');
    }}
  />

  <div class="admin-content-toolbar__footer admin-editor-shell__actions">
    <div class="admin-editor-shell__footer-copy">
      {#if statusText}
        <div class="admin-editor-shell__status">
          <p class="admin-status admin-status--inline" data-state={statusState} role="status" aria-live="polite" aria-atomic="true">{statusText}</p>
        </div>
      {/if}
    </div>
    <div class="admin-content-actions">
      <button class="admin-btn admin-btn--ghost admin-btn--compact" type="button" onclick={resetToBaseline} disabled={busy || !isDirty}>
        还原
      </button>
      <button class="admin-btn admin-btn--primary admin-btn--compact" type="button" onclick={() => void requestContentWrite()} disabled={!canWriteContent}>
        保存内容
      </button>
    </div>
  </div>
</section>
