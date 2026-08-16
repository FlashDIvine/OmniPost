import { PublishError } from './publish-error.type';

export interface PublishResult {
  /**
   * Whether the publishing operation completed successfully on the target social platform.
   */
  success: boolean;

  /**
   * External URL of the published post on the platform (if available).
   */
  publishedUrl?: string;

  /**
   * Unique post / media ID assigned by the social platform.
   */
  platformPostId?: string;

  /**
   * Error details if the publishing operation failed.
   */
  error?: PublishError;
}
