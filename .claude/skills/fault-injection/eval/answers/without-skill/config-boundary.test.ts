import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

// Enforces the rule from the fixture: `loadConfig` in src/config-loader.ts is the only
// place a raw/unknown configuration blob may be unpacked. Every other module must obtain
// config values by calling loadConfig(), not by casting or reading the raw value itself.

const here = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(here, '../src');

function listOtherSourceFiles(): string[] {
  return readdirSync(srcDir)
    .filter((name) => name.endsWith('.ts') && name !== 'config-loader.ts')
    .sort();
}

interface UnknownConfigCandidate {
  param: string;
  body: string;
}

// Finds every function parameter typed `unknown` (the shape loadConfig's raw input takes)
// together with the source text of that function's body, via simple brace matching.
//
// The body's opening brace is not simply "the next '{' after the parameter list": a return
// type annotation like `): { retries: number } {` has its own balanced `{...}` before the
// body starts, and naively taking the first '{' finds that instead of the real body.
function findUnknownConfigFunctions(source: string): UnknownConfigCandidate[] {
  const results: UnknownConfigCandidate[] = [];
  const paramPattern = /\(([a-zA-Z_$][\w$]*)\s*:\s*unknown\)/g;
  let match: RegExpExecArray | null;
  while ((match = paramPattern.exec(source)) !== null) {
    const param = match[1];
    const afterParams = match.index + match[0].length;
    // Skip an optional ": ReturnType" that may itself contain one balanced { ... } group,
    // then land on the function body's opening brace.
    const bodyStartMatch = /^\s*(?::\s*(?:\{[^{}]*\}|[^{])*)?\s*\{/.exec(source.slice(afterParams));
    if (!bodyStartMatch) continue;
    const braceStart = afterParams + bodyStartMatch[0].length - 1;
    let depth = 0;
    let end = -1;
    for (let i = braceStart; i < source.length; i += 1) {
      if (source[i] === '{') depth += 1;
      else if (source[i] === '}') {
        depth -= 1;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end === -1) continue;
    results.push({ param, body: source.slice(braceStart, end + 1) });
  }
  return results;
}

describe('config boundary: only loadConfig may unpack raw configuration', () => {
  const files = listOtherSourceFiles();
  const allCandidates = files.flatMap((file) => {
    const source = readFileSync(path.join(srcDir, file), 'utf8');
    return findUnknownConfigFunctions(source).map((candidate) => ({ file, ...candidate }));
  });

  it('the detector finds config-shaped parameters to check (a guard that never finds anything is not a guard)', () => {
    expect(allCandidates.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    it(`${file} does not import zod directly`, () => {
      const source = readFileSync(path.join(srcDir, file), 'utf8');
      expect(
        /from\s*['"]zod['"]/.test(source),
        `${file} imports 'zod' directly; only config-loader.ts may validate raw configuration`,
      ).toBe(false);
    });

    it(`${file} routes any raw-configuration unpacking through loadConfig`, () => {
      const source = readFileSync(path.join(srcDir, file), 'utf8');
      const candidates = findUnknownConfigFunctions(source);

      for (const { param, body } of candidates) {
        const callsLoadConfig = new RegExp(`loadConfig\\s*\\(\\s*${param}\\s*\\)`).test(body);
        const accessesDirectly = new RegExp(`\\b${param}\\s*\\.`).test(body);
        const castsToObjectShape = /\bas\s*\{/.test(body);
        const unpacksConfig = accessesDirectly || castsToObjectShape;

        if (unpacksConfig) {
          expect(
            callsLoadConfig,
            `${file}: parameter '${param}' is unpacked (direct access or 'as {...}' cast) without going through loadConfig()`,
          ).toBe(true);
        }
      }
    });
  }
});
