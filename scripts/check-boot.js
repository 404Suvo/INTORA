import fs from 'node:fs';

const html = fs.readFileSync('public/landing-pages/kage.html', 'utf8');
const bootIdx = html.indexOf('14 · booting');
console.log(html.slice(bootIdx, bootIdx + 2000));
