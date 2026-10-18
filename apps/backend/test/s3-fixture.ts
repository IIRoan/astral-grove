import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
const encoded = (text: string) =>
  encodeURIComponent(text).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  );
const hash = (text: string) => createHash('sha256').update(text).digest('hex');
const hmac = (key: string | Buffer, value: string) =>
  createHmac('sha256', key).update(value).digest();
// An independent verifier follows AWS's published SigV4 canonical request rules.
export function validS3Signature(request: Request, secret: string) {
  const url = new URL(request.url),
    query = url.searchParams;
  const signature = query.get('X-Amz-Signature'),
    credential = query.get('X-Amz-Credential'),
    date = query.get('X-Amz-Date'),
    algorithm = query.get('X-Amz-Algorithm'),
    signed = query.get('X-Amz-SignedHeaders');
  if (!signature || !credential || !date || !signed || algorithm !== 'AWS4-HMAC-SHA256')
    return false;
  const [access, day, region, service, end] = credential.split('/');
  if (
    access !== 'fixture-access' ||
    !day ||
    !region ||
    service !== 's3' ||
    end !== 'aws4_request'
  )
    return false;
  const headers = signed
    .split(';')
    .map(
      (key) =>
        `${key}:${(key === 'host' ? url.host : (request.headers.get(key) ?? '')).trim().replace(/\s+/g, ' ')}\n`
    )
    .join('');
  const canonicalQuery = [...query]
    .filter(([key]) => key !== 'X-Amz-Signature')
    .map(([key, value]) => [encoded(key), encoded(value)])
    .sort((a, b) =>
      a[0]! < b[0]!
        ? -1
        : a[0]! > b[0]!
          ? 1
          : a[1]! < b[1]!
            ? -1
            : a[1]! > b[1]!
              ? 1
              : 0
    )
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
  const canonical = [
    request.method,
    url.pathname,
    canonicalQuery,
    headers,
    signed,
    'UNSIGNED-PAYLOAD',
  ].join('\n');
  const scope = [day, region, service, end].join('/');
  const signing = hmac(hmac(hmac(hmac('AWS4' + secret, day), region), service), end);
  const expected = hmac(signing, [algorithm, date, scope, hash(canonical)].join('\n'));
  const received = Buffer.from(signature, 'hex');
  return received.length === expected.length && timingSafeEqual(received, expected);
}
