import { Injectable } from "@nestjs/common";
import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
} from "@nestjs/common";
import type { Request } from "express";
import { map } from "rxjs";
import type { Observable } from "rxjs";

import {
  isApiResponse,
  successResponse,
} from "../responses/api-response.helper";

const SWAGGER_PREFIXES = ["/api-docs", "/api-docs-json"];

@Injectable()
export class ApiResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();

    if (SWAGGER_PREFIXES.some((p) => request.url.startsWith(p))) {
      return next.handle();
    }

    return next.handle().pipe(
      map((data: unknown) => {
        if (isApiResponse(data)) {
          return data;
        }

        return successResponse(data ?? null);
      })
    );
  }
}
