export type ErrorClassification = 'RETRYABLE' | 'PERMANENT';

export interface PublishError {
  /**
   * Safe, sanitized message describing the error without leaking credentials or secrets.
   */
  message: string;

  /**
   * Platform-specific API error code if safe to store.
   */
  apiErrorCode?: string;

  /**
   * Classification indicating if the failure can be retried.
   */
  classification: ErrorClassification;

  /**
   * Internal error details for logging (never persisted to public database or response).
   */
  rawError?: any;
}
