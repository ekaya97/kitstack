export async function init(args: string[]) {
  const name = args[0];
  if (!name) {
    console.error("Usage: kitstack init <name>");
    process.exit(1);
  }
  console.log(`kitstack init is not implemented yet. (name: ${name})`);
  process.exit(1);
}
