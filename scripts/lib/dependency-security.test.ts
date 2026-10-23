import { describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { generateKeyPairSync } from 'node:crypto';
import { createRequire } from 'node:module';

const mobile = createRequire(
  new URL('../../apps/mobile/package.json', import.meta.url)
);
const expo = createRequire(mobile.resolve('expo/package.json'));
const cli = createRequire(expo.resolve('@expo/cli/package.json'));
const metro = createRequire(expo.resolve('@expo/metro/package.json'));
const fileMap = createRequire(metro.resolve('metro-file-map/package.json'));
const micromatch = createRequire(fileMap.resolve('micromatch/package.json'));
const braces = micromatch('braces');
const forge = cli('node-forge');
const uniwind = createRequire(mobile.resolve('uniwind/package.json'));
const legacyConfig = createRequire(uniwind.resolve('@expo/metro-config/package.json'));
const legacyMetro = createRequire(legacyConfig.resolve('@expo/metro/package.json'));
const assets = createRequire(legacyMetro.resolve('metro/package.json'));
const imageSizePath = assets.resolve('image-size');

describe('braces nesting guard (CVE-2026-93687)', () => {
  for (const [open, close] of [
    ['{', '}'],
    ['(', ')'],
  ] as const) {
    for (const method of ['parse', 'compile', 'expand', 'stringify'] as const) {
      test(`${method} rejects excessive ${open}${close} nesting before recursive walks`, () => {
        expect(() =>
          braces[method](open.repeat(101) + 'a' + close.repeat(101))
        ).toThrow(/nesting depth/i);
      });
    }
  }

  test('preserves normal expansion, ranges, escaped braces and sequential groups', () => {
    expect(braces.expand('src/{app,lib}/file.{ts,tsx}')).toEqual([
      'src/app/file.ts',
      'src/app/file.tsx',
      'src/lib/file.ts',
      'src/lib/file.tsx',
    ]);
    expect(braces.expand('{1..3}')).toEqual(['1', '2', '3']);
    expect(braces.compile('\\{'.repeat(150))).toBe('{'.repeat(150));
    expect(() => braces.parse('{a,b}'.repeat(150))).not.toThrow();
    expect(() => braces.compile('{'.repeat(100) + 'a' + '}'.repeat(100))).not.toThrow();
  });
});

describe('node-forge DigestAlgorithm validation (CVE-2026-85393)', () => {
  const { privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 1024,
    privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
    publicKeyEncoding: { type: 'pkcs1', format: 'pem' },
  });
  const key = forge.pki.privateKeyFromPem(privateKey);
  const publicKey = forge.pki.setRsaPublicKey(key.n, key.e);
  const digest = forge.md.sha256
    .create()
    .update('synthetic security fixture')
    .digest()
    .getBytes();
  const asn1 = forge.asn1;
  const node = (type: number, constructed: boolean, value: unknown) =>
    asn1.create(asn1.Class.UNIVERSAL, type, constructed, value);

  for (const withNull of [false, true]) {
    for (const withExtra of [false, true]) {
      test(`${withNull ? 'NULL' : 'absent'} parameters ${withExtra ? 'reject extra children' : 'verify valid signatures'}`, () => {
        const algorithm = [
          node(asn1.Type.OID, false, asn1.oidToDer(forge.pki.oids.sha256).getBytes()),
        ];
        if (withNull) algorithm.push(node(asn1.Type.NULL, false, ''));
        if (withExtra) algorithm.push(node(asn1.Type.OCTETSTRING, false, 'garbage'));
        const info = node(asn1.Type.SEQUENCE, true, [
          node(asn1.Type.SEQUENCE, true, algorithm),
          node(asn1.Type.OCTETSTRING, false, digest),
        ]);
        const signature = key.sign(asn1.toDer(info).getBytes(), 'NONE');
        if (withExtra) {
          expect(() => publicKey.verify(digest, signature)).toThrow(/DigestInfo/);
        } else {
          expect(publicKey.verify(digest, signature)).toBe(true);
        }
      });
    }
  }
});

describe('legacy image-size parser progress (CVE-2025-71329 and CVE-2025-71330)', () => {
  const box = (name: string, size: number, payload = Buffer.alloc(0)) => {
    const header = Buffer.alloc(8);
    header.writeUInt32BE(size);
    header.write(name, 4);
    return Buffer.concat([header, payload]);
  };
  const icon = (size: number) => {
    const entry = Buffer.alloc(8);
    entry.write('ic07');
    entry.writeUInt32BE(size, 4);
    return entry;
  };

  const invalidImages = [
    Buffer.concat([Buffer.from('icns'), Buffer.from([0, 0, 0, 16]), icon(0)]),
    Buffer.concat([
      box('JXL ', 12, Buffer.from([13, 10, 135, 10])),
      box('ftyp', 12, Buffer.from('jxl ')),
      box('jxlp', 0),
    ]),
    Buffer.concat([box('ftyp', 12, Buffer.from('heic')), box('meta', 0)]),
  ];

  for (const [index, image] of invalidImages.entries()) {
    test(`rejects malformed ${['ICNS', 'JXL', 'HEIF'][index]} without hanging`, () => {
      const child = spawnSync(
        process.execPath,
        [
          '--no-env-file',
          '-e',
          "const size = require(process.argv[1]); try { size(Buffer.from(process.argv[2], 'hex')); console.log('accepted'); } catch { console.log('rejected'); }",
          imageSizePath,
          image.toString('hex'),
        ],
        { timeout: 2000, encoding: 'utf8', maxBuffer: 4096, env: {} }
      );
      expect(child.error).toBeUndefined();
      expect(child.status).toBe(0);
      expect(child.stdout.trim()).toBe('rejected');
    });
  }

  test('preserves the callable Metro API for valid PNG and ICNS assets', () => {
    const imageSize = assets('image-size');
    const png = Buffer.from(
      '89504e470d0a1a0a0000000d4948445200000002000000030806000000',
      'hex'
    );
    expect(imageSize(png)).toMatchObject({ width: 2, height: 3, type: 'png' });
    const icns = Buffer.concat([
      Buffer.from('icns'),
      Buffer.from([0, 0, 0, 16]),
      icon(8),
    ]);
    expect(imageSize(icns)).toMatchObject({ width: 128, height: 128, type: 'ic07' });
  });
});
