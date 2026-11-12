export function noConsole(source: string): readonly string[] {
  return source.split('\n').filter((line) => line.includes('console.log('));
}
