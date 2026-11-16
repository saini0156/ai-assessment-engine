import sharp from "sharp";
import { readdirSync } from "node:fs";
import { join, parse } from "node:path";

const dir = "public/images";

// Max width per image: FAQ card images are small, backgrounds are full width
const maxWidthFor = (name) => (/^img\d/i.test(name) ? 900 : 1920);

for (const file of readdirSync(dir)) {
  const { name, ext } = parse(file);
  if (!/\.(jpe?g|png)$/i.test(ext)) continue;
  if (/^logo/i.test(name)) continue; // keep logos as they are

  await sharp(join(dir, file))
    .resize({ width: maxWidthFor(name), withoutEnlargement: true })
    .webp({ quality: 75 })
    .toFile(join(dir, `${name}.webp`));

  console.log(`${file} -> ${name}.webp`);
}