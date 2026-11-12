// Static guard: no module other than config-loader.ts may unpack the application config
// itself. The only legitimate way to turn raw/unknown data into config data is to call
// loadConfig(), which runs it through the real zod schema. This module implements the check
// by reading the real TypeScript AST (via the `typescript` compiler API), not by
// hand-typed text matching, so it reacts to what the source actually says rather than to a
// guessed spelling of it.
//
// Defect it exists to catch: a source file, other than config-loader.ts, contains a type
// assertion (`expr as { ... }` or `<{ ... }>expr`) whose target object type shares a property
// name with the real config schema (extracted from config-loader.ts's own `z.object({...})`
// call), where the asserted expression is not itself a call to loadConfig(...). That shape is
// exactly "I received something and forced it into the config's shape without validating it",
// which is what queue-worker.ts and scheduler.ts do in this fixture.

import ts from 'typescript';

export interface Violation {
  file: string;
  message: string;
}

/**
 * Reads the real zod schema's top-level field names out of config-loader.ts's source, by
 * finding the `z.object({ ... })` call and listing its property names. This ties the guard to
 * the actual schema definition instead of a hand-typed guess of field names.
 */
export function extractConfigFieldNames(configLoaderSource: string): string[] {
  const sourceFile = ts.createSourceFile(
    'config-loader.ts',
    configLoaderSource,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const fields = new Set<string>();

  function visit(node: ts.Node): void {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'object' &&
      node.arguments.length > 0 &&
      ts.isObjectLiteralExpression(node.arguments[0])
    ) {
      for (const prop of node.arguments[0].properties) {
        if (ts.isPropertyAssignment(prop) || ts.isShorthandPropertyAssignment(prop)) {
          const name = prop.name;
          if (ts.isIdentifier(name) || ts.isStringLiteral(name)) {
            fields.add(name.text);
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return [...fields];
}

function typeLiteralPropertyNames(typeNode: ts.TypeNode): string[] {
  if (!ts.isTypeLiteralNode(typeNode)) return [];
  const names: string[] = [];
  for (const member of typeNode.members) {
    if (ts.isPropertySignature(member) && member.name) {
      if (ts.isIdentifier(member.name) || ts.isStringLiteral(member.name)) {
        names.push(member.name.text);
      }
    }
  }
  return names;
}

function isLoadConfigCall(expr: ts.Expression): boolean {
  return ts.isCallExpression(expr) && ts.isIdentifier(expr.expression) && expr.expression.text === 'loadConfig';
}

/**
 * Whole-file taint pass: an identifier is "tainted" when it names a function parameter typed
 * `unknown` or `any` (unvalidated external input, exactly loadConfig's own parameter shape), or
 * when it is declared as `const x = y` with `y` already tainted. This anchors the guard to the
 * actual defect ("code that received unvalidated external input casts it itself") instead of to
 * bare field-name spelling, so a field name that collides by coincidence in code that never
 * touched unvalidated input is not enough on its own to trip it.
 */
function collectTaintedIdentifiers(sourceFile: ts.SourceFile): Set<string> {
  const tainted = new Set<string>();

  function isUnvalidatedType(typeNode: ts.TypeNode | undefined): boolean {
    return !!typeNode && (typeNode.kind === ts.SyntaxKind.UnknownKeyword || typeNode.kind === ts.SyntaxKind.AnyKeyword);
  }

  function collectParams(node: ts.Node): void {
    if (
      ts.isFunctionDeclaration(node) ||
      ts.isFunctionExpression(node) ||
      ts.isArrowFunction(node) ||
      ts.isMethodDeclaration(node)
    ) {
      for (const param of node.parameters) {
        if (ts.isIdentifier(param.name) && isUnvalidatedType(param.type)) {
          tainted.add(param.name.text);
        }
      }
    }
    ts.forEachChild(node, collectParams);
  }
  collectParams(sourceFile);

  // Fixed point over simple `const x = y` aliasing so a param renamed once is still tracked.
  let changed = true;
  while (changed) {
    changed = false;
    function propagate(node: ts.Node): void {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
        let init = node.initializer;
        while (ts.isParenthesizedExpression(init)) init = init.expression;
        if (ts.isIdentifier(init) && tainted.has(init.text) && !tainted.has(node.name.text)) {
          tainted.add(node.name.text);
          changed = true;
        }
      }
      ts.forEachChild(node, propagate);
    }
    propagate(sourceFile);
  }

  return tainted;
}

/**
 * Scans one source file's text for the bypass defect described above. `fileName` is used only
 * for reporting; `configFields` is the real field-name set from extractConfigFieldNames.
 *
 * A violation requires both signals together: the asserted-from expression must trace back to
 * unvalidated external input (a parameter typed `unknown`/`any`, or a plain alias of one), and
 * the assertion's target type must name at least one of the real config schema's fields. Either
 * signal alone is either too broad (any `as` cast in the codebase) or too narrow (misses the
 * partial-field casts the real defect uses, since each of queue-worker.ts and scheduler.ts casts
 * only the one field it reads).
 */
export function findConfigBypasses(fileName: string, sourceText: string, configFields: ReadonlySet<string>): Violation[] {
  const violations: Violation[] = [];
  const sourceFile = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const tainted = collectTaintedIdentifiers(sourceFile);

  function visit(node: ts.Node): void {
    let assertedType: ts.TypeNode | undefined;
    let assertedExpr: ts.Expression | undefined;

    if (ts.isAsExpression(node)) {
      assertedType = node.type;
      assertedExpr = node.expression;
    } else if (ts.isTypeAssertionExpression(node)) {
      assertedType = node.type;
      assertedExpr = node.expression;
    }

    if (assertedType && assertedExpr) {
      const propNames = typeLiteralPropertyNames(assertedType);
      const overlap = propNames.filter((name) => configFields.has(name));
      const fromUnvalidatedInput = ts.isIdentifier(assertedExpr) && tainted.has(assertedExpr.text);
      if (overlap.length > 0 && fromUnvalidatedInput && !isLoadConfigCall(assertedExpr)) {
        violations.push({
          file: fileName,
          message:
            `asserts '${assertedExpr.getText(sourceFile)}' (unvalidated input) into a type carrying config ` +
            `field(s) [${overlap.join(', ')}] instead of calling loadConfig(...)`,
        });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return violations;
}
