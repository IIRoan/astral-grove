import type { S3Client, S3File } from 'bun';
import { Elysia, type Context } from 'elysia';
import { notFoundResponse, setApiError } from '../lib/api-error.js';
import { hasReleaseAccess, releaseFile } from '../lib/internal-release.js';

export type ReleaseStorage = {
  exists: S3Client['exists'];
  file: (key: string) => Pick<S3File, 'text'>;
  presign: S3Client['presign'];
};

export function createReleasesRoutes(
  storage: ReleaseStorage | null,
  accessSecret?: string
) {
  const serve = async ({
    params,
    request,
    set,
  }: Pick<Context, 'request' | 'set'> & {
    params: { filename: string };
  }) => {
    set.headers['cache-control'] = 'no-store';
    const file = releaseFile(params.filename);
    if (
      !file ||
      !storage ||
      !accessSecret ||
      !hasReleaseAccess(
        accessSecret,
        file.key,
        new URL(request.url).searchParams.get('token')
      ) ||
      !(await storage.exists(file.key))
    ) {
      return setApiError(set, notFoundResponse('Build unavailable'));
    }

    if (file.kind === 'page' || file.kind === 'plist') {
      return new Response(
        request.method === 'HEAD' ? null : await storage.file(file.key).text(),
        {
          headers: {
            'content-type': file.contentType,
            'cache-control': 'no-store',
            'referrer-policy': 'no-referrer',
          },
        }
      );
    }

    const download = file.kind === 'apk' || file.kind === 'ipa';
    const url = storage.presign(file.key, {
      method: request.method === 'HEAD' ? 'HEAD' : 'GET',
      expiresIn: 3600,
      type: file.contentType,
      ...(download
        ? {
            contentDisposition: `attachment; filename="astral-grove-${file.profile}.${file.kind}"`,
          }
        : {}),
    });
    return new Response(null, {
      status: 302,
      headers: { location: url, 'cache-control': 'no-store' },
    });
  };
  return new Elysia({ prefix: '/api/v1/releases' })
    .get('/:filename', { detail: { tags: ['releases'] } }, serve)
    .head('/:filename', { detail: { tags: ['releases'] } }, serve);
}
