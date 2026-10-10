import fs from 'node:fs';

const html = fs.readFileSync('public/landing-pages/kage.html', 'utf8');
const script0 = html.match(/<script>[\s\S]*?<\/script>/i)?.[0];
console.log(script0?.slice(0, 1000));
