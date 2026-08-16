import { Readable } from 'node:stream';

export interface StorageFileStream {
  stream: Readable;
  size: number;
  mimeType: string;
}

export interface StorageAdapter {
  /**
   * Uploads a file buffer to the underlying storage provider at the specified key.
   * Returns the canonical storage key.
   */
  upload(key: string, buffer: Buffer, mimeType: string): Promise<string>;

  /**
   * Deletes a file from storage by its key.
   * Returns true if file was deleted, false if file was not found (idempotent).
   */
  delete(key: string): Promise<boolean>;

  /**
   * Checks whether a file exists at the given key.
   */
  exists(key: string): Promise<boolean>;

  /**
   * Retrieves the raw file buffer from storage. Returns null if not found.
   */
  getBuffer(key: string): Promise<Buffer | null>;

  /**
   * Retrieves a readable stream of the file from storage. Returns null if not found.
   */
  getStream(key: string): Promise<StorageFileStream | null>;

  /**
   * Optional method to generate a public / logical URL for the asset.
   */
  getPublicUrl?(key: string): string;
}

export const STORAGE_ADAPTER = Symbol('STORAGE_ADAPTER');
