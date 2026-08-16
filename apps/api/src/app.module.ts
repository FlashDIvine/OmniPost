import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { CryptoModule } from './common/crypto/crypto.module';
import { SocialAccountsModule } from './social-accounts/social-accounts.module';
import { PostsModule } from './posts/posts.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.example'],
    }),
    PrismaModule,
    CryptoModule,
    UsersModule,
    AuthModule,
    SocialAccountsModule,
    PostsModule,
    HealthModule,
  ],
})
export class AppModule {}
