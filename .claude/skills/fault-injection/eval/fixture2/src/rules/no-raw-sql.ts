/** A rule module. Each exported rule returns the offending lines of a source file. */
export function noRawSql(source: string): readonly string[] {
  return source
    .split('\n')
    .filter((line) => /\bINSERT\s+INTO\b/i.test(line) || /\bUPDATE\s+\w+\s+SET\b/i.test(line));
}
