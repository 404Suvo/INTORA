import fs from 'node:fs';

const html = fs.readFileSync('public/landing-pages/kage.html', 'utf8');
const webpMatches = html.match(/[a-zA-Z0-9_\-\.\/]+\.webp/g) || [];
console.log('Webp matches:', [...new Set(webpMatches)]);

const imgMatches = html.match(/src=[\"'][^\"']+[\"']/g) || [];
console.log('src matches:', imgMatches);
