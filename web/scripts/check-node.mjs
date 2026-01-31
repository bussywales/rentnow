const requiredMajor = 20;
const requiredMinor = 9;

const version = process.versions?.node;
if (!version) {
  console.error("Node.js version not detected. Please use Node >=20.9.0.");
  process.exit(1);
}

const [majorRaw, minorRaw] = version.split(".");
const major = Number(majorRaw);
const minor = Number(minorRaw);

const isValid =
  Number.isFinite(major) &&
  Number.isFinite(minor) &&
  (major > requiredMajor ||
    (major === requiredMajor && minor >= requiredMinor));

if (!isValid) {
  console.error(
    `Node ${version} detected. PropatyHub requires Node >=${requiredMajor}.${requiredMinor}.0. ` +
      "Please upgrade your local Node version (e.g. `nvm use 20.9.0`)."
  );
  process.exit(1);
}
