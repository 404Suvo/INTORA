import fs from 'node:fs';

const html = fs.readFileSync('public/landing-pages/kage.html', 'utf8');
const scripts = html.match(/<script>[\s\S]*?<\/script>/gi) || [];
const s2 = scripts[1] || ''; // the main script
console.log('Script 2 length:', s2.length);
console.log('Script 2 start:', s2.slice(0, 500));

// Check requestAnimationFrame or animate or render loop
const hasRaf = s2.includes('requestAnimationFrame');
console.log('has requestAnimationFrame:', hasRaf);

// Check canvas or WebGLRenderer
const hasWebGL = s2.includes('WebGLRenderer');
console.log('has WebGLRenderer:', hasWebGL);

// Look for image loading in script 2
const imgMatches = s2.match(/[\'\"\/][a-zA-Z0-9_\-\.\/]+\.webp/g) || [];
console.log('Webp in Script 2:', [...new Set(imgMatches)]);
