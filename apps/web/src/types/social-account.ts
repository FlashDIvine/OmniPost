export enum Platform {
  INSTAGRAM = 'INSTAGRAM',
  TIKTOK = 'TIKTOK',
}

export enum ConnectionStatus {
  CONNECTED = 'CONNECTED',
  DISCONNECTED = 'DISCONNECTED',
  EXPIRED = 'EXPIRED',
}

export interface SocialAccount {
  id: string;
  platform: Platform;
  platformAccountId: string;
  username: string;
  profileImageUrl?: string | null;
  connectionStatus: ConnectionStatus;
  tokenExpiry?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OAuthConnectResponse {
  url: string;
  state: string;
}
