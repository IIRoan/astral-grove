import { describe, expect, test } from 'bun:test';
import { resizeImageToWebp } from '../../src/lib/image-resize-buffer.js';

describe('resizeImageToWebp', () => {
  test('downscales a png buffer to webp', async () => {
    const pngBase64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const input = Uint8Array.from(atob(pngBase64), (c) => c.charCodeAt(0)).buffer;

    const output = await resizeImageToWebp(input, 160);
    expect(output.byteLength).toBeGreaterThan(0);
    const header = new TextDecoder().decode(new Uint8Array(output.slice(0, 4)));
    expect(header).toBe('RIFF');
  });
});
