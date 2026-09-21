import Fastify from "fastify";
import multipart from "@fastify/multipart";
import sharp from "sharp";
import { removeBackground } from "./core.js";
import { openapi } from "./openapi.js";

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function httpError(statusCode, code, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function readNumber(fields, name, limits) {
  if (fields[name] === undefined || fields[name] === "") return undefined;
  const value = Number(fields[name]);
  if (!Number.isFinite(value) || value < limits[0] || value > limits[1]) {
    throw httpError(400, "INVALID_OPTION", `${name} must be between ${limits[0]} and ${limits[1]}`);
  }
  return value;
}

function readBoolean(fields, name) {
  if (fields[name] === undefined || fields[name] === "") return undefined;
  if (fields[name] === "true" || fields[name] === "1") return true;
  if (fields[name] === "false" || fields[name] === "0") return false;
  throw httpError(400, "INVALID_OPTION", `${name} must be true or false`);
}

function readColor(fields, name) {
  const value = fields[name];
  if (value === undefined || value === "") return undefined;
  if (!/^#[0-9a-f]{6}$/i.test(value)) throw httpError(400, "INVALID_OPTION", `${name} must use #RRGGBB format`);
  return value.toLowerCase();
}

async function decodeImage(buffer, maximumPixels) {
  try {
    const decoded = await sharp(buffer, { limitInputPixels: maximumPixels, sequentialRead: true })
      .autoOrient()
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    if (decoded.info.width * decoded.info.height > maximumPixels) {
      throw httpError(413, "IMAGE_TOO_LARGE", `Decoded image exceeds ${maximumPixels} pixels`);
    }
    return {
      data: new Uint8ClampedArray(decoded.data.buffer, decoded.data.byteOffset, decoded.data.byteLength),
      width: decoded.info.width,
      height: decoded.info.height
    };
  } catch (error) {
    if (error.statusCode) throw error;
    if (/pixel limit|Input image exceeds/i.test(error.message)) {
      throw httpError(413, "IMAGE_TOO_LARGE", `Decoded image exceeds ${maximumPixels} pixels`);
    }
    throw httpError(400, "INVALID_IMAGE", "The uploaded file is not a valid supported image");
  }
}

function apiKeysFromEnvironment(environment) {
  const configured = (environment.NANOALPHA_API_KEYS || "")
    .split(",")
    .map((key) => key.trim())
    .filter(Boolean);
  if (configured.length) return configured;
  if (environment.NODE_ENV === "production") {
    throw new Error("NANOALPHA_API_KEYS must be configured in production");
  }
  return ["nanoalpha-dev-key"];
}

export async function buildApp(options = {}) {
  const environment = options.environment ?? process.env;
  const maximumFileBytes = positiveInteger(environment.NANOALPHA_MAX_FILE_BYTES, 20 * 1024 * 1024);
  const maximumPixels = positiveInteger(environment.NANOALPHA_MAX_PIXELS, 25_000_000);
  const requestsPerMinute = positiveInteger(environment.NANOALPHA_RATE_LIMIT_PER_MINUTE, 60);
  const maximumConcurrent = positiveInteger(environment.NANOALPHA_MAX_CONCURRENT, 2);
  const apiKeys = new Set(options.apiKeys ?? apiKeysFromEnvironment(environment));
  const rateBuckets = new Map();
  let activeJobs = 0;
  const app = Fastify({
    logger: options.logger ?? false,
    bodyLimit: maximumFileBytes * 2 + 1024 * 1024,
    requestTimeout: 30_000,
    connectionTimeout: 10_000
  });

  await app.register(multipart, {
    limits: { fileSize: maximumFileBytes, files: 2, fields: 12, parts: 14 }
  });

  app.addHook("onRequest", async (request) => {
    if (!request.url.startsWith("/v1/")) return;
    const authorization = request.headers.authorization || "";
    const key = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
    if (!key || !apiKeys.has(key)) throw httpError(401, "UNAUTHORIZED", "Missing or invalid API key");

    const now = Date.now();
    const bucket = rateBuckets.get(key);
    if (!bucket || now - bucket.startedAt >= 60_000) {
      rateBuckets.set(key, { startedAt: now, count: 1 });
      return;
    }
    bucket.count += 1;
    if (bucket.count > requestsPerMinute) {
      const retryAfter = Math.max(1, Math.ceil((bucket.startedAt + 60_000 - now) / 1000));
      const error = httpError(429, "RATE_LIMITED", "Rate limit exceeded");
      error.retryAfter = retryAfter;
      throw error;
    }
  });

  app.addHook("preHandler", async (request) => {
    if (request.method !== "POST" || request.url !== "/v1/remove-background") return;
    if (activeJobs >= maximumConcurrent) {
      const error = httpError(503, "CAPACITY_EXCEEDED", "Image processing capacity is temporarily full");
      error.retryAfter = 1;
      throw error;
    }
    activeJobs += 1;
    request.nanoAlphaJobSlot = true;
  });

  app.addHook("onResponse", async (request) => {
    if (request.nanoAlphaJobSlot) {
      activeJobs = Math.max(0, activeJobs - 1);
      request.nanoAlphaJobSlot = false;
    }
  });

  app.get("/health", async () => ({ status: "ok", service: "nanoalpha-api", version: "1.0.0" }));
  app.get("/openapi.json", async (_request, reply) => reply.type("application/json").send(openapi));

  app.post("/v1/remove-background", async (request, reply) => {
    if (!request.isMultipart()) throw httpError(415, "UNSUPPORTED_MEDIA_TYPE", "Use multipart/form-data");
    const fields = {};
    const files = {};

    try {
      for await (const part of request.parts()) {
        if (part.type === "file") {
          if (!ALLOWED_IMAGE_TYPES.has(part.mimetype)) {
            part.file.resume();
            throw httpError(415, "UNSUPPORTED_IMAGE_TYPE", "Supported image types are PNG, JPEG and WebP");
          }
          if (part.fieldname !== "image" && part.fieldname !== "contrast_image") {
            part.file.resume();
            throw httpError(400, "UNEXPECTED_FILE", `Unexpected file field: ${part.fieldname}`);
          }
          if (files[part.fieldname]) {
            part.file.resume();
            throw httpError(400, "DUPLICATE_FILE", `${part.fieldname} may only be supplied once`);
          }
          files[part.fieldname] = await part.toBuffer();
          if (part.file.truncated) throw httpError(413, "FILE_TOO_LARGE", `Each image must be at most ${maximumFileBytes} bytes`);
        } else {
          fields[part.fieldname] = String(part.value);
        }
      }
    } catch (error) {
      if (error.statusCode) throw error;
      if (error.code?.startsWith("FST_REQ_FILE_TOO_LARGE") || error.code?.startsWith("FST_FILES_LIMIT")) {
        throw httpError(413, "UPLOAD_LIMIT_EXCEEDED", "Upload exceeds the configured limits");
      }
      throw error;
    }

    if (!files.image) throw httpError(400, "IMAGE_REQUIRED", "The image file field is required");
    const source = await decodeImage(files.image, maximumPixels);
    const contrast = files.contrast_image ? await decodeImage(files.contrast_image, maximumPixels) : undefined;

    let result;
    try {
      result = removeBackground(source, {
        contrastImage: contrast,
        backgroundColor: readColor(fields, "background_color"),
        contrastBackgroundColor: readColor(fields, "contrast_background_color"),
        tolerance: readNumber(fields, "tolerance", [2, 140]),
        edgeWidth: readNumber(fields, "edge_width", [1, 64]),
        softness: readNumber(fields, "softness", [0, 90]),
        refine: readNumber(fields, "refine", [0, 4]),
        decontaminate: readNumber(fields, "decontaminate", [0, 1]),
        clip: readNumber(fields, "clip", [0, 32]),
        fillHoles: readBoolean(fields, "fill_holes")
      });
    } catch (error) {
      if (error instanceof TypeError) throw httpError(400, "INVALID_PROCESSING_REQUEST", error.message);
      throw error;
    }

    const output = await sharp(Buffer.from(result.data.buffer, result.data.byteOffset, result.data.byteLength), {
      raw: { width: result.width, height: result.height, channels: 4 }
    }).png({ compressionLevel: 9 }).toBuffer();

    return reply
      .header("Content-Disposition", 'inline; filename="nanoalpha.png"')
      .header("Cache-Control", "no-store")
      .header("X-NanoAlpha-Mode", result.mode)
      .header("X-NanoAlpha-Background", result.background)
      .header("X-NanoAlpha-Width", result.width)
      .header("X-NanoAlpha-Height", result.height)
      .type("image/png")
      .send(output);
  });

  app.setErrorHandler((error, request, reply) => {
    if (request.nanoAlphaJobSlot) {
      activeJobs = Math.max(0, activeJobs - 1);
      request.nanoAlphaJobSlot = false;
    }
    const statusCode = error.statusCode >= 400 && error.statusCode < 600 ? error.statusCode : 500;
    if (error.retryAfter) reply.header("Retry-After", error.retryAfter);
    if (statusCode >= 500) request.log.error(error);
    reply.status(statusCode).send({
      error: {
        code: statusCode === 500 ? "INTERNAL_ERROR" : (error.code || "REQUEST_ERROR"),
        message: statusCode === 500 ? "Image processing failed" : error.message,
        request_id: request.id
      }
    });
  });

  return app;
}
