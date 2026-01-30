const REQUIRED_MAJOR = 20;
const REQUIRED_MINOR = 9;

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
  (major > REQUIRED_MAJOR || (major === REQUIRED_MAJOR && minor >= REQUIRED_MINOR));

if (!isValid) {
  console.error(
    `Node ${version} detected. RentNow requires Node >=${REQUIRED_MAJOR}.${REQUIRED_MINOR}.0. ` +
      "Please upgrade your local Node version (e.g. `nvm use 20.19.6`)."
  );
  process.exit(1);
}
