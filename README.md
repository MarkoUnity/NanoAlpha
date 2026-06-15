# NanoAlpha

Static browser app for extracting transparent PNG sprites from AI-generated images.

NanoAlpha removes backgrounds from a **single source image** and exports a clean RGBA PNG. You can also add an optional second image with a contrasting background for higher-quality alpha recovery. All processing runs locally in your browser — no uploads, no build step, no dependencies.

## Features

- **Single-image matting** — remove a solid or near-solid background from one render using OKLab color distance, border flood fill, and edge alpha estimation
- **Optional two-image matting** — add a contrast plate (same dimensions, different background) for difference-based alpha recovery
- **Simple and Advanced controls** — three sliders for everyday tuning, or full access to probe size, tolerance, matte width, decontamination, and dual-image options
- **Auto background detection** — samples the image border and picks the dominant background color; **Auto** can also tune tolerance from the image
- **Result, Alpha, and Edge previews** — inspect the final composite, alpha channel, and edge band side by side
- **Alpha brush and eraser** — paint manual alpha overrides on top of the automatic matte, with undo and reset
- **Output background** — preview on checkerboard or a solid color
- **Load demo** — reload the bundled test image and reset processing settings to defaults
- **PNG download** — export the processed result with alpha

## Run

Serve the folder with any static server:

```bash
python3 -m http.server 4173
```

Then open:

```text
http://localhost:4173/
```

Uploaded images can usually be processed even when opening `index.html` directly, but the bundled demo image in `assets/test-image.png` should be loaded over `localhost`. Some browsers allow drawing local `file://` images to canvas but block `getImageData()`, which makes the source preview appear while the processed result stays empty.

## Workflow

1. Upload a source image, or click **Load demo**.
2. Set the background color manually or use **Auto** to detect it from the image border.
3. Tune **Remove background**, **Edge cleanup**, and **Edge softness** in Simple mode, or switch to Advanced for fine control.
4. Optionally add a **Contrast image** — the same render on a different background, with matching dimensions.
5. Switch between **Result**, **Alpha**, and **Edge** previews to inspect the matte.
6. In **Alpha** mode, use **Brush** or **Eraser** to fix missed areas or stray transparency. **Undo** and **Reset** restore automatic processing.
7. Choose checkerboard or solid **Output bg** for preview.
8. Click **Download PNG**.

**Load demo** reloads the bundled test image and resets all background-removal settings to their defaults.

## Processing Modes

### Single Image

The default path works with one source image on a fairly uniform background:

1. Probe the image border and cluster sampled colors in OKLab.
2. Pick the dominant edge color as the background estimate.
3. Build a perceptual distance map from the selected background color.
4. Flood fill background-like pixels from the image border.
5. Estimate alpha in the edge band with inverse compositing.
6. Decontaminate edge RGB and propagate foreground color along the contour.

### Two Images

When a compatible contrast image is added, NanoAlpha switches to difference matting:

```text
observed_diff = pixel_source - pixel_contrast
background_diff = bg_source - bg_contrast
alpha = 1 - observed_diff / background_diff
```

Foreground color is recovered from the source image, contrast image, or their average depending on the Advanced setting.

## Alpha Editing

Manual edits in Alpha mode are stored separately from the automatic matte:

- **Brush** adds opacity where the automatic pass was too aggressive
- **Eraser** removes opacity from leftover background or halos
- Edits are applied after either single-image or two-image processing runs
- **Undo** steps back through brush strokes; **Reset** clears all manual overrides

## Notes

- Source and contrast images must have the same dimensions for two-image matting.
- Use **Ctrl + scroll** over the previews to zoom. Scrolling stays synchronized across source and output.
- Simple sliders drive the underlying Advanced parameters; switching modes does not lose your settings.

## Privacy

Processing runs locally in your browser. Images are not sent anywhere.

## License

© [Collider Interactive Studio](https://collider.hr) 2026 · [Privacy](https://collider.hr/privacy/) · [MIT](LICENSE)
