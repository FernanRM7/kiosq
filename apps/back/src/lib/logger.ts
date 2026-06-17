import pino from "pino";

const isVercel =
  process.env.VERCEL === "1" || process.env.AWS_LAMBDA_FUNCTION_NAME;

export const logger = pino(
  isVercel
    ? {}
    : {
        transport: {
          target: "pino-pretty",
        },
      }
);
