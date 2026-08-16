import { UnprocessableEntityException } from '@nestjs/common';
import { PublisherRegistry } from './publisher.registry';
import { MockPublisherAdapter } from '../adapters/mock-publisher.adapter';
import { Platform } from '../../../generated/prisma/client';

describe('PublisherRegistry', () => {
  let registry: PublisherRegistry;
  let instagramAdapter: MockPublisherAdapter;
  let tikTokAdapter: MockPublisherAdapter;

  beforeEach(() => {
    instagramAdapter = new MockPublisherAdapter(Platform.INSTAGRAM);
    tikTokAdapter = new MockPublisherAdapter(Platform.TIKTOK);
    registry = new PublisherRegistry([instagramAdapter, tikTokAdapter]);
  });

  it('should resolve registered Instagram adapter', () => {
    const adapter = registry.get(Platform.INSTAGRAM);
    expect(adapter).toBeDefined();
    expect(adapter.platform).toBe(Platform.INSTAGRAM);
  });

  it('should resolve registered TikTok adapter', () => {
    const adapter = registry.get(Platform.TIKTOK);
    expect(adapter).toBeDefined();
    expect(adapter.platform).toBe(Platform.TIKTOK);
  });

  it('should throw UnprocessableEntityException when requesting unregistered platform', () => {
    const emptyRegistry = new PublisherRegistry([]);
    expect(() => emptyRegistry.get(Platform.INSTAGRAM)).toThrow(
      UnprocessableEntityException,
    );
  });

  it('should allow dynamic registration of adapters', () => {
    const emptyRegistry = new PublisherRegistry();
    expect(emptyRegistry.has(Platform.INSTAGRAM)).toBe(false);

    emptyRegistry.register(instagramAdapter);
    expect(emptyRegistry.has(Platform.INSTAGRAM)).toBe(true);
    expect(emptyRegistry.get(Platform.INSTAGRAM)).toBe(instagramAdapter);
  });
});
