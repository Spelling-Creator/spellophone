import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(packageDir, "..", "..");

export const paths: {
  packageDir: string;
  repoRoot: string;
  espeakRoot: string;
  buildRoot: string;
  nativeDir: string;
  wasmDir: string;
  dataDir: string;
} = {
  packageDir,
  repoRoot,
  espeakRoot: join(repoRoot, "vendor", "espeak-ng"),
  buildRoot: join(repoRoot, "build"),
  nativeDir: join(packageDir, "native"),
  wasmDir: join(packageDir, "wasm"),
  dataDir: join(packageDir, "espeak-ng-data"),
};

export function run(command: string, args: string[]): void {
  console.log(`$ ${command} ${args.join(" ")}`);
  execFileSync(command, args, { stdio: "inherit" });
}
