import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const handlerModule = require("../apps/back/dist/main.js");
const handler =
  typeof handlerModule === "function" ? handlerModule : handlerModule?.default;

if (typeof handler !== "function") {
  throw new TypeError("Vercel API handler is not a function");
}

export default handler;
