import { spawnSync } from "node:child_process";

const requiredMajor = 20;
const requiredMinor = 9;

const version = process.versions?.node;
if (!version) {
  console.log(
    "[ci] Node version not detected. Skipping e2e tests (requires Node >=20.9.0)."
  );
  process.exit(0);
}

const [majorRaw, minorRaw] = version.split(".");
const major = Number(majorRaw);
const minor = Number(minorRaw);
const isValid =
  Number.isFinite(major) &&
  Number.isFinite(minor) &&
  (major > requiredMajor || (major === requiredMajor && minor >= requiredMinor));

if (!isValid) {
  console.log(
    `[ci] Node ${version} detected. Skipping e2e tests (requires Node >=${requiredMajor}.${requiredMinor}.0).`
  );
  process.exit(0);
}

const result = spawnSync("npm", ["run", "test:e2e"], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (result.error) {
  console.error(result.error);
}

process.exit(result.status ?? 1);
