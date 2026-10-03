import { spawnSync } from "node:child_process";

const kits = [
  "adint",
  "fressnapf",
  "projects",
  "debrief",
];

let failed = false;
for (const kit of kits) {
  const result = spawnSync("npx", ["tsc", "-p", `kits/${kit}/tsconfig.json`, "--noEmit"], {
    stdio: "inherit",
  });
  if (result.status !== 0) failed = true;
}

process.exitCode = failed ? 1 : 0;
