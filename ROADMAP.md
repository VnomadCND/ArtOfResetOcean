# The Art of Reset Digital Edition: Build Roadmap

Oct 20, 2026 · Vernon (SpaceFrog Designs)
Live, editable version: https://claude.ai/code/artifact/d962b029-743b-406a-b8a8-5dc4e794285d

## Summary

We are building the Ocean edition of The Art of Reset as an installable web app (PWA), with a single offline HTML file as a bonus. It has a cover, 11 interactive pages and a closing keepsake page. The design is settled in prototypes; this build turns them into a production app whose engine reads each edition from a settings file, so the other 7 editions become art and data, not new code.

**Who it's for:** buyers of the physical books and new customers, on phones first, then tablets and laptops. No app store, no account needed to start.

**Reference prototypes (the source of truth for look, timing and feel):**

| Prototype | What it shows | Version to follow |
| --- | --- | --- |
| [Living book, pages 1 to 5](https://claude.ai/artifact/2fxGskX2YoHa4WMYNkpiNM) | Cover, Breathe, Arrive, Descend, Move, Release, closing, keepsake | Version 5 (soft glass guidance). Version 3 is the no-glass fallback. |
| [Feel test, pages 9 and 10](https://claude.ai/artifact/D6FdSd4osfZyAtMF73m33b) | Follow the light, Slower is better | Version 1 |
| [Small type study](https://claude.ai/artifact/EcEi7kvzn5Ys92B2jdT3V2) | Why guidance text uses soft glass, with measured contrast | Column 4 was chosen |

The prototype source files ship in this kit under `reference/prototype/`.

**Locked:** the page rhythm, the type pairing, soft glass guidance, the WebGL art treatment, the synthesized ambient sound, the interactions for pages 1 to 5, 9 and 10, and the keepsake card.

**Designed but not yet prototyped:** pages 6, 7, 8 and 11 (specs in The eleven pages).

## The experience

Every page follows the same rhythm, so the book feels calm and predictable while each interaction stays fresh.

**Page rhythm** (timings from the prototype):

1. Page turn: the morph clip plays full screen and ends exactly on this page's art.
2. Art alone for 2.2 s, with a slow camera drift (4.5% over 45 s).
3. The affirmation rises in, line by line (0.9 s stagger, blur to sharp).
4. After 3.2 s (4.2 s for three lines) the guidance appears and the interaction starts.
5. On completion: a three-note bell chord, a gold glint sweeps across the art, ripples leave the moon, then Continue appears.
6. Continue: the words lift away, the camera eases back, and the next page turn plays.

**Type**

- Affirmations: Cormorant Garamond 300, one key word in italic gold (Breathe: *soften*). Size `clamp(2.5rem, 5.2vw, 4.9rem)`; phones `clamp(2rem, 8.8vw, 2.9rem)`.
- Guidance: Cormorant Garamond italic 500 at about 1.15 to 1.35rem, on soft glass.
- Buttons and labels: Poppins 500, capitals, 0.8rem, 0.24em tracking, on a soft glass pill.
- Fonts are self-hosted (woff2), never loaded from Google at runtime, so the app works offline.

**Soft glass guidance** (chosen in the small type study): every guidance line, field, choice group, recap and button sits on `rgba(tint, 0.42)` with `backdrop-filter: blur(12px)`. The tint follows the page: navy `3,16,34` on night pages, warm light `255,240,232` on dawn pages (dark rose text), plum `30,8,44` on Lunar Waves. With reduced transparency turned on, the glass goes to 0.78. Affirmations never get glass; busy pages may add a soft radial shade behind the words (Move, closing).

**The art** is drawn in WebGL, not as a flat image: gold-leaf glints sweep across gold areas, stars twinkle, the moon brightens and blooms with the reader's breath, plus a vignette and fine film grain. Every effect is set per page. The art is never cropped by layout: a per-page focus point keeps the subject in frame on landscape and portrait.

**Sound** is synthesized live (nothing to download): a brown-noise sea with a slow swell, foam, and a D-major drone whose filter opens with each breath. Bells mark progress. Sound starts on the first tap, has a toggle top right, and is remembered.

**Haptics:** short vibrations on progress and completion where the device supports it (Android; iOS Safari does not).

**Chrome:** only a hairline progress bar at the top (one segment per page) and the sound toggle. No menus during a reset.

**Reduced motion:** camera drift, twinkle and long transitions are cut; interactions still work.

**Keepsake:** the closing page recaps what the reader did on each page. Save my reset renders a 1080 × 1350 card with the edition art, the recap, the date and the SpaceFrog logo, and downloads it as a PNG. Nothing the reader types ever leaves the device, and text written on Release is never stored.

## The eleven pages

Each page uses a different interaction, so nothing repeats across the book. Status says whether to port it from a prototype or build it from the spec below.

| # | Art | Affirmation (key word in gold) | Interaction | Input | Saved for the keepsake | Clips | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Golden Moon | Let yourself *soften* / into the rhythm | Breathe: hold to breathe in, release to breathe out, 3 breaths | Hold anywhere, Space | Breath count | turn-01 | Port |
| 2 | Mint Moon Beach | There is nothing to force / just *gently* arrive here | Arrive: stay still 8 s and the blurred dawn comes into focus | Do nothing; movement resets | Arrived | turn-02 | Port |
| 3 | Moon Bay | Beneath the surface / there is more *calm* / than you realize | Descend: drag down to sink 30 m, name the calm in one word | Drag down, scroll, arrow keys, text | Calm word | turn-03, fx-03-dive | Port |
| 4 | Midnight Ocean | Even when it shifts / you are still moving *forward* | Move: push the water either way, it only carries you forward; pick what is shifting | Swipe, scroll, arrows, one choice | Shifting choice | turn-04, fx-04-current | Port |
| 5 | Lunar Waves | You don't have to hold on / let it *move through* you | Release: write it, hold, the letters drift into the moon | Text, hold | Count only, never the text | turn-05, fx-05-ribbon | Port |
| 6 | Ocean Stars | In stillness / everything begins to *settle* | Snow globe: calm the swirling stars, let go, they return to their places | Slow strokes, then release | Settled | turn-06 | Build |
| 7 | Moonlit Stars | There is space here for you / to breathe and *expand* | Make room: widen the view with each in-breath | Pinch out, scroll, hold | Breaths of space | turn-07 | Build |
| 8 | Winter Beach I | Each moment offers / a quiet chance to *begin again* | Write in the sand: a wave smooths it away, write again | Draw or type | Fresh starts (count) | turn-08, fx-08-wave-wash | Build |
| 9 | Moonlit Ocean | You don't need to control it / just move with the *flow* | Follow the light: follow it loosely and the sea smooths | Pointer or finger near the light | Moved with it | turn-09 | Port |
| 10 | Ocean Clouds | You are allowed to / slow down and *soften* here | Slower is better: slow strokes calm the clouds and soften the art | Slow strokes | Slowed down | turn-10 | Port |
| 11 | Indigo Waters | In this stillness / everything settles back *into place* | Smooth the threads: stroke the tangled gold lines back into place | Strokes | Back in place | turn-11, fx-11-sunset | Build |

The closing page follows page 11 on the last frame of fx-11-sunset.

### Page 6 · Snow globe

- On entry the gold stars lift out of the sky and swirl slowly, like a shaken snow globe. Build the stars as particles sampled from the art (bright, small, warm points above the mountains) and paint the sky underneath with the stars removed (the asset script makes both).
- Each slow stroke damps the swirl. Fast strokes stir it up again. Once the swirl is calm, the cue says Let go.
- With no touch for 2 s, every star glides back to its exact source position over about 6 s, then the real art fades back in under them. Completion when the last star lands.
- Sound: a soft shimmer that thins out as the stars settle.

### Page 7 · Make room

- The page opens zoomed in 1.35× on the moon and horizon, so it feels close. turn-07 ends on the full painting, so ease the camera in from 1.0× to 1.35× during the art-alone beat (about 2 s), never a cut.
- Each in-breath widens the view: pinch out on touch, scroll or hold on desktop. Breathing out eases it back a little, never all the way. Three breaths reach the full painting at 1.0× and the stars brighten across the sky.
- No extra art is needed; it is the existing camera with a different start and end.
- Distinct from page 1: page 1 is about rhythm, page 7 is about space opening.

### Page 8 · Write in the sand

- The reader draws with a finger or types a word. Strokes are drawn as pressed wet sand, clipped to the beach area (a mask made by the asset script).
- Tapping the water, or pausing for 3 s, sends a wave: fx-08-wave-wash plays over the beach and a wipe synced to it clears the strokes. The clip starts and ends on the still, so it can loop.
- The reader can write again as often as they like. After the first wash, Continue appears next to Write again.
- Saved: the number of fresh starts only, never what was written.

### Page 11 · Smooth the threads

- On entry the gold threads in the lower half ripple out of place: a shader warp over that region, amplitude 1.
- Strokes paint calm into a low-resolution map. Wherever it is calm, the warp eases to zero over about 1.5 s, so the threads settle back into the painted lines.
- At 85% calm the remaining threads settle by themselves, fx-11-sunset plays (the gold sun sinks behind the hills), and the closing page begins on its last frame.
- No layered art is needed. If Katherine supplies the threads as a separate layer later, the same interaction gets sharper.

## Architecture

The app is one full-screen scene: the book engine reads `edition.json`, plays each page's rhythm, and hands the reader to that page's interaction module.

```text
BUILD TIME
  source/ masters (8000 px art, clips, logos)
     -> build-assets script (stills, clips, packs, masks)
        -> public/editions/ (what the app loads) -> Service worker (offline cache)

IN THE APP
  edition.json (words, pages, values) -> BOOK ENGINE (page rhythm, page turns, progress)
     BOOK ENGINE runs the current page through:
        Interactions (12: one module per kind of page)
        Camera and input (focus, drift, pointer speed)
        Ambient sound (sea, drone, bells, made in code)
     Each interaction draws and records through the shared context:
        Art renderer (WebGL, one shader)
        Overlay canvas (lights, ink, particles)
        Guide and keepsake (soft glass, recap card)
        Progress store (on the device only)
```

- **Stack:** Vite and vanilla TypeScript, no UI framework. `vite-plugin-pwa` (Workbox) for install and offline. Playwright for tests.
- **Art renderer:** a WebGL1 full-screen plane. Stills are resampled to a 2048 power-of-two texture with mipmaps (sharp while drifting, and the mip level gives the Arrive blur). Scrubbed clips use a second texture fed frame by frame. One fragment shader carries glints, twinkle, moon bloom, blur, vignette, grain, and the new warps. If WebGL is missing, a plain image with CSS blur takes over.
- **Page turns:** a `<video muted playsinline>` with WebM (VP9) first and MP4 (H.264) as fallback, positioned with the page's focus point so its last frame lines up with the still. The still crossfades in underneath.
- **Interactions:** one module per kind of page (11 pages plus the closing), sharing the interface in Repository file structure. They receive input already normalized: pointer position, speed and direction, wheel, keys.
- **Sound:** WebAudio, built live: brown-noise sea with a slow swell, a foam band, a four-voice drone through a filter that opens with breath, bells and swells. Started on the first tap (iOS rule).
- **Storage:** progress, recap and settings in `localStorage`, wrapped in try/catch; the app works without it.
- **PWA:** the manifest uses the monogram icons and a night-navy theme colour. The service worker precaches the shell and the cover, then caches each page's assets as the reader nears it, plus a "Download for offline" button in settings that fetches the whole edition.
- **Single-file bonus:** a second Vite build (`vite-plugin-singlefile`) inlines the code, fonts and stills, with crossfades in place of video, so the file stays under about 40 MB.

## Repository file structure

One repo holds the engine and every edition. You prepare `source/` (masters you own); the asset script writes `public/editions/` (web files the app loads). Never edit `public/editions/` by hand.

```text
art-of-reset-digital/
├─ ROADMAP.md                  this document
├─ CLAUDE.md                   working rules for Claude Code
├─ reference/
│  └─ prototype/               ritual.html, feel.html, compare.html + their img/ vid/ pack/
├─ source/                     YOU PREPARE THIS (masters; use Git LFS if committed)
│  ├─ brand/                   logo-blue.png, logo-white.png, monogram.svg (or .png)
│  └─ editions/
│     └─ ocean/
│        ├─ cover.jpg
│        ├─ art/                01-golden-moon.jpg … 11-indigo-waters.jpg (8000 px)
│        ├─ text/               01.jpg … 11.jpg (the affirmation pages, for reference)
│        └─ clips/              turn-01.mp4 … turn-11.mp4, fx-03-dive.mp4 …
├─ editions/
│  └─ ocean/
│     └─ edition.json          words, page order, interactions, focus points, tints
├─ scripts/
│  ├─ build-assets.mjs         masters → web stills, clips, frame packs, masks, star maps
│  └─ check-assets.mjs         end-frame alignment, sizes, missing files
├─ public/
│  ├─ fonts/                   cormorant-garamond-*.woff2, poppins-*.woff2
│  ├─ icons/                   icon-192.png, icon-512.png, maskable-512.png, apple-touch-icon.png
│  └─ editions/ocean/          GENERATED: img/, vid/, pack/, mask/
├─ src/
│  ├─ main.ts                  boot, routing (?page=, #edition), install prompt
│  ├─ engine/
│  │  ├─ book.ts               page flow: rhythm, page turns, progress, resume
│  │  ├─ camera.ts             cover-fit, focus points, drift, eased moves
│  │  ├─ input.ts              pointer, wheel, keys, pointer speed and direction
│  │  └─ layout.ts             words and guidance placement per orientation
│  ├─ render/
│  │  ├─ art-gl.ts             WebGL plane, textures, uniforms
│  │  ├─ art.frag              glints, twinkle, bloom, blur, warps (one shader)
│  │  ├─ overlay.ts            2D canvas: lights, trails, ink, particles
│  │  └─ fallback.ts           plain image when WebGL is missing
│  ├─ interactions/            one file per interaction, same small interface
│  │  ├─ breathe.ts  arrive.ts  descend.ts  move.ts  release.ts
│  │  ├─ snow-globe.ts  make-room.ts  sand.ts  follow-light.ts  slow.ts  threads.ts
│  │  └─ closing.ts
│  ├─ sound/
│  │  └─ ambient.ts            synthesized sea, drone, bells, swells
│  ├─ ui/
│  │  ├─ cover.ts  guide.ts  hairline.ts  keepsake.ts  settings.ts
│  │  └─ styles.css            tokens, type, soft glass
│  ├─ store/
│  │  └─ progress.ts           local progress and recap, on device only
│  └─ sw/                      service worker (via vite-plugin-pwa)
├─ tests/
│  └─ e2e/                     Playwright walkthroughs per page, desktop and phone
├─ index.html
├─ vite.config.ts
└─ package.json
```

Each interaction exports the same interface, so pages are added by settings, not by editing the engine: `start(page, ctx)` returns a promise that resolves when the reader completes it, plus optional `tick(dt)`, `onInput(event)` and `stop()`. `ctx` gives access to the camera, the art uniforms, the overlay canvas, sound, the guide and the keepsake record.

## Edition config format

An edition is one `edition.json`: page order, words, which interaction runs, and the per-page values the prototype tuned by hand. Coordinates are fractions of the square art (0 to 1, from the top left).

`editions/ocean/edition.json` in this kit is a full first draft: pages 1 to 5, 9 and 10 carry the exact values from the prototypes; pages 6, 7, 8, 11 and the closing page are marked `TODO` and need tuning on the real art. Example (page 1):

```json
{
  "n": 1,
  "art": "01-golden-moon",
  "turnIn": "turn-01",
  "lines": ["Let yourself <em>soften</em>", "into the rhythm"],
  "interaction": "breathe",
  "options": { "breaths": 3, "inMs": 4000, "outMs": 6000 },
  "focus": { "landscape": [0.5, 0.32], "portrait": [0.55, 0.36] },
  "words": { "landscape": { "v": 0.428 }, "portrait": { "v": 0.428 } },
  "moon": { "x": 0.624, "y": 0.247, "r": 0.113 },
  "fx": { "glint": 1, "twinkle": 1, "bloom": 0.9, "bloomColor": [1, 0.86, 0.6] },
  "tint": "night"
}
```

Rules: `art`, `turnIn` and `fxClip` names match the files in `source/editions/<id>/`. A page with no `turnIn` file yet crossfades. `words` and an optional `guide` take `v` (vertical position), and optionally `x` and `"align": "left"`. Add a schema (`edition.schema.json`) and validate it in `check-assets`.

## Assets

You prepare masters in `source/`; the asset script makes every web file from them. That way a better clip or art file later is a drop-in replacement: re-run the script and nothing else changes. `source/README.md` lists every file name.

### What you prepare (Ocean)

**Art and brand**

- [ ] `cover.jpg`: the front cover, square, 2500 px or larger (have it: Reset-Ocean-Volume_1_-Front_Cover.jpg)
- [ ] `art/01-golden-moon.jpg` (have it at 2576 px; an 8000 px master is better)
- [ ] `art/02-mint-moon-beach.jpg` (have it at 2576 px, heavily compressed; re-export please)
- [ ] `art/03-moon-bay.jpg` (have the 8000 px master)
- [ ] `art/04-midnight-ocean.jpg` (have the 8000 px master)
- [ ] `art/05-lunar-waves.jpg` (have the 8000 px master)
- [ ] `art/06-ocean-stars.jpg` (have the 8000 px master)
- [ ] `art/07-moonlit-stars.jpg` (only a 2576 px copy so far)
- [ ] `art/08-winter-beach-i.jpg` (only 2576 px so far)
- [ ] `art/09-moonlit-ocean.jpg` (only 2576 px so far)
- [ ] `art/10-ocean-clouds.jpg` (have the 8000 px master)
- [ ] `art/11-indigo-waters.jpg` (only 2576 px so far)
- [ ] `text/01.jpg` … `text/11.jpg`: the affirmation pages (reference only; the words live in edition.json)
- [x] `brand/logo-blue.png`, `brand/logo-white.png` (included, 3927 px, transparent)
- [ ] `brand/monogram.svg` or `.png`: the SF circle mark alone, for the app icon (needed)

Art spec: square, 8000 px master if you have it (4000 px minimum), sRGB, JPG at maximum quality or PNG, no text on the art, the same framing as the book page.

**Clips** (the Higgsfield work)

| File | What it shows | First frame | Last frame | Have now |
| --- | --- | --- | --- | --- |
| turn-01 | Cover morphs into page 1 | Cover | Page 1 art | First round (m0) |
| turn-02 | 1 to 2 | Page 1 art | Page 2 art | First round (m1) |
| turn-03 | 2 to 3 | Page 2 art | Page 3 art | First round (m2) |
| turn-04 | 3 to 4 | Page 3 art | Page 4 art | First round (m3) |
| turn-05 | 4 to 5 | Last frame of fx-04-current | Page 5 art | First round (m4) |
| turn-06 | 5 to 6 | Page 5 art | Page 6 art | Needed |
| turn-07 | 6 to 7 | Page 6 art | Page 7 art | Needed |
| turn-08 | 7 to 8 | Page 7 art | Page 8 art | Needed |
| turn-09 | 8 to 9 | Page 8 art | Page 9 art | Needed |
| turn-10 | 9 to 10 | Page 9 art | Page 10 art | Needed |
| turn-11 | 10 to 11 | Page 10 art | Page 11 art | Needed |
| fx-03-dive | Sinking beneath the surface of Moon Bay | Page 3 art | Deep underwater | First round (clip 3) |
| fx-04-current | The water moves forward, the moon rises | Page 4 art | Moon higher | First round (clip 4) |
| fx-05-ribbon | A gold ribbon lifts off the water into the moon | Page 5 art | Page 5 art | First round (clip 5) |
| fx-08-wave-wash | One wave rolls up the beach and draws back | Page 8 art | Page 8 art | Needed |
| fx-11-sunset | The gold sun sinks behind the hills, light softens | Page 11 art | Sun set (new) | Needed |

Order matters for page 4: make fx-04-current first, then use its last frame (moon fully risen) as the first frame of turn-05, not the page 4 still. check-assets compares turn-05 against the end of fx-04.

Clip spec: square 1:1, 1440 px if the tool allows (1080 minimum), 24 or 30 fps, 5 s, MP4 at the highest quality offered, no audio. The camera stays locked at both ends, so the first and last frames match the stills exactly (the script checks this and reports any drift). Hold the last frame still for about 0.5 s. Keep the art's own style: no new objects, people, text or 3D look.

**Prompt pattern for the new turns** (fill in the two page names): "Seamless morph from [page A] to [page B]. Locked camera, no zoom or pan. Shapes flow and dissolve like ink and gold leaf in water, keeping the flat collage style, gold edges and textures of both artworks. Starts exactly on the first image, ends exactly on the second, holding the final frame."

### What the asset script makes (not you)

- Web stills: 2560 px WebP (quality 88) and a 1440 px WebP for phones.
- Clips: H.264 MP4 (1080, CRF 21, faststart) and VP9 WebM (CRF 34).
- Frame packs for scrubbed clips (fx-03, fx-04): 90 and 72 frames at 960 px WebP.
- Masks: the beach area (page 8), the thread region (page 11), and the star map plus a starless sky (page 6).
- App icons from the monogram: 192, 512, maskable 512, Apple touch 180, favicon.

### What Claude Code sources itself

- Fonts: Cormorant Garamond and Poppins from the @fontsource packages (open font licence), self-hosted.
- Sound: none needed; it is generated in code. A recorded sound bed can be added later (see Open decisions).

## Build phases

Phases run in order and each ends at a gate; Phase 0 starts as soon as the repo exists.

| Phase | What gets built | Gate to move on |
| --- | --- | --- |
| 0 · Setup | Repo, Vite, CLAUDE.md, asset and check scripts | Ocean builds from source/ with no errors |
| 1 · Port pages 1–5 | Engine, art renderer, sound, cover, pages 1 to 5, closing page | Matches prototype v5 side by side |
| 2 · Pages 6–11 | Port pages 9 and 10, build 6, 7, 8 and 11, keepsake with 11 rows | Vernon and Katherine approve each page on their phones |
| 3 · Installable app | Install, offline download, resume, Today's reset, settings | Whole book runs in airplane mode |
| 4 · Offline file | Single-file bonus: stills and crossfades | Opens with no network from a laptop download |
| 5 · Delivery | Shopify access: private link and one-time code | A test order unlocks the edition |
| 6 · Test and launch | Device testing, accessibility, speed, launch | Release checklist fully ticked |
| 7 · Next edition | Second edition from art and edition.json only | No engine code changed |

Clips never block a phase: a page without its final clip crossfades until the clip arrives, so the Higgsfield work can run alongside Phases 1 to 3. Phases 4 and 5 can swap order if delivery is settled first.

## Quality bar and release checklist

A release ships only when every box below is ticked on real devices, not only in a desktop browser.

**Parity**

- [ ] Pages 1 to 5, 9 and 10 match the prototypes side by side: timing, positions, glass, sound, completion moments.
- [ ] Every page turn ends on its still with no visible jump (check-assets passes).

**Devices** (touch, sound through the speaker, install to home screen)

- [ ] iPhone, Safari, current and previous iOS, plus installed to the home screen
- [ ] Android phone, Chrome, plus installed
- [ ] iPad, Safari, landscape and portrait
- [ ] Laptop: Chrome, Safari, Firefox, with mouse and with trackpad

**Performance**

- [ ] Cover is interactive within 3 s on a mid-range phone over 4G.
- [ ] Only the next page's art and clip load ahead; later pages load in the background.
- [ ] Full Ocean download for offline use stays under about 60 MB.
- [ ] Steady 60 fps on page 1 on a mid-range phone; no frame drops during page turns.

**Access and comfort**

- [ ] Guidance text contrast of 4.5:1 or better on every page, measured over the art behind it.
- [ ] Reduced motion and reduced transparency respected.
- [ ] Every interaction works by keyboard on desktop, and each has a quiet way to skip it after 20 s.
- [ ] Screen readers hear the affirmation, the guidance and the controls.
- [ ] Safe areas respected on notched phones; nothing hides under the home bar.

**Offline and privacy**

- [ ] Installed app opens and runs every page in airplane mode.
- [ ] Progress and recap resume after closing the app.
- [ ] Nothing the reader types is sent anywhere; no third-party trackers.

**Known platform limits** to design around: iOS Safari does not vibrate, needs a tap before sound, and suspends audio in the background. Some Android browsers lack `backdrop-filter`, so fall back to a solid tint.

## Open decisions for Vernon

None of these block Phases 0 to 2; each one is needed by the phase listed.

| Decision | Options | Recommendation | Needed by |
| --- | --- | --- | --- |
| Painting titles | Settled: 7 Moonlit Stars, 8 Winter Beach I, 9 Moonlit Ocean, 11 Indigo Waters | Done | Phase 0 (file names) |
| A lighter way in | Full journey only, or also Today's reset (2 or 3 pages picked for you) | Offer both; the full journey runs 13 to 15 minutes | Phase 3 |
| Cover line | "Five resets" no longer fits | "Eleven resets · one or all" | Phase 2 |
| Sound | Generated in code (as now), or a recorded bed | Keep generated for launch; test a recorded bed later | Phase 6 |
| How buyers get access | Shopify digital download with a private link and code; a licence key unlocked in the app; or an open link | Private link plus a one-time code from the Shopify order, checked once and remembered | Phase 5 |
| Pricing | Per edition, bundle of 8, or with the physical book | Decide with the Shopify plan | Phase 5 |
| Keepsake branding | Logo only, or logo plus a shop link | Small white logo, no link on the image | Phase 2 |
| Analytics | None, or privacy-friendly page counts | Privacy-friendly counts only (which pages finish), no personal data | Phase 6 |
| Offline bonus scope | Full edition in one file (very large), or stills with crossfades and no video | Stills and crossfades, under about 40 MB | Phase 4 |

## Working notes for Claude Code

These are also in `CLAUDE.md` at the repo root.

1. Read `reference/prototype/ritual.html` and `feel.html` end to end before writing code. They are the spec for behaviour, timing and look. When this roadmap and the prototype disagree on something visual, the prototype wins; ask Vernon about anything else.
2. Port first, improve second. Phase 1 is done when the new build is indistinguishable from the prototype, not better than it. Refactor into modules, but keep every number (timings, easing curves, shader constants, positions).
3. Keep the engine edition-agnostic: no page numbers, painting names or Ocean words in `src/`. If a page needs a new value, add it to `edition.json` and the schema.
4. One shader for the art. New effects (chop, cloud drift, soft focus, thread warp) are uniforms that default to off.
5. Vanilla TypeScript and Vite, no UI framework: the app is one full-screen scene with a few overlays. The only runtime dependencies are the PWA plugin and the fonts.
6. Everything personal stays on the device (local storage). Text from Release and Write in the sand is never stored.
7. Prototype quirks to fix, not copy: the mouse-drag image bug (fixed in Version 5: no draggable images in the stage), the `?page=` review jump (keep it, but only in development builds), and the recap list (it must fit 11 rows on the keepsake: use two columns).
8. Test each page with a Playwright walkthrough at 1440 × 900 and 390 × 780, as the prototype was tested, and add a screenshot to each pull request.
9. Do not commit 8000 px masters to Git without Git LFS. `public/editions/` is generated; add it to `.gitignore` unless the host needs it committed.
10. Ask before adding a new interaction type, changing the page rhythm, or changing any copy. Copy belongs to Vernon and Katherine.
