# Migration reference

This is the Elysia implementation pinned by `plans/rust-migration/baseline/source.json`, retained solely for comparison tests and the original regression suite. It is not an application workspace or deployment target. The Rust backend lives in `apps/backend`; its deployed image contains no Bun or TypeScript runtime.

Unit tests exercise this reference to preserve the original baseline. HTTP compatibility tests launch the Rust binary, while database arrangements and legacy service comparisons use this reference explicitly. Native authentication, transport, concurrency and synchronization tests live in `apps/backend/test`.
