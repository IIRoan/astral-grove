import { afterAll } from 'bun:test';
import { writeTrace } from './trace-plugin';
afterAll(writeTrace);
if (process.env.BASELINE_TRACE_E2E === 'true') await import('./preload');
