import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '../types/jwt-payload.type';
import { AuthUser } from '../types/auth-user.type';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(configService: ConfigService) {
    const secret =
      configService.get<string>('JWT_ACCESS_SECRET') ||
      'omnipost-dev-jwt-access-secret-32-chars-key';

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    if (!payload || !payload.sub || !payload.username) {
      throw new UnauthorizedException('Invalid token payload');
    }
    return {
      userId: payload.sub,
      username: payload.username,
    };
  }
}
