export interface ApiError {
  message: string;
  status: number;
  apiErrorCode?: string;
  errors?: string[] | Record<string, unknown>;
  raw?: unknown;
}

export interface RequestOptions {
  headers?: Record<string, string>;
  params?: Record<string, string | number | boolean | undefined | null>;
  token?: string | null;
  credentials?: RequestCredentials;
  signal?: AbortSignal;
}

export interface ApiResponse<T> {
  data: T;
  status: number;
  headers: Headers;
}
