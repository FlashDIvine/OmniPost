export interface JwtPayload {
  sub: string;
  username: string;
}

export interface JwtRefreshPayload {
  sub: string;
  jti?: string;
}
