import { config } from '../config';
import { ApiError, ApiResponse, RequestOptions } from './types';

export class ApiClient {
  private readonly baseUrl: string;
  private accessToken: string | null = null;

  constructor(baseUrl = config.apiUrl) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  /**
   * Sets the in-memory access token used for authenticated requests.
   */
  setAccessToken(token: string | null): void {
    this.accessToken = token;
  }

  /**
   * Gets the current in-memory access token.
   */
  getAccessToken(): string | null {
    return this.accessToken;
  }

  /**
   * Sends a GET request.
   */
  async get<T>(path: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>(path, { ...options, method: 'GET' });
  }

  /**
   * Sends a POST request with a JSON body.
   */
  async post<T>(
    path: string,
    body?: unknown,
    options?: RequestOptions,
  ): Promise<ApiResponse<T>> {
    return this.request<T>(path, {
      ...options,
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });
  }

  /**
   * Sends a PATCH request with a JSON body.
   */
  async patch<T>(
    path: string,
    body?: unknown,
    options?: RequestOptions,
  ): Promise<ApiResponse<T>> {
    return this.request<T>(path, {
      ...options,
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });
  }

  /**
   * Sends a DELETE request.
   */
  async delete<T>(
    path: string,
    options?: RequestOptions,
  ): Promise<ApiResponse<T>> {
    return this.request<T>(path, { ...options, method: 'DELETE' });
  }

  /**
   * Sends a multipart/form-data upload request (e.g. media file upload).
   */
  async upload<T>(
    path: string,
    formData: FormData,
    options?: RequestOptions,
  ): Promise<ApiResponse<T>> {
    return this.request<T>(path, {
      ...options,
      method: 'POST',
      body: formData,
      // Note: do not set Content-Type header so the browser can set boundary automatically
    });
  }

  /**
   * Internal request dispatcher with centralized headers, credentials, and error normalization.
   */
  private async request<T>(
    path: string,
    options: RequestOptions & { method: string; body?: BodyInit | null },
  ): Promise<ApiResponse<T>> {
    const url = this.buildUrl(path, options.params);
    const headers = new Headers(options.headers || {});

    // Attach access token if present
    const token = options.token !== undefined ? options.token : this.accessToken;
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    try {
      const response = await fetch(url, {
        method: options.method,
        headers,
        body: options.body,
        credentials: options.credentials || 'include',
        signal: options.signal,
      });

      if (!response.ok) {
        throw await this.normalizeResponseError(response);
      }

      // Handle 204 No Content
      if (response.status === 204) {
        return {
          data: {} as T,
          status: response.status,
          headers: response.headers,
        };
      }

      // Parse JSON response
      const data = await response.json();
      return {
        data: data as T,
        status: response.status,
        headers: response.headers,
      };
    } catch (err: unknown) {
      if (
        err &&
        typeof err === 'object' &&
        'status' in err &&
        'message' in err
      ) {
        throw err as ApiError;
      }
      throw this.normalizeNetworkError(err);
    }
  }

  /**
   * Constructs the full URL with query parameters.
   */
  private buildUrl(
    path: string,
    params?: Record<string, string | number | boolean | undefined | null>,
  ): string {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const url = new URL(`${this.baseUrl}${cleanPath}`);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          url.searchParams.set(key, String(value));
        }
      });
    }

    return url.toString();
  }

  /**
   * Converts a non-ok HTTP Response into a normalized ApiError.
   */
  private async normalizeResponseError(response: Response): Promise<ApiError> {
    let errorBody: Record<string, unknown> | null = null;
    try {
      errorBody = await response.json();
    } catch {
      // Fallback for non-JSON error response
    }

    let message = response.statusText || 'An unexpected error occurred';
    let errors: string[] | Record<string, unknown> | undefined = undefined;

    if (errorBody) {
      if (typeof errorBody.message === 'string') {
        message = errorBody.message;
      } else if (Array.isArray(errorBody.message)) {
        message = errorBody.message.join(', ');
        errors = errorBody.message as string[];
      } else if (errorBody.error && typeof errorBody.error === 'string') {
        message = errorBody.error;
      }
    }

    return {
      message,
      status: response.status,
      apiErrorCode:
        typeof errorBody?.apiErrorCode === 'string'
          ? errorBody.apiErrorCode
          : typeof errorBody?.statusCode === 'number'
            ? String(errorBody.statusCode)
            : undefined,
      errors,
      raw: errorBody,
    };
  }

  /**
   * Converts network and timeout exceptions into a normalized ApiError.
   */
  private normalizeNetworkError(err: unknown): ApiError {
    const errorObj = err instanceof Error ? err : null;

    if (
      errorObj?.name === 'AbortError' ||
      errorObj?.name === 'TimeoutError'
    ) {
      return {
        message: 'Request timed out or was aborted',
        status: 408,
        apiErrorCode: 'REQUEST_TIMEOUT',
        raw: err,
      };
    }

    return {
      message:
        errorObj?.message || 'Failed to connect to OmniPost API server',
      status: 0,
      apiErrorCode: 'NETWORK_ERROR',
      raw: err,
    };
  }
}

export const apiClient = new ApiClient();
