import { Module } from '@nestjs/common';
import { PublishingController } from './publishing.controller';
import { PublishingService } from './publishing.service';
import { PublishValidationService } from './services/publish-validation.service';
import { PublisherRegistry } from './registry/publisher.registry';
import { MockPublisherAdapter } from './adapters/mock-publisher.adapter';
import { InstagramApiClient } from './adapters/instagram/instagram-api.client';
import { InstagramPublisherAdapter } from './adapters/instagram/instagram-publisher.adapter';
import { PUBLISHER_ADAPTERS } from './adapters/publisher-adapter.interface';
import { PrismaModule } from '../prisma/prisma.module';
import { SocialAccountsModule } from '../social-accounts/social-accounts.module';
import { StorageModule } from '../storage/storage.module';
import { PostsModule } from '../posts/posts.module';
import { Platform } from '../../generated/prisma/client';

@Module({
  imports: [PrismaModule, SocialAccountsModule, StorageModule, PostsModule],
  controllers: [PublishingController],
  providers: [
    InstagramApiClient,
    InstagramPublisherAdapter,
    {
      provide: PUBLISHER_ADAPTERS,
      useFactory: (instagramAdapter: InstagramPublisherAdapter) => [
        instagramAdapter,
        new MockPublisherAdapter(Platform.TIKTOK),
      ],
      inject: [InstagramPublisherAdapter],
    },
    PublisherRegistry,
    PublishValidationService,
    PublishingService,
  ],
  exports: [
    PublishingService,
    PublisherRegistry,
    PublishValidationService,
    InstagramPublisherAdapter,
    InstagramApiClient,
  ],
})
export class PublishingModule {}
