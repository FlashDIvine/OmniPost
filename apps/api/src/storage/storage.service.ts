import { Inject, Injectable } from '@nestjs/common';
import * as crypto from 'node:crypto';
import {
  STORAGE_ADAPTER,
  StorageAdapter,
  StorageFileStream,
} from './interfaces/storage-adapter.interface';

@Injectable()
export class StorageService {
  constructor(
    @Inject(STORAGE_ADAPTER)
    private readonly storageAdapter: StorageAdapter,
  ) {}

  /**
   * Generates a collision-resistant, secure storage key scoped by authenticated user and post ID.
   * Never incorporates untrusted client filenames.
   */
  generateKey(userId: string, postId: string, extension: string): string {
    const cleanExt = extension.replace(/^\./, '').toLowerCase();
    const uniqueId = crypto.randomUUID();
    return `users/${userId}/posts/${postId}/${uniqueId}.${cleanExt}`;
  }

  /**
   * Uploads a file buffer to the configured storage adapter.
   */
  async upload(
    key: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<string> {
    return this.storageAdapter.upload(key, buffer, mimeType);
  }

  /**
   * Deletes a file from storage by key.
   */
  async delete(key: string): Promise<boolean> {
    return this.storageAdapter.delete(key);
  }

  /**
   * Checks if a file exists in storage.
   */
  async exists(key: string): Promise<boolean> {
    return this.storageAdapter.exists(key);
  }

  /**
   * Retrieves raw file buffer from storage.
   */
  async getBuffer(key: string): Promise<Buffer | null> {
    return this.storageAdapter.getBuffer(key);
  }

  /**
   * Retrieves readable stream from storage.
   */
  async getStream(key: string): Promise<StorageFileStream | null> {
    return this.storageAdapter.getStream(key);
  }

  /**
   * Returns logical URL for the asset.
   */
  getPublicUrl(key: string): string {
    if (this.storageAdapter.getPublicUrl) {
      return this.storageAdapter.getPublicUrl(key);
    }
    return `/media/${key}`;
  }
}
