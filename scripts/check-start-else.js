import fs from 'node:fs';

const html = fs.readFileSync('public/landing-pages/kage.html', 'utf8');
const bootIdx = html.indexOf('function start()');
console.log(html.slice(bootIdx + 400, bootIdx + 1500));
