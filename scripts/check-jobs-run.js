import fs from 'node:fs';

const html = fs.readFileSync('public/landing-pages/kage.html', 'utf8');
const bootIdx = html.indexOf('const JOBS = [');
console.log(html.slice(bootIdx + 1500, bootIdx + 3000));
