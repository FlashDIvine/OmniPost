import {
  Inject,
  Injectable,
  Optional,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Platform } from '../../../generated/prisma/client';
import {
  PUBLISHER_ADAPTERS,
  PublisherAdapter,
} from '../adapters/publisher-adapter.interface';

@Injectable()
export class PublisherRegistry {
  private readonly adapters = new Map<Platform, PublisherAdapter>();

  constructor(
    @Optional()
    @Inject(PUBLISHER_ADAPTERS)
    adapters?: PublisherAdapter[],
  ) {
    if (adapters && Array.isArray(adapters)) {
      for (const adapter of adapters) {
        this.register(adapter);
      }
    }
  }

  /**
   * Registers a publisher adapter for its supported platform.
   */
  public register(adapter: PublisherAdapter): void {
    this.adapters.set(adapter.platform, adapter);
  }

  /**
   * Retrieves the registered publisher adapter for a given platform.
   * Throws UnprocessableEntityException if the platform is not supported.
   */
  public get(platform: Platform): PublisherAdapter {
    const adapter = this.adapters.get(platform);
    if (!adapter) {
      throw new UnprocessableEntityException(
        `Publishing is not supported for platform: ${platform}. No adapter registered.`,
      );
    }
    return adapter;
  }

  /**
   * Checks if an adapter is registered for a platform.
   */
  public has(platform: Platform): boolean {
    return this.adapters.has(platform);
  }
}
