import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
const Symbol = z.object({
  file: z.string(),
  name: z.string(),
  line: z.number().int(),
  endLine: z.number().int().optional(),
  kind: z.string().optional(),
  parameters: z.array(z.string()).optional(),
  exercised: z.boolean(),
});
const Report = z.object({ total: z.number().int(), functions: z.array(Symbol) });
const tiers = ['unit', 'e2e', 'extra', 'startup', 'startup-retry'];
const reports = tiers.map((tier) => ({
  tier,
  report: Report.parse(
    JSON.parse(readFileSync(`/tmp/astral-baseline-${tier}-functions.json`, 'utf8'))
  ),
}));
const baseline = z
  .object({ revision: z.string(), functionCount: z.number().int() })
  .parse(
    JSON.parse(
      readFileSync(
        resolve(import.meta.dir, '../../plans/rust-migration/baseline/source.json'),
        'utf8'
      )
    )
  );
const identity = (symbol: z.infer<typeof Symbol>) =>
  `${symbol.file}:${symbol.line}:${symbol.name}`;
for (const { report } of reports)
  if (report.total !== baseline.functionCount)
    throw new Error('Function inventory drifted');
const functions = reports[0]!.report.functions.map((symbol) => {
  const { exercised: _exercised, ...entry } = symbol;
  const exercisedBy = reports
    .filter(({ report }) =>
      report.functions.some(
        (other) => other.exercised && identity(symbol) === identity(other)
      )
    )
    .map(({ tier }) => tier);
  if (!exercisedBy.length)
    throw new Error(`Unexercised baseline function: ${identity(symbol)}`);
  return { ...entry, exercisedBy };
});
const output = {
  revision: baseline.revision,
  functionCount: functions.length,
  exercised: functions.length,
  scope:
    'Named functions and methods from the pinned TypeScript source; does not measure branch coverage or anonymous callbacks.',
  functions,
};
writeFileSync(
  resolve(import.meta.dir, '../../plans/rust-migration/baseline/functions.json'),
  JSON.stringify(output, null, 2) + '\n'
);
console.log(
  `Function baseline: ${functions.length}/${baseline.functionCount} exercised`
);
