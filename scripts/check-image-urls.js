import fs from 'node:fs';
import https from 'node:https';

const html = fs.readFileSync('public/landing-pages/kage.html', 'utf8');
const urls = [...new Set(html.match(/https:\/\/ublctyddhtbgaersvxxb\.supabase\.co\/[^\s\"')]+/g) || [])];

console.log('Total supabase URLs in kage.html:', urls.length);

async function checkUrl(u) {
  return new Promise((resolve) => {
    https.get(u, { method: 'HEAD' }, (res) => {
      resolve({ url: u.split('/').pop(), status: res.statusCode });
    }).on('error', (e) => {
      resolve({ url: u.split('/').pop(), error: e.message });
    });
  });
}

async function run() {
  for (const u of urls.slice(0, 10)) {
    const res = await checkUrl(u);
    console.log(res);
  }
}
run();
