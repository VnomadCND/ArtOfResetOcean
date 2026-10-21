#!/usr/bin/env node
// Checks an edition's masters in source/ before build-assets runs:
//   edition.json against the schema, missing and misnamed files, sizes against the spec,
//   and how far each clip's first and last frames drift from the stills they must match.
// Usage: node scripts/check-assets.mjs [editionId ...] [--json report.json]
// Exit code 1 when there are errors (schema, missing required masters, unreadable files).
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import {
  ROOT, SPEC, STILL_EXT, CLIP_EXT, FFMPEG, run, editionIds, loadEdition, expectedAssets, findFile, probeClip, clipFrame,
} from './lib/edition.mjs';

sharp.cache(false);

const argv = process.argv.slice(2);
const jsonOut = argv.includes('--json') ? argv[argv.indexOf('--json') + 1] : null;
const ids = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--json');

// Drift thresholds: mean absolute difference per channel (0-255) at 384 px.
// A still against its own clean H.264 encode measures about 1 to 2; a visible jump starts near 6.
const DRIFT = { ok: 4, warn: 8 };
const HOLD = 3;       // last frame vs 0.5 s earlier: above this the clip is still moving when it ends
const CMP = 384;      // compare size
const ALIGN = 192;    // alignment search size

const report = { editions: {} };
let errorCount = 0;

const rel = (f) => path.relative(ROOT, f).split(path.sep).join('/');
const C = process.stdout.isTTY ? { r: '\x1b[31m', y: '\x1b[33m', g: '\x1b[32m', d: '\x1b[2m', x: '\x1b[0m' } : { r: '', y: '', g: '', d: '', x: '' };

for (const id of ids.length ? ids : editionIds()) await checkEdition(id);

if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(report, null, 2));
console.log(`\n${errorCount ? `${C.r}${errorCount} error(s)${C.x}` : `${C.g}No errors${C.x}`}`);
process.exit(errorCount ? 1 : 0);

async function checkEdition(id) {
  const R = { schema: [], missing: [], misnamed: [], unexpected: [], sizes: [], drift: [], errors: [], warnings: [] };
  report.editions[id] = R;
  const err = (m) => { R.errors.push(m); errorCount++; console.log(`  ${C.r}ERROR${C.x} ${m}`); };
  const warn = (m) => { R.warnings.push(m); console.log(`  ${C.y}WARN${C.x}  ${m}`); };
  const ok = (m) => console.log(`  ${C.g}ok${C.x}    ${m}`);

  console.log(`\n=== Edition: ${id} ===`);
  const { edition, errors, paths } = loadEdition(id);

  console.log('\nedition.json');
  R.schema = errors;
  if (errors.length) errors.forEach((e) => err(`schema: ${e}`)); else ok('valid against edition.schema.json');
  for (const s of [...edition.pages, edition.closing]) if (!edition.tints?.[s.tint]) err(`page ${s.n}: tint "${s.tint}" is not defined in tints`);
  const ns = edition.pages.map((p) => p.n);
  if (ns.some((n, i) => n !== i + 1)) err(`pages are not numbered 1..${ns.length} in order: ${ns.join(', ')}`);
  for (const s of [...edition.pages, edition.closing]) if (/^TODO/i.test(s.status || '')) console.log(`  ${C.d}todo  page ${s.n}: ${s.status}${C.x}`);

  // ---------- files present, missing, misnamed ----------
  console.log('\nFiles');
  const expected = expectedAssets(edition);
  const brand = [
    { kind: 'brand', name: 'logo-blue', dir: '', required: true, exts: ['.png'] },
    { kind: 'brand', name: 'logo-white', dir: '', required: true, exts: ['.png'] },
    { kind: 'brand', name: 'monogram', dir: '', required: false, exts: ['.svg', '.png'], note: 'needed for the app icons' },
  ];
  const found = new Map(); // key kind:name -> file
  const used = new Set();
  const resolve = (a, base) => {
    const exts = a.exts || (a.kind === 'clip' ? CLIP_EXT : STILL_EXT);
    const f = findFile(path.join(base, a.dir), a.name, exts);
    if (f) { found.set(`${a.kind}:${a.name}`, f); used.add(path.resolve(f)); }
    return f;
  };
  for (const a of expected) resolve(a, paths.src);
  for (const a of brand) resolve(a, paths.brand);

  // Anything in source/ that no expected name claimed is either misnamed or extra.
  const listed = [...walk(paths.src), ...walk(paths.brand)].filter((f) => !/PUT-FILES-HERE\.txt$/i.test(f) && !used.has(path.resolve(f)));
  const missingAll = [...expected.map((a) => ({ ...a, base: paths.src })), ...brand.map((a) => ({ ...a, base: paths.brand }))]
    .filter((a) => !found.has(`${a.kind}:${a.name}`));
  for (const f of listed) {
    const dir = path.dirname(f);
    const guess = missingAll.find((a) => path.resolve(path.join(a.base, a.dir)) === path.resolve(dir) && norm(a.name) === norm(path.parse(f).name));
    if (guess) {
      const want = `${guess.name}${guess.kind === 'clip' ? '.mp4' : (guess.exts?.[0] || '.jpg')}`;
      R.misnamed.push({ file: rel(f), shouldBe: rel(path.join(dir, want)) });
      (guess.required ? err : warn)(`misnamed: ${rel(f)} should be ${want}`);
      guess.misnamedAs = f;
    } else {
      R.unexpected.push(rel(f));
      warn(`not used by edition.json: ${rel(f)}`);
    }
  }
  for (const a of missingAll) {
    if (a.misnamedAs) continue;
    const where = rel(path.join(a.base, a.dir, a.name + (a.kind === 'clip' ? '.mp4' : (a.exts?.[0] || '.jpg'))));
    R.missing.push({ file: where, required: a.required, role: a.role || a.note || a.kind });
    if (a.required) err(`missing: ${where}`);
    else warn(`missing: ${where}${a.role ? ` (${a.role}; the page crossfades until it exists)` : a.note ? ` (${a.note})` : ''}`);
  }
  const textCount = expected.filter((a) => a.kind === 'text' && found.has(`text:${a.name}`)).length;
  ok(`${found.size} expected files found${textCount ? '' : ' (no text pages yet)'}`);

  // ---------- sizes ----------
  console.log('\nSizes and format');
  const stills = expected.filter((a) => a.kind !== 'clip').concat(brand);
  for (const a of stills) {
    const f = found.get(`${a.kind}:${a.name}`) || a.misnamedAs;
    if (!f) continue;
    if (path.extname(f) === '.svg') { ok(`${rel(f)} svg`); continue; }
    let m;
    try { m = await sharp(f).metadata(); } catch (e) { err(`${rel(f)} cannot be read: ${e.message}`); continue; }
    const row = { file: rel(f), width: m.width, height: m.height, profile: iccName(m.icc), bytes: fs.statSync(f).size, issues: [] };
    const say = (level, msg) => { row.issues.push(msg); (level === 'error' ? err : warn)(`${rel(f)} ${msg}`); };
    const square = Math.abs(m.width - m.height) <= 2;
    if (a.kind === 'art' || a.kind === 'cover' || a.kind === 'text') {
      if (!square) say(a.kind === 'text' ? 'warn' : 'error', `is ${m.width} x ${m.height}, not square`);
      const min = a.kind === 'art' ? SPEC.art.min : SPEC.cover.min;
      if (Math.min(m.width, m.height) < min) say(a.kind === 'text' ? 'warn' : 'error', `is ${m.width} px, below the ${min} px minimum`);
      else if (a.kind === 'art' && m.width < SPEC.art.ideal) say('warn', `is ${m.width} px; ${SPEC.art.ideal} px master preferred`);
      if (a.kind !== 'text') {
        if (!row.profile) say('warn', 'has no colour profile (assumed sRGB)');
        else if (!/srgb|iec61966/i.test(row.profile)) say('warn', `colour profile is "${row.profile}", not sRGB`);
      }
      if (a.kind === 'art') {
        row.detail = await upscaleScore(f, m.width);
        if (row.detail.keptAt < 0.5 && row.detail.kept > 0.9) say('warn', `looks like a plain upscale: ${(row.detail.kept * 100).toFixed(0)}% of its fine detail survives a round trip through ${row.detail.at} px`);
      }
    }
    if (a.kind === 'brand' && a.name === 'monogram' && Math.min(m.width, m.height) < SPEC.monogram.min) say('warn', `is ${m.width} px; 2048 px preferred for icons`);
    R.sizes.push(row);
    if (!row.issues.length) ok(`${rel(f)} ${m.width} x ${m.height}${row.profile ? `, ${row.profile}` : ''}`);
  }

  const clips = expected.filter((a) => a.kind === 'clip');
  const info = new Map();
  for (const a of clips) {
    const f = found.get(`clip:${a.name}`) || a.misnamedAs;
    if (!f) continue;
    let p;
    try { p = await probeClip(f); } catch (e) { err(`${rel(f)} cannot be read: ${e.message}`); continue; }
    info.set(a.name, { file: f, ...p });
    const row = { file: rel(f), ...p, issues: [] };
    const say = (level, msg) => { row.issues.push(msg); (level === 'error' ? err : warn)(`${rel(f)} ${msg}`); };
    if (p.width !== p.height) say('error', `is ${p.width} x ${p.height}, not square`);
    if (Math.min(p.width, p.height) < SPEC.clip.min) say('error', `is ${p.width} px, below the ${SPEC.clip.min} px minimum`);
    else if (p.width < SPEC.clip.ideal) say('warn', `is ${p.width} px; ${SPEC.clip.ideal} px preferred`);
    if (!SPEC.clip.fps.some((r) => Math.abs(p.fps - r) < 0.05)) say('warn', `runs at ${p.fps.toFixed(2)} fps (24 or 30 expected)`);
    if (p.duration < SPEC.clip.seconds[0] || p.duration > SPEC.clip.seconds[1]) say('warn', `is ${p.duration.toFixed(2)} s long (about 5 s expected)`);
    if (p.audio) say('warn', 'has an audio track (it is dropped on build)');
    if (a.frames && p.frames < a.frames) say('warn', `has ${p.frames} frames, fewer than its ${a.frames}-frame pack`);
    R.sizes.push(row);
    if (!row.issues.length) ok(`${rel(f)} ${p.width} x ${p.height}, ${p.fps} fps, ${p.duration.toFixed(2)} s, ${p.frames} frames`);
  }

  // ---------- first and last frame drift ----------
  console.log(`\nClip drift (mean difference per channel at ${CMP} px, 0-255; ok <= ${DRIFT.ok}, visible > ${DRIFT.warn})`);
  const stillCache = new Map();
  const stillImg = async (name) => {
    if (!stillCache.has(name)) {
      const a = expected.find((x) => x.name === name && x.kind !== 'clip');
      const f = a && (found.get(`${a.kind}:${a.name}`) || a.misnamedAs);
      stillCache.set(name, f ? await toRGB(sharp(f)) : null);
    }
    return stillCache.get(name);
  };
  const frameCache = new Map();
  const frameImg = async (clip, which) => {
    const k = `${clip}:${which}`;
    if (!frameCache.has(k)) {
      const ci = info.get(clip);
      frameCache.set(k, ci ? await toRGB(sharp(await clipFrame(ci.file, which === 'first' ? 0 : -1, ci))) : null);
    }
    return frameCache.get(k);
  };
  const framesCache = new Map();
  const allFrames = async (clip) => {
    if (!framesCache.has(clip)) {
      const raw = await run(FFMPEG, ['-v', 'error', '-i', info.get(clip).file, '-vf', `scale=${CMP}:${CMP}:flags=lanczos`, '-pix_fmt', 'rgb24', '-f', 'rawvideo', 'pipe:1']);
      const size = CMP * CMP * 3, list = [];
      for (let o = 0; o + size <= raw.length; o += size) list.push(raw.subarray(o, o + size));
      framesCache.set(clip, list);
    }
    return framesCache.get(clip);
  };
  const refImg = (ref) => (ref.still ? stillImg(ref.still) : frameImg(ref.clip, ref.frame));
  const refName = (ref) => (ref.still ? `still ${ref.still}` : `${ref.frame} frame of ${ref.clip}`);

  for (const a of clips) {
    const ci = info.get(a.name);
    if (!ci) continue;
    for (const end of ['first', 'last']) {
      const ref = a[end];
      if (!ref) continue;
      const want = await refImg(ref);
      if (!want) { warn(`${a.name} ${end} frame: cannot compare, ${refName(ref)} is missing`); continue; }
      const got = await frameImg(a.name, end);
      const d = compare(got, want);
      const verdict = d.mae <= DRIFT.ok ? 'ok' : d.mae <= DRIFT.warn ? 'slight' : 'visible';
      const row = { clip: a.name, end, against: refName(ref), ...d, verdict };
      R.drift.push(row);
      const geo = d.aligned.dx || d.aligned.dy || d.aligned.scale !== 1
        ? `; best fit ${d.aligned.scale !== 1 ? `zoom ${(d.aligned.scale * 100 - 100).toFixed(0)}% ` : ''}shift ${fmtPct(d.aligned.dx)}, ${fmtPct(d.aligned.dy)} -> ${d.aligned.mae.toFixed(1)}`
        : '';
      const msg = `${a.name.padEnd(16)} ${end.padEnd(5)} vs ${refName(ref).padEnd(32)} ${d.mae.toFixed(1).padStart(5)}  (brightness ${d.lum >= 0 ? '+' : ''}${d.lum.toFixed(1)}${geo})`;
      if (verdict === 'ok') ok(msg); else if (verdict === 'slight') warn(msg); else warn(`${msg}  VISIBLE JUMP`);
      if (verdict !== 'ok') {
        // Where in this clip does the wanted frame actually appear? (a trim point, if one exists)
        const best = closest(await allFrames(a.name), want);
        row.closestFrame = { index: best.index, seconds: +(best.index / ci.fps).toFixed(2), mae: best.mae };
        console.log(`        ${C.d}closest frame of ${a.name} to ${refName(ref)}: #${best.index} at ${row.closestFrame.seconds} s (${best.mae.toFixed(1)})${C.x}`);
        if (ref.clip) {
          // Or does the earlier clip pass through this clip's opening frame somewhere else?
          const other = closest(await allFrames(ref.clip), got);
          const ri = info.get(ref.clip);
          row.closestInRef = { index: other.index, seconds: +(other.index / ri.fps).toFixed(2), mae: other.mae };
          const pageStill = expected.find((x) => x.name === ref.clip)?.first;
          const vsStill = pageStill?.still ? compare(got, await stillImg(pageStill.still), false).mae : null;
          if (vsStill != null) row.vsRefClipStart = { still: pageStill.still, mae: vsStill };
          console.log(`        ${C.d}closest frame of ${ref.clip} to ${a.name}'s first frame: #${other.index} at ${row.closestInRef.seconds} s (${other.mae.toFixed(1)})${vsStill != null ? `; vs still ${pageStill.still}: ${vsStill.toFixed(1)}` : ''}${C.x}`);
        }
      }
    }
    // the clip should hold its final frame for about 0.5 s
    const holdN = Math.round(ci.fps * 0.5);
    if (ci.frames > holdN && !a.frames) {
      const last = await frameImg(a.name, 'last');
      const before = await toRGB(sharp(await clipFrame(ci.file, -1 - holdN, ci)));
      const hold = compare(before, last, false).mae;
      R.drift.push({ clip: a.name, end: 'hold', mae: hold, verdict: hold <= HOLD ? 'ok' : 'moving' });
      if (hold > HOLD) warn(`${a.name.padEnd(16)} hold  last 0.5 s still moves (${hold.toFixed(1)}); the clip should hold its final frame`);
    }
  }
}

// ---------- helpers ----------
function* walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(f); else yield f;
  }
}

function norm(s) {
  return s.toLowerCase().replace(/[\s_]+/g, '-').replace(/(^|-)0+(\d)/g, '$1$2').replace(/[^a-z0-9-]/g, '');
}

function closest(frames, want) {
  let best = { index: -1, mae: Infinity };
  frames.forEach((f, i) => { const m = compare(f, want, false).mae; if (m < best.mae) best = { index: i, mae: m }; });
  return best;
}

function fmtPct(v) { return `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`; }

async function toRGB(img) {
  const { data } = await img.removeAlpha().toColourspace('srgb').resize(CMP, CMP, { fit: 'fill', kernel: 'lanczos3' }).raw().toBuffer({ resolveWithObject: true });
  return data;
}

/** Mean abs difference, brightness difference and the best zoom/shift fit (to tell a jump from a colour shift). */
function compare(a, b, align = true) {
  let s = 0, la = 0, lb = 0;
  for (let i = 0; i < a.length; i += 3) {
    s += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
    la += a[i] * 0.299 + a[i + 1] * 0.587 + a[i + 2] * 0.114;
    lb += b[i] * 0.299 + b[i + 1] * 0.587 + b[i + 2] * 0.114;
  }
  const n = a.length / 3;
  const out = { mae: s / a.length, lum: (la - lb) / n };
  if (align) out.aligned = bestFit(gray(a), gray(b));
  return out;
}

function gray(rgb) {
  // CMP -> ALIGN by 2x2 box, luminance only
  const f = CMP / ALIGN, g = new Float32Array(ALIGN * ALIGN);
  for (let y = 0; y < ALIGN; y++) for (let x = 0; x < ALIGN; x++) {
    let v = 0;
    for (let j = 0; j < f; j++) for (let i = 0; i < f; i++) {
      const k = ((y * f + j) * CMP + x * f + i) * 3;
      v += rgb[k] * 0.299 + rgb[k + 1] * 0.587 + rgb[k + 2] * 0.114;
    }
    g[y * ALIGN + x] = v / (f * f);
  }
  return g;
}

/** Search zoom 0.94..1.06 and shift +-5% of frame a (the clip) about the centre to best match b (the still). */
function bestFit(a, b) {
  const N = ALIGN, m = Math.round(N * 0.12), c = N / 2;
  const err = (scale, dx, dy) => {
    let s = 0, n = 0;
    for (let y = m; y < N - m; y += 1) for (let x = m; x < N - m; x += 1) {
      // where pixel (x,y) of the still is found in the clip
      const sx = (x - c) * scale + c + dx, sy = (y - c) * scale + c + dy;
      const x0 = Math.floor(sx), y0 = Math.floor(sy), fx = sx - x0, fy = sy - y0;
      if (x0 < 0 || y0 < 0 || x0 >= N - 1 || y0 >= N - 1) continue;
      const i = y0 * N + x0;
      const v = (a[i] * (1 - fx) + a[i + 1] * fx) * (1 - fy) + (a[i + N] * (1 - fx) + a[i + N + 1] * fx) * fy;
      s += Math.abs(v - b[y * N + x]); n++;
    }
    return s / n;
  };
  let best = { e: err(1, 0, 0), scale: 1, dx: 0, dy: 0 };
  const R = Math.round(N * 0.05);
  for (let sc = 0.94; sc <= 1.0601; sc += 0.02) for (let dy = -R; dy <= R; dy += 2) for (let dx = -R; dx <= R; dx += 2) {
    const e = err(sc, dx, dy); if (e < best.e) best = { e, scale: sc, dx, dy };
  }
  // refine
  const c0 = best;
  for (let sc = c0.scale - 0.01; sc <= c0.scale + 0.0101; sc += 0.005) for (let dy = c0.dy - 1.5; dy <= c0.dy + 1.5; dy += 0.5) for (let dx = c0.dx - 1.5; dx <= c0.dx + 1.5; dx += 0.5) {
    const e = err(sc, dx, dy); if (e < best.e) best = { e, scale: sc, dx, dy };
  }
  const base = err(1, 0, 0);
  // Only report a geometric fit when it explains a real part of the difference.
  if (best.e > base * 0.85) return { mae: base, scale: 1, dx: 0, dy: 0 };
  return { mae: best.e, scale: Math.round(best.scale * 1000) / 1000, dx: best.dx / N, dy: best.dy / N };
}

/** How much of the finest detail survives a round trip through 2576 px: near 100% suggests an upscaled master. */
async function upscaleScore(file, width) {
  const at = 2576, crop = 1600;
  const img = sharp(file, { limitInputPixels: false });
  const left = Math.round((width - crop) / 2);
  const region = await img.extract({ left, top: left, width: crop, height: crop }).extractChannel(1).raw().toBuffer();
  const small = Math.round(crop * at / width);
  const down = await sharp(region, { raw: { width: crop, height: crop, channels: 1 } }).resize(small, small, { kernel: 'lanczos3' }).extractChannel(0).raw().toBuffer();
  const round = await sharp(down, { raw: { width: small, height: small, channels: 1 } }).resize(crop, crop, { kernel: 'lanczos3' }).extractChannel(0).raw().toBuffer();
  const hf = (buf) => { let s = 0; for (let y = 1; y < crop - 1; y++) for (let x = 1; x < crop - 1; x++) { const i = y * crop + x; s += Math.abs(4 * buf[i] - buf[i - 1] - buf[i + 1] - buf[i - crop] - buf[i + crop]); } return s; };
  return { at, keptAt: at / width, kept: Math.round((hf(round) / hf(region)) * 100) / 100 };
}

/** Read the description tag of an ICC profile. */
function iccName(icc) {
  if (!icc || icc.length < 132) return null;
  const count = icc.readUInt32BE(128);
  for (let i = 0; i < count; i++) {
    const o = 132 + i * 12;
    if (icc.toString('ascii', o, o + 4) !== 'desc') continue;
    const off = icc.readUInt32BE(o + 4);
    const type = icc.toString('ascii', off, off + 4);
    if (type === 'desc') { const len = icc.readUInt32BE(off + 8); return icc.toString('ascii', off + 12, off + 12 + len - 1).trim(); }
    if (type === 'mluc') { const so = icc.readUInt32BE(off + 20), sl = icc.readUInt32BE(off + 16); const b = icc.subarray(off + so, off + so + sl); let s = ''; for (let k = 0; k + 1 < b.length; k += 2) s += String.fromCharCode(b.readUInt16BE(k)); return s.trim(); }
  }
  return 'unnamed profile';
}
