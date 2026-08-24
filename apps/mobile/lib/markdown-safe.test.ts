import { describe, expect, test } from 'bun:test';
import {
  clampMarkdownSource,
  createSafeMarkdownIt,
  isSafeMarkdownUrl,
  MAX_MARKDOWN_LENGTH,
  normalizeMarkdownSource,
  prepareMarkdownSource,
} from '@/lib/markdown-safe';

describe('isSafeMarkdownUrl', () => {
  test('allows http, https, and mailto', () => {
    expect(isSafeMarkdownUrl('https://example.com/guide')).toBe(true);
    expect(isSafeMarkdownUrl('http://example.com')).toBe(true);
    expect(isSafeMarkdownUrl('mailto:coach@example.com')).toBe(true);
  });

  test('rejects dangerous and relative schemes', () => {
    expect(isSafeMarkdownUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeMarkdownUrl('data:text/html,hi')).toBe(false);
    expect(isSafeMarkdownUrl('//evil.example/path')).toBe(false);
    expect(isSafeMarkdownUrl('/relative/path')).toBe(false);
    expect(isSafeMarkdownUrl('riftbound://deck/1')).toBe(false);
    expect(isSafeMarkdownUrl('')).toBe(false);
  });
});

describe('normalizeMarkdownSource', () => {
  test('inserts a space after heading hashes when missing', () => {
    expect(normalizeMarkdownSource('#Hitt hello')).toBe('# Hitt hello');
    expect(normalizeMarkdownSource('##Guide\n\nbody')).toBe('## Guide\n\nbody');
    expect(normalizeMarkdownSource('# Already spaced')).toBe('# Already spaced');
  });

  test('does not alter thematic breaks or empty hashes alone', () => {
    expect(normalizeMarkdownSource('---')).toBe('---');
    expect(normalizeMarkdownSource('#')).toBe('#');
  });
});

describe('createSafeMarkdownIt', () => {
  test('does not emit raw HTML tags', () => {
    const md = createSafeMarkdownIt();
    const html = md.render('<script>alert(1)</script>\n\n**ok**');
    expect(html).not.toContain('<script>');
    expect(html).toContain('<strong>ok</strong>');
  });

  test('drops unsafe links while keeping safe ones', () => {
    const md = createSafeMarkdownIt();
    const html = md.render(
      '[safe](https://example.com) [bad](javascript:alert(1)) [rel](/local)'
    );
    expect(html).toContain('href="https://example.com"');
    expect(html).not.toContain('href="javascript:');
    expect(html).not.toContain('href="/local"');
    // Rejected markdown link syntax is left as plain text, not an anchor.
    expect(html).toContain('[bad](javascript:alert(1))');
  });

  test('does not render images', () => {
    const md = createSafeMarkdownIt();
    const html = md.render('![x](https://example.com/a.png)');
    expect(html).not.toContain('<img');
  });

  test('renders normalized compact headings', () => {
    const md = createSafeMarkdownIt();
    const html = md.render(
      prepareMarkdownSource('#Hitt helloooooooo\n\n**bold** body')
    );
    expect(html).toContain('<h1>');
    expect(html).toContain('Hitt helloooooooo');
    expect(html).not.toContain('#Hitt');
    expect(html).toContain('<strong>bold</strong>');
  });
});

describe('clampMarkdownSource', () => {
  test('truncates overlong input', () => {
    const long = 'a'.repeat(MAX_MARKDOWN_LENGTH + 50);
    expect(clampMarkdownSource(long).length).toBe(MAX_MARKDOWN_LENGTH);
  });
});
