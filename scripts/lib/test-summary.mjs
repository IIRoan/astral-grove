function emptyStats() {
  return { passed: 0, failed: 0, total: 0 };
}

function addStats(target, source) {
  target.passed += source.passed;
  target.failed += source.failed;
  target.total += source.total;
}

export function parseTurboTestOutput(output) {
  /** @type {Map<string, { passed: number; failed: number; total: number; kind?: 'unit' | 'database' }>} */
  const packages = new Map();
  /** @type {Map<string, { passed: number; failed: number }>} */
  const pending = new Map();
  const breakdown = {
    unit: emptyStats(),
    database: emptyStats(),
  };

  for (const line of output.split('\n')) {
    const apiBreakdown = line.match(
      /^@riftbound\/api:test:\s+@riftbound\/api \((unit|e2e)\)\s+(\d+) pass\s+(\d+) fail\s+\(\s*(\d+) total\)/
    );
    if (apiBreakdown) {
      const kind = apiBreakdown[1] === 'e2e' ? 'database' : 'unit';
      const stats = {
        passed: Number(apiBreakdown[2]),
        failed: Number(apiBreakdown[3]),
        total: Number(apiBreakdown[4]),
        kind,
      };
      packages.set(`riftbound/api (${apiBreakdown[1]})`, stats);
      addStats(breakdown[kind], stats);
      continue;
    }

    const match = line.match(/^@([\w@/.-]+):test:\s*(.*)$/);
    if (!match) continue;

    const pkg = match[1];
    const content = match[2];

    if (!packages.has(pkg)) {
      packages.set(pkg, { ...emptyStats(), kind: 'unit' });
    }

    const pass = content.match(/^\s*(\d+) pass/);
    const fail = content.match(/^\s*(\d+) fail/);
    const ran = content.match(/^Ran (\d+) tests/);

    if (pass || fail) {
      const current = pending.get(pkg) ?? { passed: 0, failed: 0 };
      if (pass) current.passed = Number(pass[1]);
      if (fail) current.failed = Number(fail[1]);
      pending.set(pkg, current);
    }

    if (ran) {
      const stats = packages.get(pkg);
      const current = pending.get(pkg) ?? { passed: 0, failed: 0 };
      stats.passed += current.passed;
      stats.failed += current.failed;
      stats.total += Number(ran[1]);
      pending.delete(pkg);

      if (pkg === 'riftbound/mobile') {
        breakdown.unit.passed += current.passed;
        breakdown.unit.failed += current.failed;
        breakdown.unit.total += Number(ran[1]);
        stats.kind = 'unit';
      }

      if (pkg === 'riftbound/api') {
        packages.delete('riftbound/api');
      }
    }
  }

  if (packages.has('riftbound/api (unit)') || packages.has('riftbound/api (e2e)')) {
    packages.delete('riftbound/api');
  }

  return { packages, breakdown };
}

export function parseBunTestOutput(output) {
  const suites = [];
  let passed = 0;
  let failed = 0;

  for (const line of output.split('\n')) {
    const pass = line.match(/^\s*(\d+) pass/);
    const fail = line.match(/^\s*(\d+) fail/);
    const ran = line.match(/^Ran (\d+) tests/);

    if (pass) passed = Number(pass[1]);
    if (fail) failed = Number(fail[1]);
    if (ran) {
      suites.push({
        passed,
        failed,
        total: Number(ran[1]),
      });
      passed = 0;
      failed = 0;
    }
  }

  return suites;
}

export function printTestSummary(packages, { title = 'Test Summary', breakdown = null } = {}) {
  const rows = [...packages.entries()].sort(([a], [b]) => a.localeCompare(b));
  const totals = rows.reduce(
    (sum, [, stats]) => ({
      passed: sum.passed + stats.passed,
      failed: sum.failed + stats.failed,
      total: sum.total + stats.total,
    }),
    { ...emptyStats() }
  );

  const labelWidth = Math.max(16, ...rows.map(([name]) => name.length), 'of which database'.length);

  console.log('');
  console.log('═'.repeat(labelWidth + 28));
  console.log(` ${title}`);
  console.log('═'.repeat(labelWidth + 28));

  for (const [name, stats] of rows) {
    const status = stats.failed === 0 ? 'ok' : 'FAIL';
    const kind =
      stats.kind === 'database' ? 'database' : stats.kind === 'unit' ? 'unit' : null;
    const suffix = kind ? `  [${kind}]` : '';
    console.log(
      ` ${name.padEnd(labelWidth)}  ${String(stats.passed).padStart(4)} pass  ${String(stats.failed).padStart(4)} fail  (${String(stats.total).padStart(4)} total)  ${status}${suffix}`
    );
  }

  console.log('─'.repeat(labelWidth + 28));
  console.log(
    ` ${'Total'.padEnd(labelWidth)}  ${String(totals.passed).padStart(4)} pass  ${String(totals.failed).padStart(4)} fail  (${String(totals.total).padStart(4)} total)`
  );

  if (breakdown) {
    console.log(
      ` ${'of which unit'.padEnd(labelWidth)}  ${String(breakdown.unit.passed).padStart(4)} pass  ${String(breakdown.unit.failed).padStart(4)} fail  (${String(breakdown.unit.total).padStart(4)} total)`
    );
    console.log(
      ` ${'of which database'.padEnd(labelWidth)}  ${String(breakdown.database.passed).padStart(4)} pass  ${String(breakdown.database.failed).padStart(4)} fail  (${String(breakdown.database.total).padStart(4)} total)`
    );
  }

  console.log('═'.repeat(labelWidth + 28));
  console.log('');

  return totals;
}
