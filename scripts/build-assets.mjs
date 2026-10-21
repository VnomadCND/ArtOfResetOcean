#!/usr/bin/env node
// Makes every web file an edition needs from its masters in source/:
//   source/editions/<id>/  ->  public/editions/<id>/
//     img/   <name>-2560.webp, <name>-1440.webp   stills (q88), plus clip frames used as stills
//     vid/   <name>.mp4 (H.264 1080, CRF 21, faststart), <name>.webm (VP9, CRF 34)
//     pack/  <clip>/000.webp ...  frames of scrubbed clips at 960 px
//     mask/  beach, thread and star masks, star map, starless sky
//     manifest.json  every file written, with its size
//   source/brand/monogram  ->  public/icons/ (192, 512, maskable 512, apple touch 180, favicon)
// Outputs newer than their master are skipped; --force rebuilds everything.
// Usage: node scripts/build-assets.mjs [editionId ...] [--force]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import {
  ROOT, FFMPEG, STILL_EXT, CLIP_EXT, editionIds, loadEdition, expectedAssets, findFile, probeClip, clipFrame, run, editionPaths,
} from './lib/edition.mjs';

sharp.cache(false);
sharp.concurrency(Math.max(1, Math.floor(os.cpus().length / 2)));

const argv = process.argv.slice(2);
const FORCE = argv.includes('--force');
const ids = argv.filter((a) => !a.startsWith('--'));

const STILL = { sizes: [2560, 1440], quality: 88 };
const VIDEO = { size: 1080, crf264: 21, crf9: 34 };
const PACK = { size: 960, quality: 80 };
const MASK = { size: 1024 };
const ICONS = [
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  { file: 'maskable-512.png', size: 512, pad: 0.1, bg: '#050f22' },
  { file: 'apple-touch-icon.png', size: 180, pad: 0.08, bg: '#050f22' },
  { file: 'favicon-32.png', size: 32 },
];

function rel(f) { return path.relative(ROOT, f).split(path.sep).join('/'); }
const warnings = [];
function warn(m) { warnings.push(m); console.log(`  WARN  ${m}`); }
let errors = 0;

for (const id of ids.length ? ids : editionIds()) await buildEdition(id);
await buildIcons();

console.log(`\n${errors ? `${errors} error(s)` : 'Done, no errors'}${warnings.length ? `, ${warnings.length} warning(s)` : ''}`);
process.exit(errors ? 1 : 0);

async function buildEdition(id) {
  console.log(`\n=== Building edition: ${id} ===`);
  const { edition, errors: schemaErrors, paths } = loadEdition(id);
  if (schemaErrors.length) {
    schemaErrors.forEach((e) => console.log(`  ERROR schema: ${e}`));
    errors += schemaErrors.length;
    return;
  }
  const out = paths.out;
  for (const d of ['img', 'vid', 'pack', 'mask']) fs.mkdirSync(path.join(out, d), { recursive: true });
  const expected = expectedAssets(edition);
  const written = [];
  const note = (f) => written.push(f);

  // ---------- stills ----------
  console.log('\nStills');
  const stills = expected.filter((a) => a.kind === 'cover' || a.kind === 'art');
  await pool(stills, 3, async (a) => {
    const src = findFile(path.join(paths.src, a.dir), a.name, STILL_EXT);
    if (!src) { console.log(`  ERROR missing master for ${a.name}`); errors++; return; }
    for (const size of STILL.sizes) {
      const dst = path.join(out, 'img', `${a.name}-${size}.webp`);
      if (fresh(dst, src)) { note(dst); continue; }
      await sharp(src, { limitInputPixels: false })
        .toColourspace('srgb').resize(size, size, { fit: 'cover', kernel: 'lanczos3', withoutEnlargement: true })
        .webp({ quality: STILL.quality, effort: 5, smartSubsample: true }).toFile(dst);
      note(dst);
      console.log(`  ${rel(dst)}`);
    }
  });

  // ---------- clips ----------
  console.log('\nClips');
  const clips = expected.filter((a) => a.kind === 'clip');
  const clipSrc = new Map();
  for (const a of clips) {
    const src = findFile(path.join(paths.src, a.dir), a.name, CLIP_EXT);
    if (src) clipSrc.set(a.name, src); else warn(`${a.name} has no master yet; the page crossfades`);
  }
  // VP9 is slow and single-file-bound, so run a few at once.
  const jobs = [];
  for (const [name, src] of clipSrc) {
    jobs.push({ src, dst: path.join(out, 'vid', `${name}.mp4`), args: ['-c:v', 'libx264', '-preset', 'slow', '-crf', String(VIDEO.crf264), '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-movflags', '+faststart'] });
    jobs.push({ src, dst: path.join(out, 'vid', `${name}.webm`), args: ['-c:v', 'libvpx-vp9', '-crf', String(VIDEO.crf9), '-b:v', '0', '-deadline', 'good', '-cpu-used', '2', '-row-mt', '1', '-pix_fmt', 'yuv420p'] });
  }
  await pool(jobs, Math.max(2, Math.floor(os.cpus().length / 4)), async (j) => {
    if (!fresh(j.dst, j.src)) {
      const tmp = j.dst.replace(/(\.\w+)$/, '.part$1');
      await run(FFMPEG, ['-v', 'error', '-y', '-i', j.src, '-an', '-vf', `scale=${VIDEO.size}:${VIDEO.size}:flags=lanczos`, ...j.args, tmp]);
      fs.renameSync(tmp, j.dst);
      console.log(`  ${rel(j.dst)}`);
    }
    note(j.dst);
  });

  // ---------- clip frames used as stills (a turn's start, the closing page) ----------
  const frameRefs = [...edition.pages.map((p) => p.turnInFrom), edition.closing.artFrom].filter(Boolean);
  for (const ref of frameRefs) {
    const src = clipSrc.get(ref.clip);
    if (!src) { warn(`${ref.clip} is missing, so its ${ref.frame} frame cannot be made; the page falls back to its art`); continue; }
    const png = await clipFrame(src, ref.frame === 'first' ? 0 : -1);
    for (const size of STILL.sizes) {
      const dst = path.join(out, 'img', `${ref.clip}-${ref.frame}-${size}.webp`);
      if (!fresh(dst, src)) {
        await sharp(png).resize(size, size, { kernel: 'lanczos3', withoutEnlargement: true }).webp({ quality: STILL.quality, effort: 5 }).toFile(dst);
        console.log(`  ${rel(dst)}`);
      }
      note(dst);
    }
  }

  // ---------- frame packs for scrubbed clips ----------
  console.log('\nFrame packs');
  for (const pg of edition.pages.filter((p) => p.fxClip && p.fxFrames)) {
    const src = clipSrc.get(pg.fxClip);
    if (!src) continue;
    const dir = path.join(out, 'pack', pg.fxClip);
    const index = path.join(dir, 'index.json');
    if (fresh(index, src) && readJSON(index)?.frames === pg.fxFrames) {
      for (let i = 0; i < pg.fxFrames; i++) note(path.join(dir, `${pad3(i)}.webp`));
      note(index);
      continue;
    }
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    const info = await probeClip(src);
    const raw = await run(FFMPEG, ['-v', 'error', '-i', src, '-vf', `scale=${PACK.size}:${PACK.size}:flags=lanczos`, '-pix_fmt', 'rgb24', '-f', 'rawvideo', 'pipe:1']);
    const fsz = PACK.size * PACK.size * 3, total = Math.floor(raw.length / fsz);
    if (total < pg.fxFrames) warn(`${pg.fxClip} has ${total} frames, fewer than the ${pg.fxFrames} asked for; some repeat`);
    // Evenly spaced through the whole clip, first and last frames included.
    const picks = Array.from({ length: pg.fxFrames }, (_, i) => Math.round((i * (total - 1)) / (pg.fxFrames - 1)));
    await pool(picks.map((f, i) => ({ f, i })), 6, async ({ f, i }) => {
      const dst = path.join(dir, `${pad3(i)}.webp`);
      await sharp(raw.subarray(f * fsz, (f + 1) * fsz), { raw: { width: PACK.size, height: PACK.size, channels: 3 } })
        .webp({ quality: PACK.quality, effort: 5 }).toFile(dst);
      note(dst);
    });
    if (picks.some((_, i) => !fs.existsSync(path.join(dir, `${pad3(i)}.webp`)))) { errors++; console.log(`  ERROR ${pg.fxClip} pack is incomplete`); continue; }
    fs.writeFileSync(index, JSON.stringify({ clip: pg.fxClip, frames: pg.fxFrames, size: PACK.size, fps: info.fps, sourceFrames: picks, pattern: '{000}.webp' }, null, 2));
    note(index);
    console.log(`  ${rel(dir)}/ ${pg.fxFrames} frames`);
  }

  // ---------- masks ----------
  console.log('\nMasks');
  for (const pg of edition.pages.filter((p) => p.masks)) {
    const src = findFile(path.join(paths.src, 'art'), pg.art, STILL_EXT);
    if (!src) continue;
    if (pg.masks.stars) (await starMaps(src, pg.art, pg.masks.stars, out)).forEach(note);
    if (pg.masks.beach) note(await beachMask(src, pg.art, pg.masks.beach, out));
    if (pg.masks.threads) note(await threadMask(src, pg.art, pg.masks.threads, out));
  }

  // ---------- manifest ----------
  const files = [...new Set(written)].sort().map((f) => ({ path: path.relative(out, f).split(path.sep).join('/'), bytes: fs.statSync(f).size }));
  const total = files.reduce((s, f) => s + f.bytes, 0);
  fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify({ edition: id, generated: new Date().toISOString(), totalBytes: total, files }, null, 2));
  // Anything left over from an earlier build that this one did not make
  const keep = new Set(files.map((f) => f.path).concat('manifest.json'));
  for (const f of walk(out)) {
    const r = path.relative(out, f).split(path.sep).join('/');
    if (!keep.has(r)) { fs.rmSync(f); console.log(`  removed stale ${r}`); }
  }
  const byDir = {};
  for (const f of files) { const d = f.path.split('/')[0]; byDir[d] = (byDir[d] || 0) + f.bytes; }
  console.log(`\n${rel(out)}: ${files.length} files, ${mb(total)} (${Object.entries(byDir).map(([d, b]) => `${d} ${mb(b)}`).join(', ')})`);
}

// ---------- masks: derived from the art, tuned in edition.json ----------

/** Stars: small points brighter and warmer than their surroundings, above maxY. */
async function starMaps(src, name, { maxY }, out) {
  const N = 2560;
  const dsts = [path.join(out, 'mask', `${name}-stars.json`), path.join(out, 'mask', `${name}-stars.png`), ...STILL.sizes.map((s) => path.join(out, 'img', `${name}-starless-${s}.webp`))];
  if (dsts.every((d) => fresh(d, src))) return dsts;
  const rgb = await sharp(src, { limitInputPixels: false }).toColourspace('srgb').resize(N, N, { kernel: 'lanczos3' }).removeAlpha().raw().toBuffer();
  const lum = new Float32Array(N * N), warm = new Float32Array(N * N);
  for (let i = 0; i < N * N; i++) {
    const r = rgb[i * 3], g = rgb[i * 3 + 1], b = rgb[i * 3 + 2];
    lum[i] = r * 0.299 + g * 0.587 + b * 0.114; warm[i] = r - b;
  }
  const bg = boxBlur(lum, N, 12);
  const yMax = Math.round(maxY * N);
  const hit = new Uint8Array(N * N);
  for (let y = 0; y < yMax; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x;
    if (lum[i] - bg[i] > 28 && warm[i] > 10) hit[i] = 1;
  }
  // Connected points; anything big (the moon, a gold edge) is not a star.
  const stars = [];
  const seen = new Uint8Array(N * N), stack = [];
  for (let i = 0; i < N * N; i++) {
    if (!hit[i] || seen[i]) continue;
    let n = 0, sx = 0, sy = 0, sw = 0, cr = 0, cg = 0, cb = 0, x0 = N, x1 = 0, y0 = N, y1 = 0;
    stack.push(i); seen[i] = 1;
    while (stack.length) {
      const k = stack.pop(), x = k % N, y = (k - x) / N, w = lum[k] - bg[k];
      n++; sx += x * w; sy += y * w; sw += w; cr += rgb[k * 3]; cg += rgb[k * 3 + 1]; cb += rgb[k * 3 + 2];
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      for (const d of [-1, 1, -N, N]) { const j = k + d; if (j >= 0 && j < N * N && hit[j] && !seen[j] && Math.abs((j % N) - x) <= 1) { seen[j] = 1; stack.push(j); } }
    }
    const span = Math.max(x1 - x0, y1 - y0) + 1;
    if (n < 3 || span > 28 || n > 400) continue;
    stars.push({ x: +(sx / sw / N).toFixed(5), y: +(sy / sw / N).toFixed(5), r: +((span / 2) / N).toFixed(5), color: [cr, cg, cb].map((c) => Math.round(c / n)) });
  }
  fs.writeFileSync(dsts[0], JSON.stringify({ art: name, size: N, count: stars.length, stars }, null, 0));
  // Star mask (dilated) and the sky with the stars painted out from their surroundings.
  const mask = new Float32Array(N * N);
  for (const s of stars) {
    const cx = s.x * N, cy = s.y * N, rr = s.r * N + 4;
    for (let y = Math.floor(cy - rr); y <= cy + rr; y++) for (let x = Math.floor(cx - rr); x <= cx + rr; x++) {
      if (x < 0 || y < 0 || x >= N || y >= N) continue;
      const d = Math.hypot(x - cx, y - cy);
      if (d <= rr) mask[y * N + x] = Math.max(mask[y * N + x], d < rr - 2 ? 1 : (rr - d) / 2);
    }
  }
  await sharp(Buffer.from(mask.map((v) => Math.round(v * 255))), { raw: { width: N, height: N, channels: 1 } })
    .resize(MASK.size, MASK.size).png().toFile(dsts[1]);
  const fill = Buffer.from(rgb);
  for (let c = 0; c < 3; c++) {
    // normalised blur of the unmasked pixels fills each star from its own sky
    const v = new Float32Array(N * N), w = new Float32Array(N * N);
    for (let i = 0; i < N * N; i++) { const k = 1 - mask[i]; v[i] = rgb[i * 3 + c] * k; w[i] = k; }
    const bv = boxBlur(boxBlur(v, N, 8), N, 8), bw = boxBlur(boxBlur(w, N, 8), N, 8);
    for (let i = 0; i < N * N; i++) if (mask[i] > 0) {
      const f = bw[i] > 1e-3 ? bv[i] / bw[i] : rgb[i * 3 + c];
      fill[i * 3 + c] = Math.round(rgb[i * 3 + c] * (1 - mask[i]) + f * mask[i]);
    }
  }
  for (const [k, s] of STILL.sizes.entries()) {
    await sharp(fill, { raw: { width: N, height: N, channels: 3 } }).resize(s, s, { kernel: 'lanczos3' }).webp({ quality: STILL.quality, effort: 5 }).toFile(dsts[2 + k]);
  }
  console.log(`  ${rel(dsts[0])} (${stars.length} stars), starless sky`);
  return dsts;
}

/** Beach: everything below the horizon that is not water (water is bluer than it is red). */
async function beachMask(src, name, { minY }, out) {
  const dst = path.join(out, 'mask', `${name}-beach.png`);
  if (fresh(dst, src)) return dst;
  const N = MASK.size;
  const rgb = await sharp(src, { limitInputPixels: false }).toColourspace('srgb').resize(N, N).removeAlpha().raw().toBuffer();
  const m = new Float32Array(N * N);
  const y0 = Math.round(minY * N);
  for (let y = y0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x, r = rgb[i * 3], b = rgb[i * 3 + 2];
    m[i] = r - b > -8 ? 1 : 0;
  }
  await writeSoftMask(majority(m, N, 6), N, dst, 3);
  console.log(`  ${rel(dst)}`);
  return dst;
}

/** Threads: the gold lines (warm and bright) below minY, widened into a soft region for the warp. */
async function threadMask(src, name, { minY }, out) {
  const dst = path.join(out, 'mask', `${name}-threads.png`);
  if (fresh(dst, src)) return dst;
  const N = 2048;
  const rgb = await sharp(src, { limitInputPixels: false }).toColourspace('srgb').resize(N, N).removeAlpha().raw().toBuffer();
  const m = new Float32Array(N * N);
  const y0 = Math.round(minY * N);
  for (let y = y0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x, r = rgb[i * 3], g = rgb[i * 3 + 1], b = rgb[i * 3 + 2];
    const lum = r * 0.299 + g * 0.587 + b * 0.114;
    m[i] = r - b > 30 && lum > 70 ? 1 : 0;
  }
  const wide = boxBlur(boxBlur(m, N, 6), N, 6);
  for (let i = 0; i < N * N; i++) wide[i] = Math.min(1, wide[i] * 6);
  await writeSoftMask(wide, N, dst, 0, MASK.size);
  console.log(`  ${rel(dst)}`);
  return dst;
}

async function writeSoftMask(m, N, dst, blur, size = N) {
  const soft = blur ? boxBlur(m, N, blur) : m;
  await sharp(Buffer.from(soft.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255))), { raw: { width: N, height: N, channels: 1 } })
    .resize(size, size).png({ compressionLevel: 9 }).toFile(dst);
}

/** Smooth a 0/1 mask: keep a pixel when most of its neighbourhood agrees (drops speckle and holes). */
function majority(m, N, r) {
  const b = boxBlur(m, N, r);
  return b.map((v) => (v > 0.5 ? 1 : 0));
}

/** Separable box blur of a single-channel float image, radius r. */
function boxBlur(src, N, r) {
  const tmp = new Float32Array(N * N), dst = new Float32Array(N * N), w = 2 * r + 1;
  for (let y = 0; y < N; y++) {
    let s = 0; const o = y * N;
    for (let x = -r; x <= r; x++) s += src[o + Math.min(N - 1, Math.max(0, x))];
    for (let x = 0; x < N; x++) {
      tmp[o + x] = s / w;
      s += src[o + Math.min(N - 1, x + r + 1)] - src[o + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < N; x++) {
    let s = 0;
    for (let y = -r; y <= r; y++) s += tmp[Math.min(N - 1, Math.max(0, y)) * N + x];
    for (let y = 0; y < N; y++) {
      dst[y * N + x] = s / w;
      s += tmp[Math.min(N - 1, y + r + 1) * N + x] - tmp[Math.max(0, y - r) * N + x];
    }
  }
  return dst;
}

// ---------- app icons ----------
async function buildIcons() {
  console.log('\nIcons');
  const p = editionPaths('');
  const src = findFile(p.brand, 'monogram', ['.svg', '.png']);
  if (!src) { warn('source/brand/monogram.svg (or .png) is missing: app icons not made'); return; }
  fs.mkdirSync(p.icons, { recursive: true });
  for (const ic of ICONS) {
    const dst = path.join(p.icons, ic.file);
    if (fresh(dst, src)) continue;
    const inner = Math.round(ic.size * (1 - 2 * (ic.pad || 0)));
    const mark = await sharp(src, { density: 600 }).resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    await sharp({ create: { width: ic.size, height: ic.size, channels: 4, background: ic.bg || { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: mark, gravity: 'center' }]).png().toFile(dst);
    console.log(`  ${rel(dst)}`);
  }
}

// ---------- helpers ----------
function fresh(dst, src) {
  if (FORCE || !fs.existsSync(dst)) return false;
  return fs.statSync(dst).mtimeMs >= fs.statSync(src).mtimeMs;
}

async function pool(items, n, fn) {
  let i = 0;
  const worker = async () => {
    while (i < items.length) {
      const item = items[i++];
      try { await fn(item); } catch (e) { errors++; console.log(`  ERROR ${e.message}`); }
    }
  };
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
}

function* walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(f); else yield f;
  }
}

function readJSON(f) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } }
function pad3(i) { return String(i).padStart(3, '0'); }
function mb(b) { return `${(b / 1048576).toFixed(1)} MB`; }
