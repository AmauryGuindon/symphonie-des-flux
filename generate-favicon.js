const sharp = require('sharp');
const toIco = require('to-ico');
const fs = require('fs');
const path = require('path');

const inputPath = path.join(__dirname, 'src/assets/logo/logo_dany1st.webp');
const size = 256;

const circleSvg = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg"><circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="white"/></svg>`
);

async function run() {
  // Circular PNG with transparent background
  const circularPng = await sharp(inputPath)
    .resize(size, size)
    .composite([{ input: circleSvg, blend: 'dest-in' }])
    .png()
    .toBuffer();

  // 32x32
  await sharp(circularPng).resize(32, 32).png()
    .toFile(path.join(__dirname, 'src/assets/logo/favicon-32.png'));
  console.log('favicon-32.png done');

  // 16x16
  await sharp(circularPng).resize(16, 16).png()
    .toFile(path.join(__dirname, 'src/assets/logo/favicon-16.png'));
  console.log('favicon-16.png done');

  // ICO (16+32+48) — overwrites both root and assets/logo
  const sizes = [16, 32, 48];
  const pngs = await Promise.all(
    sizes.map(s => sharp(circularPng).resize(s, s).png().toBuffer())
  );
  const ico = await toIco(pngs);
  fs.writeFileSync(path.join(__dirname, 'src/favicon.ico'), ico);
  fs.writeFileSync(path.join(__dirname, 'src/assets/logo/favicon.ico'), ico);
  console.log('favicon.ico done (root + assets/logo)');

  // SVG favicon (circle clip — modern browsers use this)
  const svgFavicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <defs>
    <clipPath id="c"><circle cx="16" cy="16" r="16"/></clipPath>
  </defs>
  <image href="assets/logo/logo_dany1st.webp" width="32" height="32" clip-path="url(#c)"/>
</svg>`;
  fs.writeFileSync(path.join(__dirname, 'src/assets/logo/favicon.svg'), svgFavicon);
  console.log('favicon.svg done');
}

run().catch(console.error);
