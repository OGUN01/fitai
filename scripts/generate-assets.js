const fs = require('fs');
const { createCanvas } = require('canvas');

// Create a function to generate a simple image
function generateImage(width, height, backgroundColor, text, outputPath) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Fill background
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, width, height);

  // Add text
  ctx.fillStyle = '#000000';
  ctx.font = 'bold 48px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, width / 2, height / 2);

  // Save the image
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(outputPath, buffer);
}

// Generate all required assets
const assets = [
  { name: 'icon.png', width: 1024, height: 1024, text: 'F' },
  { name: 'splash.png', width: 2048, height: 2048, text: 'Fitness' },
  { name: 'adaptive-icon.png', width: 1024, height: 1024, text: 'F' },
  { name: 'favicon.png', width: 32, height: 32, text: 'F' }
];

assets.forEach(asset => {
  const outputPath = `./assets/${asset.name}`;
  generateImage(asset.width, asset.height, '#ffffff', asset.text, outputPath);
  console.log(`Generated ${asset.name}`);
}); 