import { Test, TestingModule } from '@nestjs/testing';
import { StorageService } from './storage.service';
import {
  STORAGE_ADAPTER,
  StorageAdapter,
} from './interfaces/storage-adapter.interface';

describe('StorageService', () => {
  let service: StorageService;
  let adapter: StorageAdapter;

  const mockAdapter: StorageAdapter = {
    upload: jest.fn().mockResolvedValue('uploaded_key'),
    delete: jest.fn().mockResolvedValue(true),
    exists: jest.fn().mockResolvedValue(true),
    getBuffer: jest.fn().mockResolvedValue(Buffer.from('test')),
    getStream: jest.fn().mockResolvedValue(null),
    getPublicUrl: jest.fn((key: string) => `/media/${key}`),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        {
          provide: STORAGE_ADAPTER,
          useValue: mockAdapter,
        },
      ],
    }).compile();

    service = module.get<StorageService>(StorageService);
    adapter = module.get<StorageAdapter>(STORAGE_ADAPTER);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateKey', () => {
    it('should generate collision-resistant storage key scoped by user and post ID', () => {
      const key = service.generateKey('user-123', 'post-456', 'jpg');
      expect(key).toMatch(/^users\/user-123\/posts\/post-456\/[a-f0-9-]+\.jpg$/);
    });

    it('should normalize leading dots in extensions', () => {
      const key = service.generateKey('user-123', 'post-456', '.PNG');
      expect(key).toMatch(/^users\/user-123\/posts\/post-456\/[a-f0-9-]+\.png$/);
    });
  });

  describe('delegation', () => {
    it('should delegate upload to adapter', async () => {
      const buf = Buffer.from('data');
      await service.upload('key.jpg', buf, 'image/jpeg');
      expect(adapter.upload).toHaveBeenCalledWith('key.jpg', buf, 'image/jpeg');
    });

    it('should delegate delete to adapter', async () => {
      await service.delete('key.jpg');
      expect(adapter.delete).toHaveBeenCalledWith('key.jpg');
    });

    it('should delegate exists to adapter', async () => {
      await service.exists('key.jpg');
      expect(adapter.exists).toHaveBeenCalledWith('key.jpg');
    });

    it('should delegate getBuffer to adapter', async () => {
      await service.getBuffer('key.jpg');
      expect(adapter.getBuffer).toHaveBeenCalledWith('key.jpg');
    });

    it('should return public url', () => {
      const url = service.getPublicUrl('key.jpg');
      expect(url).toBe('/media/key.jpg');
    });
  });
});
