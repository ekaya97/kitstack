import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { noConsole } from '../src/rules/no-console.js';
import { noRawSql } from '../src/rules/no-raw-sql.js';

const srcDir = fileURLToPath(new URL('../src', import.meta.url));

/** Every source file in src/, so a new file is covered without touching this test. */
function sourceFiles(): readonly string[] {
  return readdirSync(srcDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.tsx'))
    .map((entry) => `${srcDir}/${entry.name}`);
}

describe('lint rules over the whole source tree', () => {
  it('no file writes raw SQL', () => {
    for (const file of sourceFiles()) {
      expect(noRawSql(readFileSync(file, 'utf8')), file).toEqual([]);
    }
  });

  it('no file logs to the console', () => {
    for (const file of sourceFiles()) {
      expect(noConsole(readFileSync(file, 'utf8')), file).toEqual([]);
    }
  });
});
