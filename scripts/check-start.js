import fs from 'node:fs';

const html = fs.readFileSync('public/landing-pages/kage.html', 'utf8');
const bootIdx = html.indexOf('function boot()');
console.log(html.slice(bootIdx + 800, bootIdx + 2000));
