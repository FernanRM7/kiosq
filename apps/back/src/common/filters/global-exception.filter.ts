import { Catch, Logger } from "@nestjs/common";
import type { ArgumentsHost, LoggerService } from "@nestjs/common";
import type { Request } from "express";

import { HttpExceptionFilter } from "./http-exception.filter";

@Catch()
export class GlobalExceptionFilter extends HttpExceptionFilter {
  private readonly errorLogger: LoggerService;

  constructor(logger?: LoggerService) {
    super();
    this.errorLogger = logger ?? new Logger(GlobalExceptionFilter.name);
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();

    const message =
      exception instanceof Error ? exception.message : String(exception);
    const stack = exception instanceof Error ? exception.stack : undefined;

    this.errorLogger.error(
      {
        message,
        path: request.originalUrl,
        stack,
      },
      `Uncaught exception on ${request.method} ${request.originalUrl}`
    );

    HttpExceptionFilter.prototype.catch.call(this, exception, host);
  }
}
