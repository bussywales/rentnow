import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import pngToIco from "png-to-ico";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, "..");
const publicDir = path.join(webRoot, "public");

const regularMaster = path.join(webRoot, "assets", "brand", "propatyhub-icon-master-2048.png");
const maskableMaster = path.join(
  webRoot,
  "assets",
  "brand",
  "propatyhub-icon-maskable-master-2048.png"
);

async function validateMaster(filePath, label) {
  let metadata;
  try {
    metadata = await sharp(filePath).metadata();
  } catch {
    throw new Error(`${label} is missing: ${filePath}`);
  }

  if (metadata.format !== "png") {
    throw new Error(`${label} must be PNG. Found ${metadata.format ?? "unknown"}`);
  }
  if (metadata.width !== 2048 || metadata.height !== 2048) {
    throw new Error(
      `${label} must be 2048x2048. Found ${metadata.width ?? "?"}x${metadata.height ?? "?"}`
    );
  }
}

async function writePng(source, outputName, size, options = {}) {
  const pipeline = sharp(source).resize(size, size, { fit: "cover" });
  if (options.whiteBackground) {
    pipeline.flatten({ background: "#ffffff" });
  }
  await pipeline
    .png({
      compressionLevel: 9,
      adaptiveFiltering: false,
      force: true,
    })
    .toFile(path.join(publicDir, outputName));
}

async function writeFaviconIco(source) {
  const sizes = [16, 32, 48];
  const pngBuffers = await Promise.all(
    sizes.map((size) =>
      sharp(source)
        .resize(size, size, { fit: "cover" })
        .flatten({ background: "#ffffff" })
        .png({
          compressionLevel: 9,
          adaptiveFiltering: false,
          force: true,
        })
        .toBuffer()
    )
  );
  const icoBuffer = await pngToIco(pngBuffers);
  await fs.writeFile(path.join(publicDir, "favicon.ico"), icoBuffer);
}

async function main() {
  await validateMaster(regularMaster, "Regular master");
  await validateMaster(maskableMaster, "Maskable master");

  await writePng(regularMaster, "favicon-16x16.png", 16);
  await writePng(regularMaster, "favicon-32x32.png", 32);
  await writePng(regularMaster, "apple-touch-icon.png", 180, { whiteBackground: true });
  await writePng(regularMaster, "icon-192.png", 192);
  await writePng(regularMaster, "icon-512.png", 512);
  await writePng(maskableMaster, "icon-192-maskable.png", 192);
  await writePng(maskableMaster, "icon-512-maskable.png", 512);
  await writeFaviconIco(regularMaster);

  const outputs = [
    "favicon-16x16.png",
    "favicon-32x32.png",
    "favicon.ico",
    "apple-touch-icon.png",
    "icon-192.png",
    "icon-512.png",
    "icon-192-maskable.png",
    "icon-512-maskable.png",
  ];

  for (const fileName of outputs) {
    const filePath = path.join(publicDir, fileName);
    const { size } = await fs.stat(filePath);
    console.log(`${fileName} (${size} bytes)`);
  }
}

main().catch((error) => {
  console.error(`Icon generation failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
