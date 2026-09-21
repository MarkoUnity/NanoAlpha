const SQRT2 = Math.SQRT2;
const INF = 1e9;
const CHANNEL_EPSILON = 8;
const ALPHA_EPSILON = 1 / 255;

const SRGB_TO_LINEAR = new Float32Array(256);
for (let i = 0; i < 256; i += 1) {
  const c = i / 255;
  SRGB_TO_LINEAR[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, amount) {
  return a + (b - a) * amount;
}

function smoothstep(edge0, edge1, value) {
  if (edge0 === edge1) return value < edge0 ? 0 : 1;
  const amount = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return amount * amount * (3 - 2 * amount);
}

function linearToSrgb8(value) {
  const color = clamp(value, 0, 1);
  const srgb = color <= 0.0031308 ? color * 12.92 : 1.055 * Math.pow(color, 1 / 2.4) - 0.055;
  return clamp(Math.round(srgb * 255), 0, 255);
}

function rgbToOklab(r8, g8, b8) {
  const r = SRGB_TO_LINEAR[r8];
  const g = SRGB_TO_LINEAR[g8];
  const b = SRGB_TO_LINEAR[b8];
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const lRoot = Math.cbrt(l);
  const mRoot = Math.cbrt(m);
  const sRoot = Math.cbrt(s);
  return {
    l: 0.2104542553 * lRoot + 0.793617785 * mRoot - 0.0040720468 * sRoot,
    a: 1.9779984951 * lRoot - 2.428592205 * mRoot + 0.4505937099 * sRoot,
    b: 0.0259040371 * lRoot + 0.7827717662 * mRoot - 0.808675766 * sRoot
  };
}

function oklabDistance(sample, background) {
  const dl = (sample.l - background.l) * 1.2;
  const da = (sample.a - background.a) * 1.85;
  const db = (sample.b - background.b) * 1.85;
  return Math.sqrt(dl * dl + da * da + db * db) * 255;
}

function countBits(value) {
  let count = 0;
  for (let current = value; current; current >>= 1) count += current & 1;
  return count;
}

function assertImage(image, name = "image") {
  if (!image || !Number.isInteger(image.width) || !Number.isInteger(image.height)) {
    throw new TypeError(`${name} must include integer width and height`);
  }
  if (image.width < 1 || image.height < 1 || !image.data || image.data.length !== image.width * image.height * 4) {
    throw new TypeError(`${name} must contain width * height * 4 RGBA bytes`);
  }
}

export function parseHexColor(value) {
  if (typeof value !== "string" || !/^#[0-9a-f]{6}$/i.test(value)) {
    throw new TypeError("Background colors must use #RRGGBB format");
  }
  return {
    r: Number.parseInt(value.slice(1, 3), 16),
    g: Number.parseInt(value.slice(3, 5), 16),
    b: Number.parseInt(value.slice(5, 7), 16)
  };
}

function rgbToHex({ r, g, b }) {
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

export function detectBackground(image, probePercent = 0.5) {
  assertImage(image);
  const { data, width, height } = image;
  const thickness = Math.max(1, Math.round(Math.min(width, height) * probePercent / 100));
  const edgeEstimate = Math.max(1, 2 * thickness * width + 2 * thickness * height);
  const stride = Math.max(1, Math.ceil(Math.sqrt(edgeEstimate / 60000)));
  const samples = [];

  for (let y = 0; y < height; y += stride) {
    const top = y < thickness;
    const bottom = y >= height - thickness;
    for (let x = 0; x < width; x += stride) {
      const left = x < thickness;
      const right = x >= width - thickness;
      if (!top && !bottom && !left && !right) continue;
      const offset = (y * width + x) * 4;
      if (data[offset + 3] <= 1) continue;
      const r = data[offset];
      const g = data[offset + 1];
      const b = data[offset + 2];
      const lab = rgbToOklab(r, g, b);
      let side = 0;
      if (top) side |= 1;
      if (right) side |= 2;
      if (bottom) side |= 4;
      if (left) side |= 8;
      samples.push({ r, g, b, l: lab.l, a: lab.a, bb: lab.b, side });
    }
  }

  if (!samples.length) {
    return { rgb: { r: 240, g: 240, b: 244 }, hex: "#f0f0f4", uniformity: 0, tolerance: 28 };
  }

  const k = Math.min(5, samples.length);
  const centers = [samples[0]];
  while (centers.length < k) {
    let bestIndex = 0;
    let bestDistance = -1;
    for (let sampleIndex = 0; sampleIndex < samples.length; sampleIndex += 1) {
      let minDistance = INF;
      for (const center of centers) {
        const dl = samples[sampleIndex].l - center.l;
        const da = samples[sampleIndex].a - center.a;
        const db = samples[sampleIndex].bb - center.bb;
        minDistance = Math.min(minDistance, dl * dl + da * da + db * db);
      }
      if (minDistance > bestDistance) {
        bestDistance = minDistance;
        bestIndex = sampleIndex;
      }
    }
    centers.push(samples[bestIndex]);
  }

  const assignments = new Int8Array(samples.length);
  let sums = [];
  for (let iteration = 0; iteration < 8; iteration += 1) {
    sums = Array.from({ length: k }, () => ({ count: 0, l: 0, a: 0, bb: 0, r: 0, g: 0, b: 0, side: 0 }));
    for (let sampleIndex = 0; sampleIndex < samples.length; sampleIndex += 1) {
      let best = 0;
      let bestDistance = INF;
      for (let centerIndex = 0; centerIndex < k; centerIndex += 1) {
        const dl = samples[sampleIndex].l - centers[centerIndex].l;
        const da = samples[sampleIndex].a - centers[centerIndex].a;
        const db = samples[sampleIndex].bb - centers[centerIndex].bb;
        const distance = dl * dl + da * da + db * db;
        if (distance < bestDistance) {
          bestDistance = distance;
          best = centerIndex;
        }
      }
      assignments[sampleIndex] = best;
      const sum = sums[best];
      const sample = samples[sampleIndex];
      sum.count += 1;
      sum.l += sample.l;
      sum.a += sample.a;
      sum.bb += sample.bb;
      sum.r += sample.r;
      sum.g += sample.g;
      sum.b += sample.b;
      sum.side |= sample.side;
    }
    for (let index = 0; index < k; index += 1) {
      const sum = sums[index];
      if (sum.count) centers[index] = { l: sum.l / sum.count, a: sum.a / sum.count, bb: sum.bb / sum.count };
    }
  }

  const clusters = Array.from({ length: k }, () => ({ count: 0, distance: 0, r: 0, g: 0, b: 0, side: 0 }));
  for (let index = 0; index < samples.length; index += 1) {
    const id = assignments[index];
    const center = centers[id];
    const sample = samples[index];
    const dl = sample.l - center.l;
    const da = sample.a - center.a;
    const db = sample.bb - center.bb;
    clusters[id].count += 1;
    clusters[id].distance += dl * dl + da * da + db * db;
    clusters[id].r += sample.r;
    clusters[id].g += sample.g;
    clusters[id].b += sample.b;
    clusters[id].side |= sample.side;
  }

  let winner = clusters[0];
  let bestScore = -Infinity;
  for (const cluster of clusters) {
    if (!cluster.count) continue;
    const sides = countBits(cluster.side);
    const deviation = Math.sqrt(cluster.distance / cluster.count) * 255;
    const score = cluster.count * (sides >= 3 ? 1.35 : 0.88 + sides * 0.08) / (1 + deviation * 0.035);
    if (score > bestScore) {
      bestScore = score;
      winner = cluster;
    }
  }

  const rgb = {
    r: Math.round(winner.r / winner.count),
    g: Math.round(winner.g / winner.count),
    b: Math.round(winner.b / winner.count)
  };
  const deviation = Math.sqrt(winner.distance / winner.count) * 255;
  return {
    rgb,
    hex: rgbToHex(rgb),
    uniformity: clamp(100 - deviation * 2.1, 0, 100),
    tolerance: clamp(Math.round(deviation * 2.8 + 14), 8, 85)
  };
}

function buildEmptyMask(image) {
  const mask = new Uint8Array(image.width * image.height);
  for (let i = 0, offset = 0; i < mask.length; i += 1, offset += 4) mask[i] = image.data[offset + 3] <= 1 ? 1 : 0;
  return mask;
}

function buildDistanceMap(image, background, empty) {
  const distances = new Float32Array(image.width * image.height);
  const backgroundLab = rgbToOklab(background.r, background.g, background.b);
  for (let i = 0, offset = 0; i < distances.length; i += 1, offset += 4) {
    distances[i] = empty[i] ? 0 : oklabDistance(rgbToOklab(image.data[offset], image.data[offset + 1], image.data[offset + 2]), backgroundLab);
  }
  return distances;
}

function floodBackground(distances, width, height, tolerance, fillInternal, empty) {
  const pixelCount = width * height;
  const mask = new Uint8Array(pixelCount);
  const queue = new Int32Array(pixelCount);
  let head = 0;
  let tail = 0;
  const enqueue = (index) => {
    if (!mask[index] && (empty[index] || distances[index] <= tolerance)) {
      mask[index] = 1;
      queue[tail++] = index;
    }
  };
  for (let x = 0; x < width; x += 1) {
    enqueue(x);
    enqueue((height - 1) * width + x);
  }
  for (let y = 0; y < height; y += 1) {
    enqueue(y * width);
    enqueue(y * width + width - 1);
  }
  while (head < tail) {
    const index = queue[head++];
    const x = index % width;
    if (x > 0) enqueue(index - 1);
    if (x < width - 1) enqueue(index + 1);
    if (index >= width) enqueue(index - width);
    if (index < pixelCount - width) enqueue(index + width);
  }
  const outerMask = mask.slice();

  if (fillInternal) {
    const visited = new Uint8Array(pixelCount);
    const component = new Int32Array(pixelCount);
    for (let start = 0; start < pixelCount; start += 1) {
      if (visited[start] || mask[start] || distances[start] > tolerance * 0.7) continue;
      let count = 0;
      let sum = 0;
      let touchesEdge = false;
      head = 0;
      tail = 0;
      visited[start] = 1;
      queue[tail++] = start;
      while (head < tail) {
        const current = queue[head++];
        component[count++] = current;
        sum += distances[current];
        const x = current % width;
        const y = (current - x) / width;
        if (x === 0 || y === 0 || x === width - 1 || y === height - 1) touchesEdge = true;
        const neighbors = [current - 1, current + 1, current - width, current + width];
        for (let n = 0; n < neighbors.length; n += 1) {
          const next = neighbors[n];
          if (next < 0 || next >= pixelCount || visited[next] || mask[next]) continue;
          if ((n === 0 && x === 0) || (n === 1 && x === width - 1)) continue;
          if (distances[next] <= tolerance * 0.98) {
            visited[next] = 1;
            queue[tail++] = next;
          }
        }
      }
      if (!touchesEdge && count > 4 && sum / count <= tolerance * 0.62) {
        for (let index = 0; index < count; index += 1) mask[component[index]] = 1;
      }
    }
  }
  return { mask, outerMask };
}

function chamferDistance(mask, width, height, target) {
  const distances = new Float32Array(width * height);
  for (let i = 0; i < distances.length; i += 1) distances[i] = mask[i] === target ? 0 : INF;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      let best = distances[index];
      if (x > 0) best = Math.min(best, distances[index - 1] + 1);
      if (y > 0) best = Math.min(best, distances[index - width] + 1);
      if (x > 0 && y > 0) best = Math.min(best, distances[index - width - 1] + SQRT2);
      if (x < width - 1 && y > 0) best = Math.min(best, distances[index - width + 1] + SQRT2);
      distances[index] = best;
    }
  }
  for (let y = height - 1; y >= 0; y -= 1) {
    for (let x = width - 1; x >= 0; x -= 1) {
      const index = y * width + x;
      let best = distances[index];
      if (x < width - 1) best = Math.min(best, distances[index + 1] + 1);
      if (y < height - 1) best = Math.min(best, distances[index + width] + 1);
      if (x < width - 1 && y < height - 1) best = Math.min(best, distances[index + width + 1] + SQRT2);
      if (x > 0 && y < height - 1) best = Math.min(best, distances[index + width - 1] + SQRT2);
      distances[index] = best;
    }
  }
  return distances;
}

function buildForegroundSeeds(mask, distToBackground, distances, tolerance, softness, edgeWidth) {
  const seeds = new Uint8Array(mask.length);
  let count = 0;
  for (let i = 0; i < mask.length; i += 1) {
    if (!mask[i] && distToBackground[i] >= Math.max(2, edgeWidth * 0.85) && (distances[i] >= tolerance + softness * 0.2 || distToBackground[i] > edgeWidth * 1.35)) {
      seeds[i] = 1;
      count += 1;
    }
  }
  if (count < Math.min(32, Math.max(1, mask.length * 0.01))) {
    for (let i = 0; i < mask.length; i += 1) seeds[i] = mask[i] ? 0 : 1;
  }
  return seeds;
}

function propagateNearestForeground(image, seeds) {
  const { data, width, height } = image;
  const count = width * height;
  const distance = new Float32Array(count);
  const r = new Uint8Array(count);
  const g = new Uint8Array(count);
  const b = new Uint8Array(count);
  for (let i = 0, offset = 0; i < count; i += 1, offset += 4) {
    distance[i] = seeds[i] ? 0 : INF;
    if (seeds[i]) [r[i], g[i], b[i]] = [data[offset], data[offset + 1], data[offset + 2]];
  }
  const copy = (index, neighbor, cost) => {
    const candidate = distance[neighbor] + cost;
    if (candidate < distance[index]) {
      distance[index] = candidate;
      r[index] = r[neighbor];
      g[index] = g[neighbor];
      b[index] = b[neighbor];
    }
  };
  for (let pass = 0; pass < 2; pass += 1) {
    for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (x > 0) copy(index, index - 1, 1);
      if (y > 0) copy(index, index - width, 1);
      if (x > 0 && y > 0) copy(index, index - width - 1, SQRT2);
      if (x < width - 1 && y > 0) copy(index, index - width + 1, SQRT2);
    }
    for (let y = height - 1; y >= 0; y -= 1) for (let x = width - 1; x >= 0; x -= 1) {
      const index = y * width + x;
      if (x < width - 1) copy(index, index + 1, 1);
      if (y < height - 1) copy(index, index + width, 1);
      if (x < width - 1 && y < height - 1) copy(index, index + width + 1, SQRT2);
      if (x > 0 && y < height - 1) copy(index, index + width - 1, SQRT2);
    }
  }
  return { r, g, b };
}

function estimateAlpha(image, options) {
  const { data, width, height } = image;
  const { mask, distances, nearest, distToBackground, distToForeground, tolerance, softness, edgeWidth, background } = options;
  const alpha = new Float32Array(width * height);
  const br = SRGB_TO_LINEAR[background.r];
  const bg = SRGB_TO_LINEAR[background.g];
  const bb = SRGB_TO_LINEAR[background.b];
  for (let i = 0, offset = 0; i < alpha.length; i += 1, offset += 4) {
    const near = mask[i] ? distToForeground[i] <= edgeWidth : distToBackground[i] <= edgeWidth;
    if (!near) {
      alpha[i] = mask[i] ? 0 : 1;
      continue;
    }
    const cr = SRGB_TO_LINEAR[data[offset]];
    const cg = SRGB_TO_LINEAR[data[offset + 1]];
    const cb = SRGB_TO_LINEAR[data[offset + 2]];
    const vr = SRGB_TO_LINEAR[nearest.r[i]] - br;
    const vg = SRGB_TO_LINEAR[nearest.g[i]] - bg;
    const vb = SRGB_TO_LINEAR[nearest.b[i]] - bb;
    const denominator = vr * vr + vg * vg + vb * vb;
    const colorAlpha = smoothstep(tolerance * 0.18, tolerance + Math.max(1, softness), distances[i]);
    let projected = denominator > 0.00002 ? ((cr - br) * vr + (cg - bg) * vg + (cb - bb) * vb) / denominator : colorAlpha;
    projected = clamp(projected, 0, 1);
    alpha[i] = mask[i]
      ? Math.min(projected, colorAlpha)
      : clamp(Math.max(projected * 0.9 + colorAlpha * 0.1, clamp(distToBackground[i] / Math.max(1, edgeWidth * 0.65), 0, 1) * 0.35), 0, 1);
  }
  return alpha;
}

function refineAlpha(alpha, image, mask, distToBackground, distToForeground, edgeWidth, iterations) {
  if (!iterations) return alpha;
  const { data, width, height } = image;
  let source = alpha;
  let destination = new Float32Array(alpha.length);
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    destination.set(source);
    for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const near = mask[index] ? distToForeground[index] <= edgeWidth + 1 : distToBackground[index] <= edgeWidth + 1;
      if (!near) {
        destination[index] = mask[index] ? 0 : 1;
        continue;
      }
      const offset = index * 4;
      let sum = 0;
      let weightSum = 0;
      for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const neighbor = ny * width + nx;
        const neighborOffset = neighbor * 4;
        const dr = data[offset] - data[neighborOffset];
        const dg = data[offset + 1] - data[neighborOffset + 1];
        const db = data[offset + 2] - data[neighborOffset + 2];
        const weight = Math.exp(-(dr * dr + dg * dg + db * db) / (42 * 42 * 2)) * (dx === 0 && dy === 0 ? 1.4 : (dx && dy ? 0.72 : 1));
        sum += source[neighbor] * weight;
        weightSum += weight;
      }
      destination[index] = clamp(sum / Math.max(0.0001, weightSum), 0, 1);
    }
    [source, destination] = [destination, source];
  }
  return source;
}

function renderSingle(image, options) {
  const { data, width, height } = image;
  const { alpha, mask, outerMask, distances, distToOuterBackground, distToForeground, nearest, background, tolerance, softness, edgeWidth, decontaminate, clip } = options;
  const output = new Uint8ClampedArray(data.length);
  const br = SRGB_TO_LINEAR[background.r];
  const bg = SRGB_TO_LINEAR[background.g];
  const bb = SRGB_TO_LINEAR[background.b];
  let transparentPixels = 0;
  for (let i = 0, offset = 0; i < alpha.length; i += 1, offset += 4) {
    let amount = alpha[i] * 255 <= clip ? 0 : clamp(alpha[i], 0, 1);
    if (data[offset + 3] <= 1) amount = 0;
    let r = SRGB_TO_LINEAR[data[offset]];
    let g = SRGB_TO_LINEAR[data[offset + 1]];
    let b = SRGB_TO_LINEAR[data[offset + 2]];
    const nearForeground = !mask[i] && distToOuterBackground[i] <= edgeWidth;
    const nearBackground = mask[i] && distToForeground[i] <= edgeWidth;
    if (amount > 0 && decontaminate > 0 && (nearForeground || nearBackground)) {
      if (amount < 0.995) {
        const safe = Math.max(amount, 0.001);
        const strength = decontaminate * clamp((1 - amount) * 1.65 + 0.26, 0, 1);
        r = lerp(r, clamp((r - (1 - safe) * br) / safe, 0, 1), strength);
        g = lerp(g, clamp((g - (1 - safe) * bg) / safe, 0, 1), strength);
        b = lerp(b, clamp((b - (1 - safe) * bb) / safe, 0, 1), strength);
      }
      let halo = clamp(1 - distances[i] / (tolerance + softness + 1), 0, 1);
      halo *= mask[i] ? 0.35 : clamp(1 - distToOuterBackground[i] / (edgeWidth + 1), 0, 1);
      const strength = decontaminate * halo * 0.58;
      r = lerp(r, SRGB_TO_LINEAR[nearest.r[i]], strength);
      g = lerp(g, SRGB_TO_LINEAR[nearest.g[i]], strength);
      b = lerp(b, SRGB_TO_LINEAR[nearest.b[i]], strength);
    }
    output[offset] = amount ? linearToSrgb8(r) : 0;
    output[offset + 1] = amount ? linearToSrgb8(g) : 0;
    output[offset + 2] = amount ? linearToSrgb8(b) : 0;
    output[offset + 3] = Math.round(amount * 255);
    if (!output[offset + 3]) transparentPixels += 1;
  }
  return { data: output, width, height, transparentPixels };
}

function processDual(source, contrast, options) {
  if (source.width !== contrast.width || source.height !== contrast.height) throw new TypeError("contrast_image dimensions must match image dimensions");
  const output = new Uint8ClampedArray(source.data.length);
  const backgroundDifference = [
    options.background.r - options.contrastBackground.r,
    options.background.g - options.contrastBackground.g,
    options.background.b - options.contrastBackground.b
  ];
  if (backgroundDifference.every((value) => Math.abs(value) < CHANNEL_EPSILON)) throw new TypeError("Source and contrast background colors are too similar");
  let transparentPixels = 0;
  for (let offset = 0; offset < output.length; offset += 4) {
    let alphaMin = 1;
    let alphaSum = 0;
    let count = 0;
    for (let channel = 0; channel < 3; channel += 1) {
      if (Math.abs(backgroundDifference[channel]) < CHANNEL_EPSILON) continue;
      const observed = source.data[offset + channel] - contrast.data[offset + channel];
      const channelAlpha = clamp(1 - observed / backgroundDifference[channel], 0, 1);
      alphaMin = Math.min(alphaMin, channelAlpha);
      alphaSum += channelAlpha;
      count += 1;
    }
    let alpha = count ? (options.dualCombine === "average" ? alphaSum / count : alphaMin) : 1;
    if (alpha < options.dualCutoff) alpha = 0;
    if (alpha <= ALPHA_EPSILON) {
      transparentPixels += 1;
      continue;
    }
    const inverse = 1 - alpha;
    const background = [options.background.r, options.background.g, options.background.b];
    for (let channel = 0; channel < 3; channel += 1) {
      output[offset + channel] = clamp(Math.round((source.data[offset + channel] - inverse * background[channel]) / alpha), 0, 255);
    }
    output[offset + 3] = Math.round(alpha * 255);
  }
  return { data: output, width: source.width, height: source.height, transparentPixels };
}

export function removeBackground(image, userOptions = {}) {
  assertImage(image);
  const detection = detectBackground(image, userOptions.probePercent ?? 0.5);
  const background = userOptions.backgroundColor ? parseHexColor(userOptions.backgroundColor) : detection.rgb;
  const tolerance = clamp(userOptions.tolerance ?? detection.tolerance, 2, 140);
  const edgeWidth = clamp(userOptions.edgeWidth ?? 5, 1, 64);
  const softness = clamp(userOptions.softness ?? 18, 0, 90);
  const refine = clamp(userOptions.refine ?? 2, 0, 4);
  const decontaminate = clamp(userOptions.decontaminate ?? 0.65, 0, 1);
  const clip = clamp(userOptions.clip ?? 2, 0, 32);

  if (userOptions.contrastImage) {
    assertImage(userOptions.contrastImage, "contrastImage");
    const contrastDetection = detectBackground(userOptions.contrastImage, userOptions.probePercent ?? 0.5);
    return {
      ...processDual(image, userOptions.contrastImage, {
        background,
        contrastBackground: userOptions.contrastBackgroundColor ? parseHexColor(userOptions.contrastBackgroundColor) : contrastDetection.rgb,
        dualCutoff: clamp(userOptions.dualCutoff ?? 2 / 255, 0, 1),
        dualCombine: userOptions.dualCombine ?? "min"
      }),
      mode: "dual",
      background: rgbToHex(background),
      contrastBackground: userOptions.contrastBackgroundColor ?? contrastDetection.hex
    };
  }

  const empty = buildEmptyMask(image);
  const distances = buildDistanceMap(image, background, empty);
  const flood = floodBackground(distances, image.width, image.height, tolerance, userOptions.fillHoles ?? true, empty);
  const distToBackground = chamferDistance(flood.mask, image.width, image.height, 1);
  const distToOuterBackground = chamferDistance(flood.outerMask, image.width, image.height, 1);
  const distToForeground = chamferDistance(flood.mask, image.width, image.height, 0);
  const nearest = propagateNearestForeground(image, buildForegroundSeeds(flood.mask, distToBackground, distances, tolerance, softness, edgeWidth));
  let alpha = estimateAlpha(image, { mask: flood.mask, distances, nearest, distToBackground, distToForeground, tolerance, softness, edgeWidth, background });
  alpha = refineAlpha(alpha, image, flood.mask, distToBackground, distToForeground, edgeWidth, refine);
  return {
    ...renderSingle(image, { alpha, mask: flood.mask, outerMask: flood.outerMask, distances, distToOuterBackground, distToForeground, nearest, background, tolerance, softness, edgeWidth, decontaminate, clip }),
    mode: "single",
    background: rgbToHex(background),
    uniformity: detection.uniformity
  };
}
