import { buildApp } from "./app.js";

const port = Number.parseInt(process.env.PORT || "8787", 10);
const host = process.env.HOST || "0.0.0.0";
const app = await buildApp({ logger: true });

try {
  await app.listen({ port, host });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
