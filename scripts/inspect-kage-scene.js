import fs from 'node:fs';

const html = fs.readFileSync('public/landing-pages/kage.html', 'utf8');
const scripts = html.match(/<script>[\s\S]*?<\/script>/gi) || [];
const s2 = scripts[1] || '';

// Let's check the section comments in script 2
const comments = s2.match(/\/\* [^\*]+\*\//g) || [];
console.log('Section markers in Script 2:');
comments.slice(0, 30).forEach(c => console.log(c.replace(/\n/g, ' ')));
