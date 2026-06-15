# NanoAlpha

Static browser app for extracting transparent PNG sprites from AI-generated images.

NanoAlpha starts with a single source image and can optionally use a second image with a contrasting background for better alpha recovery. All processing runs locally in the browser.

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

1. Upload a source image, or load the demo.
2. Tune the simple controls, or switch to Advanced for fine control.
3. Optionally add a second image with the same dimensions and a contrasting background.
4. Use Result, Alpha, and Edge previews to inspect the matte.
5. In Alpha mode, use Brush or Eraser for manual alpha overrides.
6. Download the PNG.

## Processing Modes

### Single Image

1. Probe the image border and cluster sampled colors in OKLab.
2. Pick the dominant edge color as the background estimate.
3. Build a perceptual distance map from the selected background color.
4. Flood fill background-like pixels from the image border.
5. Estimate alpha in the edge band with inverse compositing.
6. Decontaminate edge RGB and propagate foreground color along the contour.

### Two Images

When a compatible second image is added, NanoAlpha switches to difference matting:

```text
observed_diff = pixel_source - pixel_contrast
background_diff = bg_source - bg_contrast
alpha = 1 - observed_diff / background_diff
```

Foreground color is recovered from the source image, contrast image, or their average depending on the Advanced setting.

## Notes

- Manual Brush/Eraser edits are stored separately from automatic processing and are applied after either algorithm runs.
- Source and contrast images must have the same dimensions for two-image matting.
- Use Ctrl + scroll over the previews to zoom. Scrolling stays synchronized across source and output.

## Privacy

Processing runs locally in your browser. Images are not sent anywhere.

## License

© [Collider Interactive Studio](https://collider.hr) 2026 · [Privacy](https://collider.hr/privacy/) · [MIT](LICENSE)
