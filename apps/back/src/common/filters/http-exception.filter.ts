import { Catch, HttpException, HttpStatus } from "@nestjs/common";
import type { ArgumentsHost, ExceptionFilter } from "@nestjs/common";
import type { Request, Response } from "express";

import { errorResponse } from "../responses/api-response.helper";

interface ExceptionPayload {
  code?: string;
  details?: unknown;
  error?: string;
  message?: string | string[];
  statusCode?: number;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();
    const statusCode = this.getStatusCode(exception);
    const payload = this.getExceptionPayload(exception);

    response.status(statusCode).json(
      errorResponse({
        code: this.getErrorCode(payload, statusCode),
        details: this.getDetails(payload),
        message: this.getMessage(payload, statusCode),
        path: request.originalUrl,
        statusCode,
        timestamp: new Date().toISOString(),
      })
    );
  }

  private getStatusCode(exception: unknown): number {
    if (exception instanceof HttpException) {
      return exception.getStatus();
    }

    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private getExceptionPayload(exception: unknown): ExceptionPayload | string {
    if (!(exception instanceof HttpException)) {
      return "Internal server error";
    }

    return exception.getResponse() as ExceptionPayload | string;
  }

  private getErrorCode(
    payload: ExceptionPayload | string,
    statusCode: number
  ): string {
    if (typeof payload === "object" && typeof payload.code === "string") {
      return payload.code;
    }

    if (typeof payload === "object" && typeof payload.error === "string") {
      return payload.error.toUpperCase().replaceAll(" ", "_");
    }

    return HttpStatus[statusCode] ?? `HTTP_${statusCode}`;
  }

  private getMessage(
    payload: ExceptionPayload | string,
    statusCode: number
  ): string {
    if (statusCode === HttpStatus.INTERNAL_SERVER_ERROR) {
      return "Internal server error";
    }

    if (typeof payload === "string") {
      return payload;
    }

    if (typeof payload.message === "string") {
      return payload.message;
    }

    if (Array.isArray(payload.message)) {
      return payload.message.join(", ");
    }

    return "Request failed";
  }

  private getDetails(payload: ExceptionPayload | string): unknown {
    if (typeof payload !== "object") {
      return;
    }

    if (payload.details) {
      return payload.details;
    }

    if (Array.isArray(payload.message)) {
      return payload.message;
    }

    return undefined;
  }
}
