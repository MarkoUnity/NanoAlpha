import handler, { config } from "./[...path].js";

export { config };

export default function removeBackgroundHandler(request, response) {
  request.url = "/v1/remove-background";
  return handler(request, response);
}
