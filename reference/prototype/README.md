# Prototype reference

These are the working prototypes the production build must match. Open them through a local server (they fetch files):

    cd reference/prototype && python3 -m http.server 8000
    open http://localhost:8000/ritual.html      (cover + pages 1-5 + closing)
    open http://localhost:8000/feel.html        (pages 9 and 10)
    open http://localhost:8000/compare.html     (small type study; column 4 "soft glass" was chosen)

Add `?page=N` and press Begin to jump to a page (ritual: 1-6, feel: 1-2).

Live versions: ritual = https://claude.ai/artifact/2fxGskX2YoHa4WMYNkpiNM (Version 5),
feel = https://claude.ai/artifact/D6FdSd4osfZyAtMF73m33b, compare = https://claude.ai/artifact/EcEi7kvzn5Ys92B2jdT3V2.
ritual.v3 (no soft glass) is the fallback look.

## Old prototype names -> production names

| Prototype file          | Production name      | Notes |
|-------------------------|----------------------|-------|
| img/r-cover.webp        | cover                | |
| img/r-golden.webp       | 01-golden-moon       | |
| img/r-dawn.webp         | 02-mint-moon-beach   | |
| img/r-bay.webp          | 03-moon-bay          | from the 8000 px master |
| img/r-mid.webp          | 04-midnight-ocean    | from the 8000 px master |
| img/r-lunar.webp        | 05-lunar-waves       | from the 8000 px master |
| img/r-waves.webp        | 09-moonlit-ocean     | from a 2576 px copy |
| img/r-clouds.webp       | 10-ocean-clouds      | from the 8000 px master |
| vid/m0                  | turn-01              | first-round clip, full length |
| vid/m1                  | turn-02              | full 5 s morph (trimmed version did not end on the still) |
| vid/m2                  | turn-03              | starts at 0.9 s of the original |
| vid/m3                  | turn-04              | starts at 0.4 s of the original |
| vid/m4                  | turn-05              | first 4.8 s of the original |
| vid/c5                  | fx-05-ribbon         | |
| pack/c3.json            | fx-03-dive frames    | 90 frames, 960 px WebP, base64 JSON (artifact hosting limits) |
| pack/c4.json            | fx-04-current frames | 72 frames, 960 px WebP |

In production, frame packs can be plain WebP files or a sprite; the JSON packing was only a hosting workaround.

## Where the tuned values live

The `SC` array near the top of the script in ritual.html and feel.html holds every per-page value
(focus, words, guide, moon, fx, tint). They are already copied into editions/ocean/edition.json.
