#!/usr/bin/env bun

function arg(flag: string): string {
  const index = process.argv.indexOf(flag);
  const value = index === -1 ? undefined : process.argv[index + 1];
  if (!value) {
    throw new Error(`Missing ${flag}`);
  }
  return value;
}

const webhook = arg('--webhook');
const qrPath = arg('--qr');
const profile = arg('--profile');
const title = arg('--title');
const ref = arg('--ref');

const qr = Bun.file(qrPath);
if (!(await qr.exists())) {
  throw new Error(`QR file not found: ${qrPath}`);
}

const form = new FormData();
form.append(
  'payload_json',
  JSON.stringify({
    content: [
      `**${title}** iOS build ready (\`${profile}\`)`,
      'Scan with Camera on a registered ad-hoc device.',
      ref,
    ].join('\n'),
  })
);
form.append('files[0]', qr, `${profile}-qr.png`);

const response = await fetch(webhook, { method: 'POST', body: form });
if (!response.ok) {
  const body = await response.text();
  throw new Error(`Discord webhook failed (${String(response.status)}): ${body}`);
}

console.log('Discord webhook delivered');
