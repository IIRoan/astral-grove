import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { z } from 'zod';

const Job = z
  .object({
    if: z.string().optional(),
    env: z.record(z.unknown()).optional(),
    needs: z.union([z.string(), z.array(z.string())]).optional(),
    environment: z.string().optional(),
    steps: z.array(
      z
        .object({
          uses: z.string().optional(),
          run: z.string().optional(),
          env: z.record(z.unknown()).optional(),
          with: z.record(z.unknown()).optional(),
        })
        .passthrough()
    ),
  })
  .passthrough();
const Workflow = z.object({
  on: z.record(z.unknown()),
  permissions: z.object({ contents: z.literal('read') }),
  jobs: z.record(Job),
});
const load = (name: string): unknown =>
  Bun.YAML.parse(
    readFileSync(
      new URL(`../../.github/workflows/${name}.yml`, import.meta.url),
      'utf8'
    )
  );
const read = (name: string) => Workflow.parse(load(name));

test('releases never run for pull requests and are gated on main and a protected environment', () => {
  const workflow = read('mobile-internal-build');
  expect(workflow.on).not.toHaveProperty('pull_request');
  expect(workflow.on).not.toHaveProperty('pull_request_target');
  expect(workflow.jobs.meta?.if).toBe("github.ref == 'refs/heads/main'");
  for (const [name, job] of Object.entries(workflow.jobs)) {
    expect(job.environment).toBe('internal-releases');
    if (name !== 'meta') expect([job.needs].flat()).toContain('meta');
    expect(JSON.stringify(job)).not.toMatch(/secrets\.S3_/);
  }
  expect(workflow.jobs.publish?.if).toContain("needs.meta.result == 'success'");
});

test('privileged release actions are immutable and checkouts do not persist credentials', () => {
  for (const workflow of [read('mobile-internal-build'), read('eas-update')]) {
    for (const job of Object.values(workflow.jobs))
      for (const step of job.steps) {
        if (step.uses) expect(step.uses).toMatch(/@[a-f0-9]{40}$/);
        if (step.uses?.startsWith('actions/checkout@'))
          expect(step.with?.['persist-credentials']).toBe(false);
        if (step.uses?.startsWith('expo/expo-github-action@'))
          expect(step.with?.['eas-version']).toBe('24.6.0');
      }
  }
  const ota = read('eas-update').jobs.update!;
  expect(ota.if).toBe("github.ref == 'refs/heads/main'");
  expect(ota.environment).toBe('internal-releases');
});

const STORAGE_SECRET = /secrets\.(RELEASE_|S3_)/;

test('build jobs hold no storage credentials and hand publish a hashed artifact', () => {
  const { jobs } = read('mobile-internal-build');
  for (const name of ['meta', 'ios', 'android']) {
    expect(JSON.stringify(jobs[name])).not.toMatch(STORAGE_SECRET);
  }
  for (const name of ['ios', 'android']) {
    const job = jobs[name]!;
    expect(job.outputs).toHaveProperty('sha256');
    expect(
      job.steps.some((step) => step.uses?.startsWith('actions/upload-artifact@'))
    ).toBe(true);
  }
  const publish = jobs.publish!;
  expect(publish.if).toContain("github.ref == 'refs/heads/main'");
  expect(JSON.stringify(publish)).toMatch(STORAGE_SECRET);
  expect(JSON.stringify(publish)).not.toMatch(/eas build|swiftc|EXPO_TOKEN/);
  for (const step of publish.steps) {
    if (step.run?.includes('bun install'))
      expect(step.run).toContain('--ignore-scripts');
  }
  const verified = publish.steps.findIndex((step) =>
    step.run?.includes('sha256sum --check')
  );
  const published = publish.steps.findIndex((step) => step.run?.includes('publish-'));
  expect(verified).toBeGreaterThan(-1);
  expect(verified).toBeLessThan(published);
});

test('EXPO_TOKEN and the link secret are scoped to the steps that use them', () => {
  for (const workflow of [read('mobile-internal-build'), read('eas-update')]) {
    for (const job of Object.values(workflow.jobs)) {
      expect(job.env ?? {}).not.toHaveProperty('EXPO_TOKEN');
      for (const step of job.steps) {
        if (step.env && 'RELEASE_LINK_SECRET' in step.env) {
          expect(step.run).toMatch(
            /publish-(ios-r2-release|internal-install-page)\.ts/
          );
        }
      }
    }
  }
});

test('sync workflows never interpolate secrets into scripts', () => {
  const Sync = z.object({
    on: z.record(z.unknown()),
    permissions: z.object({}).strict(),
    jobs: z.record(Job),
  });
  for (const name of ['sync-catalog', 'sync-cardmarket-prices']) {
    const workflow = Sync.parse(load(name));
    expect(workflow.on).not.toHaveProperty('pull_request');
    expect(workflow.on).not.toHaveProperty('pull_request_target');
    for (const job of Object.values(workflow.jobs))
      for (const step of job.steps) {
        expect(step.run ?? '').not.toContain('${{');
        if (step.uses) expect(step.uses).toMatch(/@[a-f0-9]{40}$/);
      }
  }
});
