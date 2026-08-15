import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CryptoService } from './crypto.service';

describe('CryptoService', () => {
  let service: CryptoService;
  const valid64HexKey =
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  const createServiceWithKey = async (key?: string) => {
    const mockConfigService = {
      get: jest.fn((k: string) => {
        if (k === 'SOCIAL_TOKEN_ENCRYPTION_KEY') return key;
        return null;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CryptoService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    return module.get<CryptoService>(CryptoService);
  };

  beforeEach(async () => {
    service = await createServiceWithKey(valid64HexKey);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('key validation', () => {
    it('should fail if SOCIAL_TOKEN_ENCRYPTION_KEY is missing', async () => {
      await expect(createServiceWithKey(undefined)).rejects.toThrow(
        'Missing SOCIAL_TOKEN_ENCRYPTION_KEY environment variable',
      );
    });

    it('should fail if key has invalid length', async () => {
      await expect(createServiceWithKey('short_key')).rejects.toThrow(
        'SOCIAL_TOKEN_ENCRYPTION_KEY must resolve to exactly 32 bytes',
      );
    });

    it('should accept a 32-character UTF-8 key', async () => {
      const exact32Chars = '12345678901234567890123456789012';
      const svc = await createServiceWithKey(exact32Chars);
      expect(svc).toBeDefined();
      const enc = svc.encrypt('test');
      expect(svc.decrypt(enc)).toBe('test');
    });
  });

  describe('encrypt and decrypt', () => {
    it('should encrypt plaintext into versioned ciphertext format v1:iv:authTag:ciphertext', () => {
      const plaintext = 'EAAGNO41x48kBA...instagram_access_token';
      const encrypted = service.encrypt(plaintext);

      expect(encrypted).not.toBe(plaintext);
      expect(encrypted.startsWith('v1:')).toBe(true);

      const parts = encrypted.split(':');
      expect(parts).toHaveLength(4);
      expect(parts[0]).toBe('v1');
      expect(parts[1]).toHaveLength(24); // 12 bytes = 24 hex chars
      expect(parts[2]).toHaveLength(32); // 16 bytes = 32 hex chars
      expect(parts[3].length).toBeGreaterThan(0);
    });

    it('should decrypt back to original plaintext correctly', () => {
      const plaintext = 'sample_tiktok_oauth_token_12345';
      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should generate unique IV for each encryption call (different ciphertexts for same plaintext)', () => {
      const plaintext = 'same_token_value';
      const enc1 = service.encrypt(plaintext);
      const enc2 = service.encrypt(plaintext);

      expect(enc1).not.toBe(enc2);
      expect(service.decrypt(enc1)).toBe(plaintext);
      expect(service.decrypt(enc2)).toBe(plaintext);
    });

    it('should throw error when decrypting tampered ciphertext', () => {
      const encrypted = service.encrypt('sensitive_token');
      const parts = encrypted.split(':');
      // Tamper ciphertext part
      const tamperedCiphertext =
        parts[3].substring(0, parts[3].length - 2) +
        (parts[3].endsWith('a') ? 'b' : 'a');
      const tampered = `${parts[0]}:${parts[1]}:${parts[2]}:${tamperedCiphertext}`;

      expect(() => service.decrypt(tampered)).toThrow();
    });

    it('should throw error when decrypting tampered auth tag', () => {
      const encrypted = service.encrypt('sensitive_token');
      const parts = encrypted.split(':');
      // Tamper auth tag part
      const tamperedAuthTag =
        'ff' + parts[2].substring(2);
      const tampered = `${parts[0]}:${parts[1]}:${tamperedAuthTag}:${parts[3]}`;

      expect(() => service.decrypt(tampered)).toThrow();
    });

    it('should throw error when decrypting invalid serialized format', () => {
      expect(() => service.decrypt('invalid_format')).toThrow(
        'Invalid encrypted token format',
      );
    });

    it('should throw error for unsupported encryption version', () => {
      expect(() =>
        service.decrypt('v99:123456789012345678901234:12345678901234567890123456789012:abcdef'),
      ).toThrow('Unsupported encryption version');
    });
  });
});
