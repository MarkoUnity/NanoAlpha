import { buildApp } from "../server/app.js";

let applicationPromise;

async function getApplication() {
  if (!applicationPromise) {
    applicationPromise = buildApp({ logger: true }).then(async (application) => {
      await application.ready();
      return application;
    });
  }
  return applicationPromise;
}

export const config = {
  maxDuration: 60
};

export function normalizeRequestUrl(value) {
  const url = new URL(value, "http://nanoalpha.local");
  if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
    url.pathname = url.pathname.slice(4) || "/";
  }
  return `${url.pathname}${url.search}`;
}

export default async function handler(request, response) {
  request.url = normalizeRequestUrl(request.url);
  const application = await getApplication();
  return new Promise((resolve, reject) => {
    response.once("finish", resolve);
    response.once("error", reject);
    application.server.emit("request", request, response);
  });
}
