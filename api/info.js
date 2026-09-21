import handler, { config } from "./[...path].js";

export { config };

export default function infoHandler(request, response) {
  request.url = "/v1/info";
  return handler(request, response);
}
