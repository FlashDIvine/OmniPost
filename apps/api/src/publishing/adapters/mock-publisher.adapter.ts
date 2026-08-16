import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { Platform } from '../../../generated/prisma/client';
import {
  PublishContext,
  PublisherAdapter,
} from './publisher-adapter.interface';
import { PublishResult } from '../types/publish-result.type';
import { PublishError } from '../types/publish-error.type';

@Injectable()
export class MockPublisherAdapter implements PublisherAdapter {
  public readonly platform: Platform;
  private shouldFail = false;
  private shouldFailValidation = false;
  private failureError: PublishError | null = null;
  private validationErrorMessage: string | null = null;
  private callCount = 0;
  private customPublishedUrl: string | null = null;

  constructor(platform: Platform = Platform.INSTAGRAM) {
    this.platform = platform;
  }

  async validateContent(context: PublishContext): Promise<void> {
    if (this.shouldFailValidation) {
      throw new UnprocessableEntityException(
        this.validationErrorMessage ||
          `Content validation failed for platform ${this.platform}`,
      );
    }
  }

  async publish(context: PublishContext): Promise<PublishResult> {
    this.callCount++;

    if (this.shouldFail) {
      return {
        success: false,
        error: this.failureError || {
          message: `Mock publishing failed on platform ${this.platform}`,
          apiErrorCode: 'MOCK_PUBLISH_ERROR',
          classification: 'RETRYABLE',
        },
      };
    }

    const defaultUrl =
      this.platform === Platform.INSTAGRAM
        ? `https://instagram.com/p/mock_${context.post.id}`
        : `https://tiktok.com/@${context.socialAccount.username}/video/mock_${context.post.id}`;

    return {
      success: true,
      publishedUrl: this.customPublishedUrl || defaultUrl,
      platformPostId: `mock_post_id_${Date.now()}`,
    };
  }

  // --- Test Helpers ---

  public setFailure(error?: Partial<PublishError>): void {
    this.shouldFail = true;
    this.failureError = {
      message: error?.message || 'Simulated platform error',
      apiErrorCode: error?.apiErrorCode || 'PLATFORM_ERROR',
      classification: error?.classification || 'RETRYABLE',
      rawError: error?.rawError,
    };
  }

  public setValidationFailure(message?: string): void {
    this.shouldFailValidation = true;
    this.validationErrorMessage = message || 'Simulated content invalid';
  }

  public setSuccess(publishedUrl?: string): void {
    this.shouldFail = false;
    this.shouldFailValidation = false;
    this.failureError = null;
    this.customPublishedUrl = publishedUrl || null;
  }

  public getCallCount(): number {
    return this.callCount;
  }

  public reset(): void {
    this.shouldFail = false;
    this.shouldFailValidation = false;
    this.failureError = null;
    this.validationErrorMessage = null;
    this.callCount = 0;
    this.customPublishedUrl = null;
  }
}
