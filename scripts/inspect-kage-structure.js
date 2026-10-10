import fs from 'node:fs';

const html = fs.readFileSync('public/landing-pages/kage.html', 'utf8');

// Check head
const titleMatch = html.match(/<title>[\s\S]*?<\/title>/i);
console.log('Title:', titleMatch?.[0]);

// Check body elements
const sections = html.match(/<section[\s\S]*?<\/section>/gi) || [];
console.log('Section count:', sections.length);
sections.forEach((s, i) => {
  const idMatch = s.match(/id=[\"']([^\"']+)[\"']/);
  const classMatch = s.match(/class=[\"']([^\"']+)[\"']/);
  console.log(`Section ${i}: id=${idMatch?.[1]}, class=${classMatch?.[1]}`);
});

// Check canvases
const canvases = html.match(/<canvas[\s\S]*?<\/canvas>/gi) || [];
console.log('Canvas count:', canvases.length);
canvases.forEach((c, i) => {
  console.log('Canvas', i, c);
});
