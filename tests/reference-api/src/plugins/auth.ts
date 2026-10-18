import { Elysia } from 'elysia';
import type { Auth } from '../auth.js';

export function createAuthPlugin(auth: Auth) {
  return new Elysia({ name: 'better-auth' }).mount(auth.handler);
}
