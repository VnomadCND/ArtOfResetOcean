// Shared by build-assets and check-assets: where an edition's files live and what it expects.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const FFMPEG = process.env.FFMPEG || 'ffmpeg';
export const FFPROBE = process.env.FFPROBE || 'ffprobe';

export const STILL_EXT = ['.jpg', '.jpeg', '.png', '.tif', '.tiff'];
export const CLIP_EXT = ['.mp4', '.mov'];

// Master specs (ROADMAP.md, Assets)
export const SPEC = {
  art: { min: 4000, ideal: 8000 },
  cover: { min: 2500 },
  clip: { min: 1080, ideal: 1440, fps: [24, 30], seconds: [4, 6.5] },
  monogram: { min: 1024 },
};

export function editionPaths(id) {
  return {
    json: path.join(ROOT, 'editions', id, 'edition.json'),
    schema: path.join(ROOT, 'editions', 'edition.schema.json'),
    src: path.join(ROOT, 'source', 'editions', id),
    brand: path.join(ROOT, 'source', 'brand'),
    out: path.join(ROOT, 'public', 'editions', id),
    icons: path.join(ROOT, 'public', 'icons'),
  };
}

export function editionIds() {
  return fs.readdirSync(path.join(ROOT, 'editions'), { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(ROOT, 'editions', d.name, 'edition.json')))
    .map((d) => d.name);
}

export function loadEdition(id) {
  const p = editionPaths(id);
  const edition = JSON.parse(fs.readFileSync(p.json, 'utf8'));
  const schema = JSON.parse(fs.readFileSync(p.schema, 'utf8'));
  const ajv = new Ajv({ allErrors: true, strict: false });
  const ok = ajv.validate(schema, edition);
  const errors = ok ? [] : ajv.errors.map((e) => `${e.instancePath || '(root)'} ${e.message}${e.params?.additionalProperty ? `: ${e.params.additionalProperty}` : ''}${e.params?.allowedValues ? ` (${e.params.allowedValues.join(', ')})` : ''}`);
  return { edition, errors, paths: p };
}

/** Find a master by base name, accepting any allowed extension. */
export function findFile(dir, name, exts) {
  for (const ext of exts) {
    const f = path.join(dir, name + ext);
    if (fs.existsSync(f)) return f;
  }
  return null;
}

const pad = (n) => String(n).padStart(2, '0');

/**
 * Everything the edition expects in source/, derived from edition.json.
 * kind: cover | art | text | clip | brand
 * first/last: what the clip's first and last frames should match
 *   { still: name } or { clip: name, frame: 'first'|'last' } or null (no still to match).
 */
export function expectedAssets(edition) {
  const list = [];
  const add = (a) => { if (!list.some((x) => x.kind === a.kind && x.name === a.name)) list.push(a); };
  const all = [...edition.pages, edition.closing];

  add({ kind: 'cover', name: edition.cover, dir: '', required: true });
  for (const s of all) add({ kind: 'art', name: s.art, dir: 'art', required: true });
  if (edition.keepsakeArt) add({ kind: 'art', name: edition.keepsakeArt, dir: 'art', required: true });
  for (const pg of edition.pages) add({ kind: 'text', name: pad(pg.n), dir: 'text', required: false });

  edition.pages.forEach((pg, i) => {
    const prev = edition.pages[i - 1];
    if (pg.turnIn) {
      add({
        kind: 'clip', name: pg.turnIn, dir: 'clips', required: false, role: `turn into page ${pg.n}`,
        first: pg.turnInFrom ?? { still: prev ? prev.art : edition.cover },
        last: { still: pg.art },
      });
    }
    if (pg.fxClip) {
      // An fx clip starts on its page's art. It ends there too, unless it is scrubbed (its end is a
      // place of its own) or something later uses its last frame as a still (a turn, the closing page).
      const lastUsed = [...edition.pages.map((p) => p.turnInFrom), edition.closing.artFrom]
        .some((r) => r && r.clip === pg.fxClip && r.frame === 'last');
      add({
        kind: 'clip', name: pg.fxClip, dir: 'clips', required: false, role: `effect on page ${pg.n}`, frames: pg.fxFrames,
        first: { still: pg.art },
        last: lastUsed || pg.fxFrames ? null : { still: pg.art },
      });
    }
  });
  return list;
}

export function run(cmd, args, { encoding = 'buffer' } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { windowsHide: true });
    const out = []; const err = [];
    p.stdout.on('data', (d) => out.push(d));
    p.stderr.on('data', (d) => err.push(d));
    p.on('error', reject);
    p.on('close', (code) => {
      const buf = Buffer.concat(out);
      if (code !== 0) return reject(new Error(`${path.basename(cmd)} exited ${code}: ${Buffer.concat(err).toString().trim().split('\n').slice(-4).join('\n')}`));
      resolve(encoding === 'buffer' ? buf : buf.toString(encoding));
    });
  });
}

export async function probeClip(file) {
  const json = JSON.parse(await run(FFPROBE, ['-v', 'error', '-count_packets', '-show_streams', '-show_format', '-of', 'json', file], { encoding: 'utf8' }));
  const v = json.streams.find((s) => s.codec_type === 'video');
  const [fn, fd] = (v?.avg_frame_rate || v?.r_frame_rate || '0/1').split('/').map(Number);
  return {
    width: v?.width, height: v?.height, codec: v?.codec_name,
    fps: fd ? fn / fd : 0,
    frames: Number(v?.nb_read_packets || v?.nb_frames || 0),
    duration: Number(json.format?.duration || v?.duration || 0),
    audio: json.streams.some((s) => s.codec_type === 'audio'),
  };
}

/** One frame of a clip as a PNG buffer. index may be negative (from the end). */
export async function clipFrame(file, index, info) {
  const info2 = info || await probeClip(file);
  const n = index < 0 ? info2.frames + index : index;
  return run(FFMPEG, ['-v', 'error', '-i', file, '-vf', `select=eq(n\\,${n})`, '-frames:v', '1', '-f', 'image2pipe', '-vcodec', 'png', 'pipe:1']);
}
