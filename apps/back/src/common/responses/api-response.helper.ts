export type ApiResponseMeta = Record<string, unknown>;

export interface ApiSuccessResponse<TData> {
  success: true;
  data: TData;
  meta?: ApiResponseMeta;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
    path?: string;
    statusCode?: number;
    timestamp?: string;
  };
}

export type ApiResponse<TData> = ApiSuccessResponse<TData> | ApiErrorResponse;

export function successResponse<TData>(
  data: TData,
  meta?: ApiResponseMeta
): ApiSuccessResponse<TData> {
  return {
    data,
    ...(meta ? { meta } : {}),
    success: true,
  };
}

export function errorResponse(error: {
  code: string;
  details?: unknown;
  message: string;
  path?: string;
  statusCode?: number;
  timestamp?: string;
}): ApiErrorResponse {
  return {
    error: {
      code: error.code,
      ...(error.details ? { details: error.details } : {}),
      message: error.message,
      ...(error.path ? { path: error.path } : {}),
      ...(error.statusCode ? { statusCode: error.statusCode } : {}),
      ...(error.timestamp ? { timestamp: error.timestamp } : {}),
    },
    success: false,
  };
}

export function isApiResponse(value: unknown): value is ApiResponse<unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    "success" in value &&
    typeof (value as { success?: unknown }).success === "boolean"
  );
}
