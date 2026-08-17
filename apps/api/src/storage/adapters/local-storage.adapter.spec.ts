import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { LocalStorageAdapter } from './local-storage.adapter';

describe('LocalStorageAdapter', () => {
  let adapter: LocalStorageAdapter;
  let tempStorageRoot: string;

  beforeAll(async () => {
    tempStorageRoot = path.join(
      os.tmpdir(),
      `omnipost-test-storage-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    await fs.promises.mkdir(tempStorageRoot, { recursive: true });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocalStorageAdapter,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: string) => {
              if (key === 'MEDIA_STORAGE_ROOT') {
                return tempStorageRoot;
              }
              return defaultValue;
            }),
          },
        },
      ],
    }).compile();

    adapter = module.get<LocalStorageAdapter>(LocalStorageAdapter);
  });

  afterAll(async () => {
    try {
      await fs.promises.rm(tempStorageRoot, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  describe('Path Traversal Security', () => {
    it('should allow valid nested keys inside storage root', () => {
      const safePath = adapter.getSafePath('users/u1/posts/p1/img.jpg');
      expect(safePath).toContain(tempStorageRoot);
    });

    it('should reject path traversal attempting to escape storage root', () => {
      expect(() => adapter.getSafePath('../../../secret.txt')).toThrow(
        BadRequestException,
      );
      expect(() => adapter.getSafePath('..\\..\\evil.txt')).toThrow(
        BadRequestException,
      );
      expect(() => adapter.getSafePath('/etc/passwd')).toThrow(
        BadRequestException,
      );
    });

    it('should reject empty or non-string keys', () => {
      expect(() => adapter.getSafePath('')).toThrow(BadRequestException);
    });
  });

  describe('Storage CRUD Operations', () => {
    const testKey = 'users/user1/posts/post1/test-image.jpg';
    const testBuffer = Buffer.from('mock binary data for image');

    it('should upload and store file correctly', async () => {
      const uploadedKey = await adapter.upload(
        testKey,
        testBuffer,
        'image/jpeg',
      );
      expect(uploadedKey).toBe(testKey);

      const exists = await adapter.exists(testKey);
      expect(exists).toBe(true);
    });

    it('should read stored buffer', async () => {
      const retrieved = await adapter.getBuffer(testKey);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.toString()).toBe('mock binary data for image');
    });

    it('should read stored stream', async () => {
      const streamObj = await adapter.getStream(testKey);
      expect(streamObj).not.toBeNull();
      expect(streamObj!.size).toBe(testBuffer.length);
    });

    it('should return null for non-existent file buffer and stream', async () => {
      const nonExistent = await adapter.getBuffer('users/u1/posts/p1/none.jpg');
      expect(nonExistent).toBeNull();

      const nonExistentStream = await adapter.getStream(
        'users/u1/posts/p1/none.jpg',
      );
      expect(nonExistentStream).toBeNull();
    });

    it('should delete existing file', async () => {
      const deleted = await adapter.delete(testKey);
      expect(deleted).toBe(true);

      const exists = await adapter.exists(testKey);
      expect(exists).toBe(false);
    });

    it('should handle non-existent file deletion gracefully (idempotent)', async () => {
      const deleted = await adapter.delete(
        'users/user1/posts/post1/already-deleted.jpg',
      );
      expect(deleted).toBe(false);
    });

    it('should generate external url using configured base url or fallback', () => {
      const url = adapter.getExternalUrl('users/u1/posts/p1/img.jpg');
      expect(url).toBe('http://localhost:3001/api/media/users/u1/posts/p1/img.jpg');
    });
  });
});
