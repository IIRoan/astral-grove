import sharp from 'sharp';
import type { AllowedThumbWidth } from './image-resize.js';

export async function resizeImageToWebp(
  body: ArrayBuffer,
  width: AllowedThumbWidth
): Promise<ArrayBuffer> {
  const output = await sharp(Buffer.from(body), { failOn: 'none' })
    .rotate()
    .resize({ width, withoutEnlargement: true })
    .webp({ quality: 78, effort: 4 })
    .toBuffer();
  return output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength);
}
