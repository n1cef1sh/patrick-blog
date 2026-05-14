<script lang="ts">
import Bold from '@lucide/svelte/icons/bold';
import Braces from '@lucide/svelte/icons/braces';
import ArrowUpToLine from '@lucide/svelte/icons/arrow-up-to-line';
import CircleCheck from '@lucide/svelte/icons/circle-check';
import CodeXml from '@lucide/svelte/icons/code-xml';
import Columns2 from '@lucide/svelte/icons/columns-2';
import Download from '@lucide/svelte/icons/download';
import Ellipsis from '@lucide/svelte/icons/ellipsis';
import Heading from '@lucide/svelte/icons/heading';
import Image from '@lucide/svelte/icons/image';
import ImagePlus from '@lucide/svelte/icons/image-plus';
import Italic from '@lucide/svelte/icons/italic';
import Link from '@lucide/svelte/icons/link';
import List from '@lucide/svelte/icons/list';
import ListCheck from '@lucide/svelte/icons/list-check';
import ListOrdered from '@lucide/svelte/icons/list-ordered';
import Lock from '@lucide/svelte/icons/lock';
import LockOpen from '@lucide/svelte/icons/lock-open';
import Quote from '@lucide/svelte/icons/quote';
import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
import Rows2 from '@lucide/svelte/icons/rows-2';
import Table2 from '@lucide/svelte/icons/table-2';
import Trash2 from '@lucide/svelte/icons/trash-2';
import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
import Upload from '@lucide/svelte/icons/upload';
import X from '@lucide/svelte/icons/x';

const icons = {
  'arrow-up-to-line': ArrowUpToLine,
  bold: Bold,
  check: CircleCheck,
  close: X,
  code: CodeXml,
  'code-block': Braces,
  'columns-2': Columns2,
  download: Download,
  ellipsis: Ellipsis,
  heading: Heading,
  image: Image,
  'image-plus': ImagePlus,
  italic: Italic,
  link: Link,
  list: List,
  lock: Lock,
  'lock-open': LockOpen,
  'ordered-list': ListOrdered,
  quote: Quote,
  'rotate-ccw': RotateCcw,
  'rows-2': Rows2,
  table: Table2,
  'task-list': ListCheck,
  trash: Trash2,
  'triangle-alert': TriangleAlert,
  upload: Upload
} as const;

type AdminEditorIconName = keyof typeof icons;

type Props = {
  name: AdminEditorIconName;
  size?: number;
  strokeWidth?: number;
  class?: string;
  ariaHidden?: boolean;
};

let {
  name,
  size = 16,
  strokeWidth = 2,
  class: className = '',
  ariaHidden = true
}: Props = $props();

const IconComponent = $derived(icons[name]);
</script>

<IconComponent
  {size}
  {strokeWidth}
  class={className}
  aria-hidden={ariaHidden ? 'true' : undefined}
/>
