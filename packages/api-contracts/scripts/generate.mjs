import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import openapiTS, { astToString } from 'openapi-typescript';
import { format, resolveConfig } from 'prettier';
const root = resolve(import.meta.dirname, '..');
const document = JSON.parse(readFileSync(resolve(root, 'openapi.json'), 'utf8'));
const destination = resolve(root, 'src/generated/schema.ts');
const output = await format(astToString(await openapiTS(document)), {
  ...(await resolveConfig(destination)),
  filepath: destination,
});
if (process.argv.includes('--check')) {
  if (readFileSync(destination, 'utf8') !== output)
    throw new Error('Generated TypeScript API contracts are stale');
} else {
  writeFileSync(destination, output);
  writeFileSync(
    resolve(root, 'openapi.json'),
    await format(JSON.stringify(document), {
      ...(await resolveConfig(resolve(root, 'openapi.json'))),
      parser: 'json',
    })
  );
}
console.log('Rust OpenAPI / TypeScript contracts verified');
