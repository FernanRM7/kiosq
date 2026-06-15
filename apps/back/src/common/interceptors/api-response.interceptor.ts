import { Injectable } from "@nestjs/common";
import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
} from "@nestjs/common";
import { map } from "rxjs";
import type { Observable } from "rxjs";

import {
  isApiResponse,
  successResponse,
} from "../responses/api-response.helper";

@Injectable()
export class ApiResponseInterceptor implements NestInterceptor {
  intercept(
    _context: ExecutionContext,
    next: CallHandler
  ): Observable<unknown> {
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
