import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

@Injectable()
export class CryptoService implements OnModuleInit {
  private key: Buffer;
  private readonly algorithm = 'aes-256-gcm';
  private readonly ivLength = 12; // 96-bit IV recommended for GCM

  constructor(private readonly configService: ConfigService) {
    this.initKey();
  }

  onModuleInit() {
    // Validate on module startup
    if (!this.key || this.key.length !== 32) {
      throw new Error(
        'Invalid encryption key: SOCIAL_TOKEN_ENCRYPTION_KEY must be a 32-byte key (e.g. 64-character hex string).',
      );
    }
  }

  private initKey(): void {
    const rawKey = this.configService.get<string>('SOCIAL_TOKEN_ENCRYPTION_KEY');
    if (!rawKey) {
      throw new Error(
        'Missing SOCIAL_TOKEN_ENCRYPTION_KEY environment variable. Application cannot start without a valid encryption key.',
      );
    }

    let parsedKey: Buffer;
    // Support 64-char hex string (preferred), 44-char base64 string, or 32-char UTF-8 string
    if (/^[0-9a-fA-F]{64}$/.test(rawKey)) {
      parsedKey = Buffer.from(rawKey, 'hex');
    } else if (rawKey.length === 32) {
      parsedKey = Buffer.from(rawKey, 'utf8');
    } else {
      const base64Buffer = Buffer.from(rawKey, 'base64');
      if (base64Buffer.length === 32) {
        parsedKey = base64Buffer;
      } else {
        throw new Error(
          'SOCIAL_TOKEN_ENCRYPTION_KEY must resolve to exactly 32 bytes (256 bits). Use a 64-character hex string.',
        );
      }
    }

    if (parsedKey.length !== 32) {
      throw new Error(
        `SOCIAL_TOKEN_ENCRYPTION_KEY resolved to ${parsedKey.length} bytes, but exactly 32 bytes are required for AES-256-GCM.`,
      );
    }

    this.key = parsedKey;
  }

  /**
   * Encrypts plaintext string using AES-256-GCM with a unique IV.
   * Returns a versioned, serialized ciphertext string: v1:<iv_hex>:<authTag_hex>:<encrypted_hex>
   */
  encrypt(plaintext: string): string {
    if (typeof plaintext !== 'string') {
      throw new TypeError('Plaintext must be a string');
    }

    const iv = randomBytes(this.ivLength);
    const cipher = createCipheriv(this.algorithm, this.key, iv);

    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);

    const authTag = cipher.getAuthTag();

    return `v1:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  /**
   * Decrypts a versioned serialized ciphertext string.
   * Throws an error if ciphertext format is invalid or tampering is detected.
   */
  decrypt(serializedCiphertext: string): string {
    if (typeof serializedCiphertext !== 'string') {
      throw new TypeError('Ciphertext must be a string');
    }

    const parts = serializedCiphertext.split(':');
    if (parts.length !== 4) {
      throw new Error('Invalid encrypted token format');
    }

    const [version, ivHex, authTagHex, encryptedHex] = parts;

    if (version !== 'v1') {
      throw new Error(`Unsupported encryption version: ${version}`);
    }

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');

    if (iv.length !== this.ivLength || authTag.length !== 16) {
      throw new Error('Invalid IV or Auth Tag length in encrypted token');
    }

    const decipher = createDecipheriv(this.algorithm, this.key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  }
}
