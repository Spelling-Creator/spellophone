// Fetches the espeak-ng sources pinned in vendor/espeak-ng.json into
// vendor/espeak-ng and applies the patches in vendor/patches. Safe to run
// repeatedly: an existing checkout at the pinned tag is left alone (patches
// already applied are skipped), and one at a different tag is replaced.
//
//   pnpm fetch:espeak

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const vendorDir = join(root, "vendor");
const target = join(vendorDir, "espeak-ng");

interface Pin {
  repository: string;
  tag: string;
}

const pin: Pin = JSON.parse(
  readFileSync(join(vendorDir, "espeak-ng.json"), "utf8"),
);

function currentTag(): string | null {
  try {
    return execFileSync(
      "git",
      ["-C", target, "describe", "--tags", "--exact-match"],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      },
    ).trim();
  } catch {
    return null;
  }
}

function gitApplies(args: string[]): boolean {
  try {
    execFileSync("git", ["-C", target, "apply", ...args], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Applies vendor/patches/*.patch in name order. A patch that is already in
 * the tree (it reverses cleanly) is skipped, so this is idempotent.
 */
function applyPatches(): void {
  const patchDir = join(vendorDir, "patches");
  if (!existsSync(patchDir)) return;
  const patches = readdirSync(patchDir)
    .filter((name) => name.endsWith(".patch"))
    .toSorted();
  for (const name of patches) {
    const file = join(patchDir, name);
    if (gitApplies(["--reverse", "--check", file])) {
      console.log(`patch ${name} already applied`);
      continue;
    }
    console.log(`applying ${name}`);
    execFileSync("git", ["-C", target, "apply", "--verbose", file], {
      stdio: "inherit",
    });
  }
}

if (existsSync(target)) {
  const tag = currentTag();
  if (tag === pin.tag) {
    console.log(`espeak-ng ${pin.tag} already present in vendor/espeak-ng`);
    applyPatches();
    process.exit(0);
  }
  console.log(
    `vendor/espeak-ng is at ${tag ?? "an unknown revision"}, replacing it with ${pin.tag}`,
  );
  rmSync(target, { recursive: true, force: true });
}

console.log(`Cloning espeak-ng ${pin.tag} from ${pin.repository}`);
execFileSync(
  "git",
  ["clone", "--depth", "1", "--branch", pin.tag, pin.repository, target],
  { stdio: "inherit" },
);
applyPatches();
