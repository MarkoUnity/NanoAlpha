export const openapi = {
  openapi: "3.1.0",
  info: {
    title: "NanoAlpha API",
    version: "1.0.0",
    description: "Remove solid or near-solid image backgrounds and return an RGBA PNG."
  },
  servers: [{ url: "https://api.nanoalpha.app" }],
  paths: {
    "/health": {
      get: { summary: "Service health", responses: { 200: { description: "Service is healthy" } } }
    },
    "/v1/remove-background": {
      post: {
        operationId: "removeBackground",
        summary: "Remove an image background",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["image"],
                properties: {
                  image: { type: "string", format: "binary" },
                  contrast_image: { type: "string", format: "binary", description: "Optional matching render on a different background." },
                  background_color: { type: "string", pattern: "^#[0-9A-Fa-f]{6}$", example: "#f0f0f4" },
                  contrast_background_color: { type: "string", pattern: "^#[0-9A-Fa-f]{6}$", example: "#111111" },
                  tolerance: { type: "number", minimum: 2, maximum: 140 },
                  edge_width: { type: "number", minimum: 1, maximum: 64 },
                  softness: { type: "number", minimum: 0, maximum: 90 },
                  refine: { type: "number", minimum: 0, maximum: 4 },
                  decontaminate: { type: "number", minimum: 0, maximum: 1 },
                  clip: { type: "number", minimum: 0, maximum: 32 },
                  fill_holes: { type: "boolean", default: true }
                }
              }
            }
          }
        },
        responses: {
          200: { description: "Transparent result", content: { "image/png": { schema: { type: "string", format: "binary" } } } },
          400: { description: "Invalid image or options" },
          401: { description: "Missing or invalid API key" },
          413: { description: "Image exceeds configured limits" },
          429: { description: "Rate limit exceeded" },
          503: { description: "Image processing capacity is temporarily full" }
        }
      }
    }
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "API key" }
    }
  }
};
