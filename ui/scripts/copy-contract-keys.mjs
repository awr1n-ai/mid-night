#!/usr/bin/env node
// Copies the hello-world contract's compiled ZK assets (proving/verifying
// keys and zkir) from contracts/managed into ui/public/managed so the
// browser's FetchZkConfigProvider can fetch them over HTTP at proving time.
// See api/src/index.ts's CONTRACT_ASSETS_PATH, which must match the
// destination directory name used here ("managed/hello-world").
//
// Implemented in plain Node (fs.cpSync) rather than shell commands so it
// runs identically under cmd.exe, PowerShell, and POSIX shells.
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const uiDir = dirname(dirname(fileURLToPath(import.meta.url)));
const source = join(uiDir, "..", "contracts", "managed", "hello-world");
const destination = join(uiDir, "public", "managed", "hello-world");

if (!existsSync(source)) {
  console.error(
    `Compiled contract not found at ${source}. Run "yarn compile" at the ` +
      "repo root first (compact compile contracts/hello-world.compact " +
      "contracts/managed/hello-world).",
  );
  process.exit(1);
}

mkdirSync(destination, { recursive: true });
for (const asset of ["keys", "zkir"]) {
  cpSync(join(source, asset), join(destination, asset), { recursive: true });
}

console.log(`Copied contract keys/zkir to ${destination}`);
