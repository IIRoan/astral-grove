export const API_URL = process.env.UI_E2E_API_URL ?? 'http://localhost:7000';
export const WEB_ORIGIN =
  process.env.UI_E2E_WEB_URL ??
  `http://localhost:${process.env.UI_E2E_WEB_PORT ?? '7011'}`;
