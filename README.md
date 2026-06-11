# NanoAlpha

Extract transparent PNG sprites from AI-generated images using the **light / dark background plate** technique. Upload two identical renders (one on a light background, one on a dark background) and get a clean RGBA PNG — entirely in your browser.

## How it works

Many AI image tools cannot export transparency. A common workaround is to render the same subject twice:

1. **Light plate** — subject on a light (or white) background  
2. **Dark plate** — same subject on a dark (or black) background  

For each pixel, the difference between the two images reveals how much foreground vs. background is present. NanoAlpha uses **difference matting**:

```
observed_diff = pixel_light − pixel_dark
background_diff = bgLight − bgDark
alpha = 1 − observed_diff / background_diff   (per channel, then combined)
```

Foreground color is recovered by un-premultiplying from the chosen plate. You can tune plate colors when AI backgrounds are not pure `#fff` / `#000`.

### Pipeline

1. **Matting** — alpha extraction with configurable channel combine, foreground guard, and color recovery  
2. **Noise cleanup** — connected-component filtering to remove stray blobs; optional morphological pass  
3. **Alpha hardening** — crush very low alpha values (invisible on black preview but visible in GIMP / Unity)  
4. **Export** — lossless PNG download  

All processing uses Canvas `ImageData`; source images are cached in memory and never uploaded to a server.

## Features

- Adjustable **bgLight** / **bgDark** (sliders, color picker, eyedropper on thumbnails)  
- Live preview with debounced regeneration  
- Preview backgrounds: checkerboard, white, black  
- Blob removal and alpha hardening controls  
- Static single-page app — no build step, no dependencies  

## Usage

1. Open `index.html` in a browser, or serve the folder with any static host.  
2. Upload **light** and **dark** plate images (same dimensions, pixel-aligned; PNG recommended).  
3. Set background colors to match what the AI actually used.  
4. Tune matting and noise settings; preview updates automatically.  
5. Click **Download PNG**.

### Tips

- Use the **eyedropper** on a background area to sample plate colors.  
- **Foreground guard** helps keep dark hair/clothing opaque.  
- Raise **Alpha hardening** if the exported background still shows speckle in GIMP or Unity.  
- **Keep largest blob** works well for single-character sprites.

## Project structure

```
NanoAlpha/
├── index.html          # App (HTML, CSS, JS)
├── assets/             # Logos, promo images for Charmora section
└── README.md
```

## Hosting

Deploy as a static site:

| Platform | Notes |
|----------|--------|
| **GitHub Pages** | Settings → Pages → deploy from `main` / root |
| **Netlify / Vercel / Cloudflare Pages** | Point at repo or drag-and-drop folder |

No server or API keys required.

## Privacy

Processing runs **locally** in your browser. Images are not sent anywhere.

## License

© [Collider Interactive Studio](https://collider.hr) 2026
