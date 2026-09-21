import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { normalizeRequestUrl } from "../api/[...path].js";
import { buildApp } from "../server/app.js";

function multipartBody(fields, files) {
  const boundary = "----nanoalpha-test-boundary";
  const chunks = [];
  for (const [name, value] of Object.entries(fields)) {
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
  }
  for (const file of files) {
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${file.name}"; filename="${file.filename}"\r\nContent-Type: ${file.type}\r\n\r\n`));
    chunks.push(file.data);
    chunks.push(Buffer.from("\r\n"));
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return { boundary, payload: Buffer.concat(chunks) };
}

test("health does not require authentication", async (context) => {
  const app = await buildApp({ apiKeys: ["test-key"] });
  context.after(() => app.close());
  const response = await app.inject({ method: "GET", url: "/health" });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().status, "ok");
});

test("Vercel adapter removes only the internal api prefix", () => {
  assert.equal(normalizeRequestUrl("/api/v1/remove-background?mode=auto"), "/v1/remove-background?mode=auto");
  assert.equal(normalizeRequestUrl("/health"), "/health");
});

test("processing endpoint requires a valid API key", async (context) => {
  const app = await buildApp({ apiKeys: ["test-key"] });
  context.after(() => app.close());
  const response = await app.inject({ method: "POST", url: "/v1/remove-background" });
  assert.equal(response.statusCode, 401);
  assert.equal(response.json().error.code, "UNAUTHORIZED");
});

test("returns a transparent PNG", async (context) => {
  const app = await buildApp({ apiKeys: ["test-key"] });
  context.after(() => app.close());
  const rgba = Buffer.alloc(9 * 9 * 4, 255);
  for (let y = 2; y < 7; y += 1) for (let x = 2; x < 7; x += 1) {
    const offset = (y * 9 + x) * 4;
    rgba.set([210, 20, 30, 255], offset);
  }
  const input = await sharp(rgba, { raw: { width: 9, height: 9, channels: 4 } }).png().toBuffer();
  const body = multipartBody({ background_color: "#ffffff", refine: "0" }, [
    { name: "image", filename: "input.png", type: "image/png", data: input }
  ]);
  const response = await app.inject({
    method: "POST",
    url: "/v1/remove-background",
    headers: {
      authorization: "Bearer test-key",
      "content-type": `multipart/form-data; boundary=${body.boundary}`
    },
    payload: body.payload
  });
  assert.equal(response.statusCode, 200, response.body);
  assert.equal(response.headers["content-type"], "image/png");
  const decoded = await sharp(response.rawPayload).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(decoded.data[3], 0);
  assert.equal(decoded.data[(4 * 9 + 4) * 4 + 3], 255);
});
