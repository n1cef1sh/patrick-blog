import { existsSync } from 'node:fs';
import path from 'node:path';
import { collectEssayImageBlocks } from './essay-image-blocks';
import { collectEssayGalleryImageSources } from './essay-gallery-blocks';

export type MarkdownBodyLocalImageReference = {
  kind: 'markdown' | 'figure' | 'gallery';
  src: string;
  absolutePath: string;
  relativePath: string;
};

export type EssayLocalImageReference = MarkdownBodyLocalImageReference;

type FindMissingMarkdownBodyLocalImageReferencesInput = {
  bodyText: string;
  sourcePath: string;
  projectRoot?: string;
  fileExists?: (absolutePath: string) => boolean;
};

const getProjectRoot = (): string =>
  process.env.ASTRO_WHONO_INTERNAL_TEST_PROJECT_ROOT?.trim() || process.cwd();

const decodeHtmlAttributeValue = (value: string): string =>
  value
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');

const normalizeImageSource = (value: string): string => {
  const decoded = decodeHtmlAttributeValue(value).trim();
  return decoded.startsWith('<') && decoded.endsWith('>')
    ? decoded.slice(1, -1).trim()
    : decoded;
};

const getLocalImagePathPart = (src: string): string | null => {
  const normalized = normalizeImageSource(src);
  if (
    !normalized
    || normalized.startsWith('/')
    || normalized.startsWith('//')
    || /^[A-Za-z][A-Za-z\d+.-]*:/.test(normalized)
  ) {
    return null;
  }

  const pathPart = (normalized.split(/[?#]/, 1)[0] ?? '').trim().replace(/\\/g, '/');
  return pathPart || null;
};

const toLocalImageReference = ({
  kind,
  src,
  sourcePath,
  projectRoot
}: {
  kind: MarkdownBodyLocalImageReference['kind'];
  src: string;
  sourcePath: string;
  projectRoot: string;
}): MarkdownBodyLocalImageReference | null => {
  const localPathPart = getLocalImagePathPart(src);
  if (!localPathPart) return null;

  const absolutePath = path.resolve(path.dirname(sourcePath), localPathPart);
  const relativePath = path.relative(projectRoot, absolutePath);
  if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    return null;
  }

  return {
    kind,
    src: normalizeImageSource(src),
    absolutePath,
    relativePath: relativePath.replace(/\\/g, '/')
  };
};

export const collectMarkdownBodyLocalImageReferences = ({
  bodyText,
  sourcePath,
  projectRoot = getProjectRoot()
}: Omit<FindMissingMarkdownBodyLocalImageReferencesInput, 'fileExists'>): MarkdownBodyLocalImageReference[] => {
  const references: MarkdownBodyLocalImageReference[] = [];

  for (const block of collectEssayImageBlocks(bodyText)) {
    const reference = toLocalImageReference({
      kind: block.kind,
      src: block.draft.src,
      sourcePath,
      projectRoot
    });
    if (reference) references.push(reference);
  }

  for (const image of collectEssayGalleryImageSources(bodyText)) {
    const reference = toLocalImageReference({
      kind: image.kind,
      src: image.src,
      sourcePath,
      projectRoot
    });
    if (reference) references.push(reference);
  }

  return references;
};

export const findMissingEssayLocalImageReferences = ({
  bodyText,
  sourcePath,
  projectRoot = getProjectRoot(),
  fileExists = existsSync
}: FindMissingMarkdownBodyLocalImageReferencesInput): MarkdownBodyLocalImageReference[] => {
  const seen = new Set<string>();
  const missing: MarkdownBodyLocalImageReference[] = [];

  for (const reference of collectMarkdownBodyLocalImageReferences({ bodyText, sourcePath, projectRoot })) {
    if (fileExists(reference.absolutePath)) continue;
    if (seen.has(reference.relativePath)) continue;

    seen.add(reference.relativePath);
    missing.push(reference);
  }

  return missing;
};

export const collectEssayLocalImageReferences = collectMarkdownBodyLocalImageReferences;
export const findMissingMarkdownBodyLocalImageReferences = findMissingEssayLocalImageReferences;
