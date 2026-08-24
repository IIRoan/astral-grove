import type MarkdownIt from 'markdown-it';
import { keySlug } from '@/lib/react-list-keys';

type Token = ReturnType<MarkdownIt['parse']>[number];

/** Stable React key for a markdown-it token within a parent path. */
export function markdownTokenKey(
  parentPath: string,
  token: Token,
  siblingFingerprint: string
): string {
  const map = token.map;
  if (map) {
    return `${parentPath}/${token.type}@${map[0]}-${map[1]}`;
  }
  const href = token.attrGet('href');
  const content = token.content || href || siblingFingerprint;
  return `${parentPath}/${token.type}/${keySlug(String(content))}`;
}

/** Extends a sibling path after rendering a token (no array index). */
export function extendSiblingPath(path: string, token: Token): string {
  const piece =
    token.map != null
      ? `@${token.map[0]}`
      : keySlug(token.content || token.attrGet('href') || token.type, 16);
  return `${path}/${token.type}:${piece}`;
}

/** Stable key for a list item from its nested block tokens. */
export function markdownListItemKey(listPath: string, itemTokens: Token[]): string {
  const inline = itemTokens.find(
    (t) => t.type === 'inline' || t.type === 'paragraph_open'
  );
  let fingerprint = '';
  if (inline?.type === 'inline' && inline.children?.length) {
    const parts: string[] = [];
    for (const child of inline.children) {
      if (child.type === 'text') parts.push(child.content);
    }
    fingerprint = parts.join('').slice(0, 64);
  }
  if (!fingerprint) {
    fingerprint = itemTokens
      .map((t) => t.content || t.type)
      .join('|')
      .slice(0, 64);
  }
  return `${listPath}/li/${keySlug(fingerprint)}`;
}
