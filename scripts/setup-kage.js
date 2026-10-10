import fs from 'fs';
import path from 'path';
import https from 'https';
import crypto from 'crypto';

const BUNDLE_PATH = 'C:/Users/jitsu/.gemini/antigravity/brain/728667d6-be99-489a-a67c-758939b338d1/.system_generated/steps/137/content.md';

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(fetchBuffer(res.headers.location));
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Failed to fetch ${url}: ${res.statusCode}`));
      }
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function main() {
  console.log('Reading bundle...');
  const raw = fs.readFileSync(BUNDLE_PATH, 'utf8');
  const jsonStart = raw.indexOf('{');
  const bundle = JSON.parse(raw.slice(jsonStart));

  // 1. Extract code files
  console.log('Writing source files from bundle...');
  for (const file of bundle.files) {
    if (file.code) {
      const targetPath = path.resolve(process.cwd(), file.path);
      ensureDir(targetPath);
      fs.writeFileSync(targetPath, file.code, 'utf8');
      const hash = crypto.createHash('sha256').update(file.code).digest('hex');
      console.log(`Saved ${file.path} [${hash.slice(0, 8)}]`);
    }
  }

  // 2. Fetch canonical assets
  const externalAssets = [
    {
      url: 'https://threeui.com/landing-pages/kage.html',
      dest: 'public/landing-pages/kage.html',
      expectedHash: 'c8e06b90397ac246baf0ab6f32f5f6b570acc6fe03c7009f711b579fb72d9f49'
    },
    {
      url: 'https://threeui.com/landing-pages/secret-pathways-assets/fonts.css',
      dest: 'public/landing-pages/secret-pathways-assets/fonts.css',
      expectedHash: '985f85a904a4096f92c06552b06f42a45973ac004af4780d68f18af65ddcc1b0'
    },
    {
      url: 'https://threeui.com/landing-pages/secret-pathways-assets/three.min.js',
      dest: 'public/landing-pages/secret-pathways-assets/three.min.js',
      expectedHash: '8a5f7249903b54d30f79f708699d2fed2d6a1d0741a4cd41377d1f01bb5a2271'
    }
  ];

  const binaryAssets = [
    { path: 'public/landing-pages/secret-pathways-assets/generated/kage-sanmon-preview.webp', hash: '23937f8c8350c55730c3bd17066a250548b2d29aad0e6ffb96218c1354b6db43' },
    { path: 'public/landing-pages/secret-pathways-assets/generated/kage-approach.webp', hash: '39ff338936097e1bde0c4eadcf09805b9890862703186e67314942de7e0bc36c' },
    { path: 'public/landing-pages/secret-pathways-assets/generated/kage-lantern-court.webp', hash: 'c0a6ff7da1cd6909d66e2f3f690b0d524a693e01d2222ab846d0074a90f47471' },
    { path: 'public/landing-pages/secret-pathways-assets/generated/kage-moonwater.webp', hash: 'b8c8060c51c87a103bae619b3a4cc8b8b80632649d83f1f2c2299051e7f9b400' },
    { path: 'public/landing-pages/secret-pathways-assets/foreground/png/temple-wall.webp', hash: '41c00f017e4ecf2147ee468d74da955bb4e2dad773f75a575022842eaf7609ce' },
    { path: 'public/landing-pages/secret-pathways-assets/foreground/png/pine-tree.webp', hash: '79b233716d067bbc64c1507f79e4a30ba5f445995158c78562cc5b81f607ede7' },
    { path: 'public/landing-pages/secret-pathways-assets/foreground/png/tall-grass.webp', hash: '8db0b5fbd160a7225391a6283a99681e346e205f24191031657285ef85ef12d2' },
    { path: 'public/landing-pages/secret-pathways-assets/foreground/png/sakura-branch.webp', hash: '48564194d40496090dbf3bba2a68785cf91fafb655dc8d43ac16f6678aff196d' },
    { path: 'public/landing-pages/secret-pathways-assets/foreground/png/maple-leaves.webp', hash: '35a90fec62c1a6bbfbbe73cd5d7b1acb889e80546d404182ef9a45fe417b531f' },
    { path: 'public/landing-pages/secret-pathways-assets/foreground/png/stone-lantern.webp', hash: 'd5f3c881bc9d92b72eaaff2b709614d66e21a19e14025d2b9b16a15ab52df3bc' },
    { path: 'public/landing-pages/secret-pathways-assets/foreground/png/garden-bush.webp', hash: '707e2516ebc0108041fe0ddc26d8bff0a69dc9700641f837765018b64e9ff15e' },
    { path: 'public/landing-pages/secret-pathways-assets/foreground/png/basalt-stones.webp', hash: '150f1c87e181d651c318168c271bb65c9c8abac6dea6f2421fdd081c5b740471' },
    { path: 'public/landing-pages/secret-pathways-assets/foreground/png/hill.webp', hash: 'ffba816244bcba98e4e33c6ee56165edfe4048db4af122ef3f5822180a85edbc' },
    { path: 'public/landing-pages/secret-pathways-assets/foreground/png/shrine-ruins.webp', hash: '77006e58f2066e6fa9bfc504df396db49b1c7977858fa52d34dd2dad5feced77' }
  ];

  for (const item of externalAssets) {
    console.log(`Downloading ${item.url}...`);
    const buf = await fetchBuffer(item.url);
    const destPath = path.resolve(process.cwd(), item.dest);
    ensureDir(destPath);
    fs.writeFileSync(destPath, buf);
    const hash = crypto.createHash('sha256').update(buf).digest('hex');
    console.log(`Saved ${item.dest} (${buf.length} bytes, sha256: ${hash}, match: ${hash === item.expectedHash})`);
  }

  for (const item of binaryAssets) {
    const url = `https://threeui.com/${item.path.replace(/^public\//, '')}`;
    console.log(`Downloading ${url}...`);
    const buf = await fetchBuffer(url);
    const destPath = path.resolve(process.cwd(), item.path);
    ensureDir(destPath);
    fs.writeFileSync(destPath, buf);
    const hash = crypto.createHash('sha256').update(buf).digest('hex');
    console.log(`Saved ${item.path} (${buf.length} bytes, sha256: ${hash}, match: ${hash === item.hash})`);
  }

  console.log('All downloads completed successfully!');
}

main().catch(console.error);
