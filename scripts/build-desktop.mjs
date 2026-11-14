// Bundles the Electron main process (with the SlideCraft server) and stages a minimal app dir for electron-builder.
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, 'desktop-app');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'dist-electron'), { recursive: true });

// optional native/cloud deps of mongodb that are loaded lazily inside try/catch
const optional = ['kerberos', '@mongodb-js/zstd', '@aws-sdk/credential-providers', 'gcp-metadata', 'snappy', 'socks', 'aws4', 'mongodb-client-encryption', 'bson-ext'];
await build({
  entryPoints: [path.join(root, 'electron/main.ts')],
  outfile: path.join(out, 'dist-electron/main.mjs'),
  bundle: true, platform: 'node', format: 'esm', target: 'node20', sourcemap: false, minify: true,
  external: ['electron', ...optional],
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
  logLevel: 'warning',
});
await build({
  entryPoints: [path.join(root, 'electron/preload.cts')],
  outfile: path.join(out, 'dist-electron/preload.cjs'),
  bundle: true, platform: 'node', format: 'cjs', target: 'node20', external: ['electron'], logLevel: 'warning',
});
fs.cpSync(path.join(root, 'dist'), path.join(out, 'dist'), { recursive: true });
fs.copyFileSync(path.join(root, 'build/icon.png'), path.join(out, 'dist-electron/icon.png'));
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
fs.writeFileSync(path.join(out, 'package.json'), JSON.stringify({
  name: 'slidecraft-ai-studio', productName: 'SlideCraft AI Studio', version: pkg.version, description: 'SlideCraft AI Studio — desktop',
  author: 'SlideCraft', main: 'dist-electron/main.mjs', type: 'module', license: 'UNLICENSED',
}, null, 2));
console.log('desktop app staged in', out);
