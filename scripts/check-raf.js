import fs from 'node:fs';

const html = fs.readFileSync('public/landing-pages/kage.html', 'utf8');
const scripts = html.match(/<script>[\s\S]*?<\/script>/gi) || [];
const s2 = scripts[1] || '';

// Let's find where requestAnimationFrame is called
const rafMatches = [];
let idx = 0;
while ((idx = s2.indexOf('requestAnimationFrame', idx)) !== -1) {
  rafMatches.push(s2.slice(Math.max(0, idx - 100), Math.min(s2.length, idx + 200)));
  idx += 21;
}

console.log('Total requestAnimationFrame calls:', rafMatches.length);
rafMatches.forEach((m, i) => console.log(`--- RAF ${i} ---\n`, m));
