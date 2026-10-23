# Dependency security patches

The root Bun install applies these patches to Expo/Metro tooling. The standalone
`design/` install applies the same braces patch through both Bun and pnpm. Keep
`design/package.json` and `design/pnpm-workspace.yaml` aligned when changing its
overrides or patches.

| Package            | Advisory                                                                                                                                 | Local fix and upstream reference                                                                                                                                                                                                                                                  |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `braces@3.0.3`     | [CVE-2026-93687](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)                                                                      | Limit combined brace/parenthesis nesting to 100 before constructing a recursive AST, following the mitigation in [upstream issue 70](https://github.com/micromatch/braces/issues/70). Escaped and quoted delimiters remain literal. No fixed release was available on 2026-10-23. |
| `node-forge@1.4.0` | [CVE-2026-85393](https://github.com/advisories/GHSA-86w9-cpqp-85rv)                                                                      | Check the nested DigestAlgorithm element count, using the source change from [upstream PR 1152](https://github.com/digitalbazaar/forge/pull/1152). Preserve absent and NULL algorithm parameters. The upstream PR was still open, with no fixed release available on 2026-10-23.  |
| `image-size@1.2.1` | [CVE-2025-71329](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq), [CVE-2025-71330](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr) | Reject undersized/truncated ISO box and ICNS entry headers before parsing or advancing. Backport the bounds checks while retaining the callable v1 API required by legacy Metro consumers; the published fix is in v2.0.3.                                                        |

`scripts/lib/dependency-security.test.ts` exercises the actual Expo, Metro and
Uniwind dependency resolutions. It checks bounded rejection of malformed images,
excessive nesting and extra RSA algorithm elements, plus valid signature and asset
compatibility. CI runs it with the other `scripts/lib/*.test.ts` tests.

Run the regressions with:

```sh
bun --no-env-file test scripts/lib/dependency-security.test.ts
```

Version-based scanners still report these package versions because they do not
inspect local patches. Do not suppress those advisories globally or describe the
unfiltered audit as clean. Replace each patch with a compatible published fix when
available, then rerun the regressions and frozen installs.
