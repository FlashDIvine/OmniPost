import {
  Media,
  Platform,
  Post,
  SocialAccount,
} from '../../../generated/prisma/client';
import { PublishResult } from '../types/publish-result.type';

export interface PublishContext {
  post: Post & { media: Media[] };
  socialAccount: SocialAccount;
  accessToken: string;
}

export interface PublisherAdapter {
  /**
   * The social platform supported by this adapter.
   */
  readonly platform: Platform;

  /**
   * Validates platform-specific content constraints (e.g. video duration, image aspect ratios)
   * before publishing starts. Throws UnprocessableEntityException on validation failure.
   */
  validateContent(context: PublishContext): Promise<void>;

  /**
   * Publishes content to the external social platform.
   * Executed outside database transactions.
   */
  publish(context: PublishContext): Promise<PublishResult>;
}

export const PUBLISHER_ADAPTERS = Symbol('PUBLISHER_ADAPTERS');
