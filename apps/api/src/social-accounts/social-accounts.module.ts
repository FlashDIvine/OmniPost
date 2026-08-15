import { Module } from '@nestjs/common';
import { SocialAccountsService } from './social-accounts.service';
import { SocialAccountsController } from './social-accounts.controller';
import { OAuthStateService } from './services/oauth-state.service';
import { TikTokAdapter } from './adapters/tiktok.adapter';
import { TikTokOAuthService } from './services/tiktok-oauth.service';
import { CryptoModule } from '../common/crypto/crypto.module';

@Module({
  imports: [CryptoModule],
  controllers: [SocialAccountsController],
  providers: [
    SocialAccountsService,
    OAuthStateService,
    TikTokAdapter,
    TikTokOAuthService,
  ],
  exports: [SocialAccountsService, OAuthStateService, TikTokOAuthService],
})
export class SocialAccountsModule {}
