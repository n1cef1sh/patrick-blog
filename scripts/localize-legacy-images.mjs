import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync
} from 'node:fs';
import { basename, dirname, extname, join } from 'node:path';

const projectRoot = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const legacyEssayDir = join(projectRoot, 'src/content/essay/legacy');
const publicImageRoot = join(projectRoot, 'public/images/legacy');
const reportDir = join(projectRoot, 'reports');
const reportPath = join(reportDir, 'legacy-image-migration.json');

const concurrency = Number.parseInt(process.env.LEGACY_IMAGE_CONCURRENCY ?? '12', 10);
const requestTimeoutMs = Number.parseInt(process.env.LEGACY_IMAGE_TIMEOUT_MS ?? '15000', 10);
const imagePattern = /!\[([^\]]*)\]\(([^)\s]+)(\s+["'][^)]*["'])?\)/g;
const frontmatterPattern = /^---\n([\s\S]*?)\n---\n?/;
const remoteImagePattern = /^https?:\/\//i;

const contentTypeExtensions = new Map([
  ['image/avif', '.avif'],
  ['image/gif', '.gif'],
  ['image/jpeg', '.jpg'],
  ['image/jpg', '.jpg'],
  ['image/png', '.png'],
  ['image/svg+xml', '.svg'],
  ['image/webp', '.webp']
]);

const normalizeSlug = (value) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'legacy-post';

const getFrontmatterValue = (frontmatter, key) => {
  const match = frontmatter.match(new RegExp(`^${key}:\\s*(.+?)\\s*$`, 'm'));
  return match?.[1]?.trim().replace(/^['"]|['"]$/g, '') ?? null;
};

const getEntrySlug = (content, filePath) => {
  const frontmatter = content.match(frontmatterPattern)?.[1] ?? '';
  const slug = getFrontmatterValue(frontmatter, 'slug');
  if (slug) return normalizeSlug(slug);
  return normalizeSlug(basename(filePath, extname(filePath)));
};

const hash = (value) => createHash('sha1').update(value).digest('hex').slice(0, 10);

const extensionFromUrl = (url) => {
  try {
    const parsed = new URL(url);
    const ext = extname(parsed.pathname).toLowerCase();
    if (/^\.(avif|gif|jpe?g|png|svg|webp)$/.test(ext)) return ext === '.jpeg' ? '.jpg' : ext;
  } catch {
    return null;
  }
  return null;
};

const extensionFromContentType = (contentType) => {
  const normalized = contentType?.split(';', 1)[0]?.trim().toLowerCase();
  return normalized ? contentTypeExtensions.get(normalized) ?? null : null;
};

const extensionFromBuffer = (buffer) => {
  if (buffer.length >= 4 && buffer.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))) {
    return '.png';
  }
  if (buffer.length >= 3 && buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) {
    return '.jpg';
  }
  if (buffer.length >= 6) {
    const signature = buffer.subarray(0, 6).toString('ascii');
    if (signature === 'GIF87a' || signature === 'GIF89a') return '.gif';
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return '.webp';
  }
  if (buffer.length >= 12 && buffer.subarray(4, 8).toString('ascii') === 'ftyp') {
    const brand = buffer.subarray(8, 12).toString('ascii');
    if (brand === 'avif' || brand === 'avis') return '.avif';
  }
  const prefix = buffer.subarray(0, 256).toString('utf8').trimStart();
  if (prefix.startsWith('<svg') || prefix.startsWith('<?xml')) return '.svg';
  return null;
};

const buildTarget = ({ slug, url, index, extension }) => {
  const filename = `${String(index + 1).padStart(3, '0')}-${hash(url)}${extension}`;
  return {
    filePath: join(publicImageRoot, slug, filename),
    publicPath: `/images/legacy/${slug}/${filename}`
  };
};

const collectTasks = () => {
  const files = readdirSync(legacyEssayDir)
    .filter((file) => file.endsWith('.md'))
    .sort()
    .map((file) => join(legacyEssayDir, file));

  const fileStates = [];
  const tasks = [];

  for (const filePath of files) {
    const content = readFileSync(filePath, 'utf8');
    const slug = getEntrySlug(content, filePath);
    const remoteUrls = [];
    const seen = new Set();

    for (const match of content.matchAll(imagePattern)) {
      const url = match[2];
      if (!remoteImagePattern.test(url) || seen.has(url)) continue;
      seen.add(url);
      remoteUrls.push(url);
    }

    const replacements = new Map();
    const state = { filePath, content, slug, remoteUrls, replacements };
    fileStates.push(state);

    remoteUrls.forEach((url, index) => {
      tasks.push({ state, slug, url, index });
    });
  }

  return { fileStates, tasks };
};

const fetchImage = async (url) => {
  const response = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(requestTimeoutMs),
    headers: {
      'user-agent': 'astro-whono-legacy-image-localizer/1.0'
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type') ?? '';
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length === 0) {
    throw new Error('empty response body');
  }
  const extension = extensionFromContentType(contentType) ?? extensionFromUrl(url) ?? extensionFromBuffer(buffer);
  if (!extension) {
    throw new Error(`unsupported content-type: ${contentType || 'unknown'}`);
  }

  return { buffer, contentType, extension };
};

const runTask = async (task) => {
  try {
    const image = await fetchImage(task.url);
    const target = buildTarget({
      slug: task.slug,
      url: task.url,
      index: task.index,
      extension: image.extension
    });

    mkdirSync(dirname(target.filePath), { recursive: true });
    if (!existsSync(target.filePath)) {
      writeFileSync(target.filePath, image.buffer);
    }

    task.state.replacements.set(task.url, {
      ok: true,
      publicPath: target.publicPath,
      bytes: image.buffer.length,
      contentType: image.contentType
    });
  } catch (error) {
    task.state.replacements.set(task.url, {
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

const runPool = async (tasks) => {
  let cursor = 0;
  const workerCount = Math.max(1, Math.min(concurrency, tasks.length));
  const workers = Array.from({ length: workerCount }, async () => {
    while (cursor < tasks.length) {
      const task = tasks[cursor];
      cursor += 1;
      await runTask(task);
    }
  });
  await Promise.all(workers);
};

const writeMigratedFiles = (fileStates) => {
  for (const state of fileStates) {
    const migrated = state.content.replace(imagePattern, (full, alt, url, title = '') => {
      const replacement = state.replacements.get(url);
      if (!replacement?.ok) return full;
      return `![${alt}](${replacement.publicPath}${title})`;
    });

    if (migrated !== state.content) {
      writeFileSync(state.filePath, migrated);
    }
  }
};

const createReport = (fileStates) => {
  const files = fileStates.map((state) => {
    const successes = [];
    const failures = [];

    for (const url of state.remoteUrls) {
      const result = state.replacements.get(url);
      if (!result) continue;
      if (result.ok) {
        successes.push({
          sourceUrl: url,
          publicPath: result.publicPath,
          bytes: result.bytes,
          contentType: result.contentType
        });
      } else {
        failures.push({
          sourceUrl: url,
          error: result.error
        });
      }
    }

    return {
      file: state.filePath.replace(`${projectRoot}/`, ''),
      slug: state.slug,
      discovered: state.remoteUrls.length,
      localized: successes.length,
      failed: failures.length,
      successes,
      failures
    };
  });

  const summary = files.reduce(
    (acc, item) => {
      acc.discovered += item.discovered;
      acc.localized += item.localized;
      acc.failed += item.failed;
      if (item.localized > 0) acc.changedFiles += 1;
      return acc;
    },
    { files: files.length, changedFiles: 0, discovered: 0, localized: 0, failed: 0 }
  );

  return { summary, files };
};

const run = async () => {
  const { fileStates, tasks } = collectTasks();
  await runPool(tasks);
  writeMigratedFiles(fileStates);

  const report = createReport(fileStates);
  mkdirSync(reportDir, { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report.summary, null, 2));

  if (report.summary.failed > 0) {
    process.exitCode = 2;
  }
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
