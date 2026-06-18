import { AxiosError, create } from "axios";
import type { AxiosRequestConfig } from "axios";

export const API_BASE_URL =
  (import.meta.env["VITE_API_URL"] as string | undefined) ?? "";

export interface ApiSuccess<TData> {
  success: true;
  data: TData;
}

interface ApiFailure {
  success: false;
  error?: {
    code?: string;
    message?: string;
    statusCode?: number;
  };
}

type ApiResponse<TData> = ApiSuccess<TData> | ApiFailure;

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string | undefined;

  constructor(message: string, options: { code?: string; status: number }) {
    super(message);
    this.name = "ApiClientError";
    this.status = options.status;
    this.code = options.code;
  }
}

const api = create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

export async function request<TData>(
  path: string,
  config?: Omit<AxiosRequestConfig, "url">
): Promise<TData> {
  let response;

  try {
    response = await api.request<ApiResponse<TData>>({
      ...config,
      url: path,
    });
  } catch (error) {
    if (error instanceof AxiosError && error.response) {
      const body = error.response.data as ApiFailure | null;

      throw new ApiClientError(
        body?.error?.message ?? "La solicitud no pudo completarse.",
        { code: body?.error?.code, status: error.response.status }
      );
    }

    throw new ApiClientError(
      "No se pudo conectar con el backend. Verifica que Nest y Redis esten activos.",
      { status: 0 }
    );
  }

  const body = response.data;

  if (body.success !== true) {
    throw new ApiClientError("El backend devolvio una respuesta inesperada.", {
      status: response.status,
    });
  }

  return body.data;
}

export function isUnauthenticatedError(error: unknown): boolean {
  return error instanceof ApiClientError && error.status === 401;
}
