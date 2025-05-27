const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

// Create a canvas with the pattern
function generatePatternOverlay() {
  const width = 400;
  const height = 400;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Set background to transparent
  ctx.fillStyle = 'rgba(0, 0, 0, 0)';
  ctx.fillRect(0, 0, width, height);

  // Draw dots
  ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
  const dotSpacing = 20;
  const dotSize = 1;

  for (let x = 0; x < width; x += dotSpacing) {
    for (let y = 0; y < height; y += dotSpacing) {
      ctx.beginPath();
      ctx.arc(x, y, dotSize, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Draw some random lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.lineWidth = 0.5;

  for (let i = 0; i < 20; i++) {
    const x1 = Math.random() * width;
    const y1 = Math.random() * height;
    const x2 = Math.random() * width;
    const y2 = Math.random() * height;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  // Draw some circles
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
  for (let i = 0; i < 10; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const radius = 30 + Math.random() * 120;

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Save the pattern
  const buffer = canvas.toBuffer('image/png');
  const outputPath = path.join(__dirname, '../assets/images/pattern-overlay.png');
  fs.writeFileSync(outputPath, buffer);
  console.log('Generated pattern-overlay.png');
}

generatePatternOverlay(); 