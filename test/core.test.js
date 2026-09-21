import assert from "node:assert/strict";
import test from "node:test";
import { detectBackground, removeBackground } from "../server/core.js";

function solidScene(width, height, background, foreground) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const color = x >= 2 && x < width - 2 && y >= 2 && y < height - 2 ? foreground : background;
      data.set([...color, 255], offset);
    }
  }
  return { data, width, height };
}

test("detects the dominant border color", () => {
  const image = solidScene(9, 9, [245, 245, 248], [220, 30, 40]);
  assert.equal(detectBackground(image).hex, "#f5f5f8");
});

test("removes a uniform background and preserves the subject", () => {
  const image = solidScene(9, 9, [255, 255, 255], [210, 20, 30]);
  const result = removeBackground(image, { backgroundColor: "#ffffff", tolerance: 15, refine: 0 });
  assert.equal(result.mode, "single");
  assert.equal(result.data[3], 0);
  const center = (4 * 9 + 4) * 4;
  assert.equal(result.data[center + 3], 255);
  assert.ok(result.transparentPixels > 0);
});

test("rejects invalid background colors", () => {
  const image = solidScene(5, 5, [255, 255, 255], [0, 0, 0]);
  assert.throws(() => removeBackground(image, { backgroundColor: "white" }), /#RRGGBB/);
});

test("recovers alpha from matching renders on two backgrounds", () => {
  const source = solidScene(9, 9, [255, 255, 255], [210, 20, 30]);
  const contrast = solidScene(9, 9, [0, 0, 0], [210, 20, 30]);
  const result = removeBackground(source, { contrastImage: contrast });
  const center = (4 * 9 + 4) * 4;
  assert.equal(result.mode, "dual");
  assert.equal(result.data[3], 0);
  assert.deepEqual(Array.from(result.data.slice(center, center + 4)), [210, 20, 30, 255]);
});
