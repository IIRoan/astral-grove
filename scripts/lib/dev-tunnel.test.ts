import { expect, test } from 'bun:test';
import { apiOnlyTunnelConfig, tunnelMode } from './dev-tunnel';

test('local configuration cannot forward debugger, Metro, web sockets or arbitrary services', () => {
  const config = apiOnlyTunnelConfig(
    {
      tunnel: 'test-tunnel',
      'credentials-file': '/tmp/synthetic-credentials.json',
      ingress: [{ service: 'http://localhost:7001' }],
    },
    'https://dev.example.com',
    7000
  );
  const route = (path: string) =>
    config.ingress.find(
      (rule) => !('path' in rule) || new RegExp(rule.path!).test(path)
    )?.service;
  for (const path of ['/api/v1/cards', '/api/auth/sign-in/email'])
    expect(route(path)).toBe('http://127.0.0.1:7000');
  for (const path of [
    '/',
    '/json',
    '/inspector/debug',
    '/message',
    '/api/v10',
    '/api/auth-evil',
  ])
    expect(route(path)).toBe('http_status:404');
  expect(config).not.toHaveProperty('originRequest');
  expect(() => apiOnlyTunnelConfig({}, 'https://dev.example.com', 7000)).toThrow();
  expect(() =>
    apiOnlyTunnelConfig(
      { tunnel: 'test', 'credentials-file': 'x' },
      'http://dev.example.com',
      7000
    )
  ).toThrow();
});

test('tunnel modes reject remotely managed ingress and retain API-only quick tunnels', () => {
  expect(() => tunnelMode({ token: 'synthetic', hasLocalConfig: true })).toThrow(
    'API-only'
  );
  expect(tunnelMode({ hasLocalConfig: true })).toBe('local');
  expect(
    tunnelMode({ hasLocalConfig: false, publicApiUrl: 'https://api.example.com' })
  ).toBe('external');
  expect(tunnelMode({ hasLocalConfig: false })).toBe('quick');
});
