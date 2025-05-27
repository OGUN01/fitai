const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Convert SVG to PNG
async function convertSvgToPng() {
  const svgBuffer = fs.readFileSync(path.join(__dirname, '../assets/images/check.svg'));
  
  await sharp(svgBuffer)
    .resize(200, 200)
    .png()
    .toFile(path.join(__dirname, '../assets/images/check.png'));
    
  console.log('Successfully converted check.svg to check.png');
}

convertSvgToPng().catch(console.error); 