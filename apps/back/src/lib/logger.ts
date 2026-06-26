import pino from "pino";

const isVercel =
  process.env.VERCEL === "1" || process.env.AWS_LAMBDA_FUNCTION_NAME;

export const logger = pino({
  redact: [
    "req.headers.authorization",
    "req.headers.cookie",
    "password",
    "token",
  ],
  ...(isVercel
    ? {}
    : {
        transport: {
          target: "pino-pretty",
        },
      }),
});
