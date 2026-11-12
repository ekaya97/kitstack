import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { extractConfigFieldNames, findConfigBypasses } from './support/config-chokepoint.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = join(__dirname, '..', 'src');
const CONFIG_LOADER_FILE = 'config-loader.ts';
const CONFIG_LOADER_PATH = join(SRC_DIR, CONFIG_LOADER_FILE);

const configLoaderSource = readFileSync(CONFIG_LOADER_PATH, 'utf8');
const configFields = new Set(extractConfigFieldNames(configLoaderSource));

// -------------------------------------------------------------------------------------------
// Sanity check on the mechanism itself: the field set the guard reasons about must be the real
// schema's fields, read from config-loader.ts, not a hand-typed guess.
// -------------------------------------------------------------------------------------------
describe('extractConfigFieldNames', () => {
  it('reads the real schema fields out of config-loader.ts', () => {
    expect([...configFields].sort()).toEqual(['retries', 'timeoutMs'].sort());
  });
});

// -------------------------------------------------------------------------------------------
// The guard itself: every module in src/, other than config-loader.ts, must obtain config data
// through loadConfig(). This is the test required by TASK3B; it must fail the moment a module
// bypasses loadConfig, which is exactly what queue-worker.ts and scheduler.ts already do in
// this fixture, so this test is expected to be red against the fixture as delivered.
// -------------------------------------------------------------------------------------------
describe('config chokepoint: only loadConfig may unpack the config', () => {
  const files = readdirSync(SRC_DIR).filter((f) => f.endsWith('.ts') && f !== CONFIG_LOADER_FILE);

  it.each(files)('%s does not unpack the config itself', (file) => {
    const source = readFileSync(join(SRC_DIR, file), 'utf8');
    const violations = findConfigBypasses(file, source, configFields);
    expect(violations).toEqual([]);
  });
});

// -------------------------------------------------------------------------------------------
// eingriff-fahren step 3+4: reintroduce the exact defect via the real mechanism (mutate the
// actual file on disk, the same way a developer would), confirm the guard goes red, remove it,
// confirm the guard goes green again. queue-worker.ts already carries the defect, so "removal"
// here means routing it through loadConfig the way http-client.ts does; the file is restored to
// its original content afterwards so this file's addition is the only change left behind.
// -------------------------------------------------------------------------------------------
describe('eingriff-fahren: flip check on the real file (not a hand-typed stand-in)', () => {
  const queueWorkerPath = join(SRC_DIR, 'queue-worker.ts');
  const originalQueueWorker = readFileSync(queueWorkerPath, 'utf8');

  afterEach(() => {
    writeFileSync(queueWorkerPath, originalQueueWorker);
  });

  it('is red on the defect as delivered (sanity: the defect is really there)', () => {
    const violations = findConfigBypasses('queue-worker.ts', originalQueueWorker, configFields);
    expect(violations.length).toBeGreaterThan(0);
  });

  it('goes green once the file is rewritten to go through loadConfig, on the real file content', () => {
    const fixed = [
      "import { loadConfig } from './config-loader.js';",
      '',
      'export function createWorker(raw: unknown): { retries: number } {',
      '  const config = loadConfig(raw);',
      '  return { retries: config.retries };',
      '}',
      '',
    ].join('\n');
    writeFileSync(queueWorkerPath, fixed);
    const rewritten = readFileSync(queueWorkerPath, 'utf8');
    const violations = findConfigBypasses('queue-worker.ts', rewritten, configFields);
    expect(violations).toEqual([]);
  });

  it('goes red again once the defect is reintroduced on the real file content', () => {
    writeFileSync(queueWorkerPath, originalQueueWorker);
    const restored = readFileSync(queueWorkerPath, 'utf8');
    const violations = findConfigBypasses('queue-worker.ts', restored, configFields);
    expect(violations.length).toBeGreaterThan(0);
  });
});

// -------------------------------------------------------------------------------------------
// eingriff-fahren step 5: legitimate neighbours the guard must let through, plus a few defect
// variants (different assertion syntax, partial field overlap, one extra alias hop) to check
// the guard's reach isn't accidentally narrower than the real defect. Twenty-six cases total.
// -------------------------------------------------------------------------------------------
describe('eingriff-fahren: legitimate neighbours the guard must not flag', () => {
  const legitimate: Array<[name: string, source: string]> = [
    [
      'function form: loadConfig then read a field',
      "import { loadConfig } from './config-loader.js';\n" +
        'export function f(raw: unknown) { const config = loadConfig(raw); return config.retries; }',
    ],
    [
      'arrow form: loadConfig then read a field',
      "import { loadConfig } from './config-loader.js';\n" +
        'export const f = (raw: unknown) => { const config = loadConfig(raw); return config.timeoutMs; };',
    ],
    [
      'class method form: loadConfig then read a field',
      "import { loadConfig } from './config-loader.js';\n" +
        'export class Client { create(raw: unknown) { const config = loadConfig(raw); return config.retries; } }',
    ],
    [
      'destructuring the loadConfig result, no assertion at all',
      "import { loadConfig } from './config-loader.js';\n" +
        'export function f(raw: unknown) { const { retries } = loadConfig(raw); return retries; }',
    ],
    [
      'returning loadConfig(raw) directly, no local binding',
      "import { loadConfig } from './config-loader.js';\n" + 'export function f(raw: unknown) { return loadConfig(raw); }',
    ],
    [
      'casting the already-validated loadConfig() call result further',
      "import { loadConfig } from './config-loader.js';\n" +
        'export function f(raw: unknown) { return loadConfig(raw) as { retries: number }; }',
    ],
    [
      'casting a variable that already holds the loadConfig() result',
      "import { loadConfig } from './config-loader.js';\n" +
        'export function f(raw: unknown) { const config = loadConfig(raw); return config as { retries: number }; }',
    ],
    [
      'unrelated: as const on a literal array',
      'export function f() { const x = [1, 2, 3] as const; return x; }',
    ],
    [
      'unrelated: cast to an unrelated array type',
      'export function f(x: unknown) { return x as string[]; }',
    ],
    [
      'unrelated: cast to a type literal with disjoint field names',
      'export function f(x: unknown) { return x as { id: string; label: string }; }',
    ],
    [
      'typeof narrowing without any assertion',
      'export function f(raw: unknown) { if (typeof raw === "object" && raw !== null) { return raw; } return null; }',
    ],
    [
      'unknown param never read at all',
      'export function f(raw: unknown): void {}',
    ],
    [
      'unrelated cast on a validated (non-unknown, non-any) parameter',
      'export function f(x: string) { return x as unknown as { retries: number }; }',
    ],
    [
      'plain utility function, no config involvement',
      'export function toUpper(s: string) { return s.toUpperCase(); }',
    ],
    [
      'cast to a bare number, no object literal target',
      'export function f(raw: unknown) { const n = raw as number; return n; }',
    ],
    [
      'cast to a named type reference (AppConfig), not a type literal',
      "import type { AppConfig } from './config-loader.js';\n" +
        'export function f(x: string) { return x as unknown as AppConfig; }',
    ],
    [
      'satisfies instead of as, on an unknown param',
      'export function f(raw: unknown) { const x = { retries: 1 } satisfies { retries: number }; return x; }',
    ],
    [
      'unknown param passed straight through to loadConfig with an unrelated local cast elsewhere',
      "import { loadConfig } from './config-loader.js';\n" +
        'export function f(raw: unknown, other: unknown) {\n' +
        '  const config = loadConfig(raw);\n' +
        '  const label = other as { id: string };\n' +
        '  return { retries: config.retries, label };\n' +
        '}',
    ],
    [
      'destructured parameter typed unknown via an object pattern, unrelated cast',
      'export function f({ a }: { a: unknown }) { return a as { id: string }; }',
    ],
    [
      'generic parser unrelated to config, casts its own already-known shape',
      'interface Point { x: number; y: number }\nexport function f(raw: Point) { return raw as { x: number }; }',
    ],
  ];

  it.each(legitimate)('%s', (_name, source) => {
    const violations = findConfigBypasses('synthetic.ts', source, configFields);
    expect(violations).toEqual([]);
  });
});

describe('eingriff-fahren: defect variants the guard must still catch', () => {
  const bypassing: Array<[name: string, source: string]> = [
    [
      'the real queue-worker.ts shape (as-expression, single field)',
      'export function createWorker(raw: unknown) { const config = raw as { retries: number }; return config.retries; }',
    ],
    [
      'the real scheduler.ts shape (as-expression, single field)',
      'export function createScheduler(raw: unknown) { const config = raw as { timeoutMs: number }; return config.timeoutMs; }',
    ],
    [
      'angle-bracket assertion instead of as',
      'export function f(raw: unknown) { const config = <{ retries: number }>raw; return config.retries; }',
    ],
    [
      'any-typed parameter instead of unknown',
      'export function f(raw: any) { const config = raw as { timeoutMs: number }; return config.timeoutMs; }',
    ],
    [
      'one alias hop before the cast',
      'export function f(raw: unknown) { const r = raw; const config = r as { retries: number }; return config.retries; }',
    ],
    [
      'both fields asserted at once',
      'export function f(raw: unknown) { return raw as { retries: number; timeoutMs: number }; }',
    ],
  ];

  it.each(bypassing)('%s', (_name, source) => {
    const violations = findConfigBypasses('synthetic.ts', source, configFields);
    expect(violations.length).toBeGreaterThan(0);
  });
});
