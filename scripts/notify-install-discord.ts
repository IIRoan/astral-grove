#!/usr/bin/env bun

function arg(flag: string): string {
  const index = process.argv.indexOf(flag);
  const value = index === -1 ? undefined : process.argv[index + 1];
  if (!value) {
    throw new Error(`Missing ${flag}`);
  }
  return value;
}

const webhook = process.env.DISCORD_WEBHOOK?.trim();
if (!webhook) {
  throw new Error('Missing DISCORD_WEBHOOK env');
}

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
      `**${title}** internal build ready (\`${profile}\`)`,
      'Scan → open the page → iPhone taps Install (registered ad-hoc), Android downloads the APK.',
      ref,
    ].join('\n'),
  })
);
form.append('files[0]', qr, `${profile}-qr.png`);

const response = await fetch(webhook, { method: 'POST', body: form });
if (!response.ok) {
  throw new Error(`Discord webhook failed (${String(response.status)})`);
}

console.log('Discord webhook delivered');
