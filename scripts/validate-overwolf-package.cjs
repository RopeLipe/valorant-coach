const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const EXPECTED = {
  name: 'OWNED',
  author: 'OWNED Team',
  minimumOverwolfVersion: '0.257.0',
};

let failures = 0;
const fail = (message) => { failures += 1; console.error(`ERROR: ${message}`); };
const ok = (message) => console.log(`OK: ${message}`);

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (error) { fail(`${path.relative(ROOT, file)} is not valid JSON: ${error.message}`); return null; }
}

function exists(file) {
  if (!fs.existsSync(file)) { fail(`Missing ${path.relative(ROOT, file)}`); return false; }
  return true;
}

function validateManifest(file, label) {
  if (!exists(file)) return null;
  const manifest = readJson(file);
  if (!manifest) return null;
  const meta = manifest.meta || {};

  if (manifest.manifest_version !== 1) fail(`${label}: manifest_version must be 1`);
  if (manifest.type !== 'WebApp') fail(`${label}: type must be WebApp`);
  if (meta.name !== EXPECTED.name) fail(`${label}: meta.name must stay exactly "${EXPECTED.name}"`);
  if (meta.author !== EXPECTED.author) fail(`${label}: meta.author must stay exactly "${EXPECTED.author}"`);
  if (meta['minimum-overwolf-version'] !== EXPECTED.minimumOverwolfVersion) {
    fail(`${label}: minimum-overwolf-version must stay ${EXPECTED.minimumOverwolfVersion}`);
  }

  for (const key of ['uid', 'extension_id', 'extensionId', 'app_id', 'appId']) {
    if (Object.prototype.hasOwnProperty.call(manifest, key)) fail(`${label}: remove unsupported root field ${key}`);
    if (Object.prototype.hasOwnProperty.call(meta, key)) fail(`${label}: remove unsupported meta field ${key}`);
  }

  const data = manifest.data || {};
  if (data.start_window !== 'background') fail(`${label}: data.start_window should be background`);
  const windows = data.windows || {};
  for (const id of ['background', 'main', 'desktop', 'admin']) {
    if (!windows[id]?.file) fail(`${label}: missing data.windows.${id}.file`);
  }
  ok(`${label}: identity is ${meta.name} / ${meta.author}`);
  return manifest;
}

function validateDist(manifest) {
  if (!exists(DIST)) return;
  for (const asset of ['manifest.json', 'icon.png', 'icon_gray.png', 'desktop-icon.ico']) {
    exists(path.join(DIST, asset));
  }

  const windows = manifest?.data?.windows || {};
  for (const [id, win] of Object.entries(windows)) {
    if (win && win.file) exists(path.join(DIST, win.file));
  }

  for (const file of fs.readdirSync(DIST).filter((name) => name.endsWith('.html'))) {
    const htmlPath = path.join(DIST, file);
    const html = fs.readFileSync(htmlPath, 'utf8');
    const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((match) => match[1]);
    for (const ref of refs) {
      if (/^(https?:|data:|#)/.test(ref)) continue;
      const clean = ref.replace(/^\.\//, '').split(/[?#]/)[0];
      if (clean) exists(path.resolve(path.dirname(htmlPath), clean));
    }
  }

  const badOutput = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(ts|tsx|map)$/.test(entry.name) || entry.name === 'package.json') badOutput.push(path.relative(DIST, full));
    }
  };
  walk(DIST);
  if (badOutput.length) fail(`dist contains source/tooling files: ${badOutput.join(', ')}`);
  ok('dist is self-contained for Overwolf Load Unpacked');
}

const sourceManifest = validateManifest(path.join(ROOT, 'manifest.json'), 'source manifest');
const distManifest = validateManifest(path.join(DIST, 'manifest.json'), 'dist manifest');

if (sourceManifest && distManifest) {
  const srcMeta = JSON.stringify(sourceManifest.meta);
  const distMeta = JSON.stringify(distManifest.meta);
  if (srcMeta !== distMeta) fail('source manifest meta and dist manifest meta differ; rebuild before loading');
}

validateDist(distManifest);

if (failures) {
  console.error(`\nOverwolf package validation failed with ${failures} issue(s).`);
  process.exit(1);
}

console.log('\nOverwolf package validation passed. Load unpacked from ./dist only.');