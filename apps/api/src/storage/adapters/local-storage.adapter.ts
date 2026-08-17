import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  StorageAdapter,
  StorageFileStream,
} from '../interfaces/storage-adapter.interface';

@Injectable()
export class LocalStorageAdapter implements StorageAdapter {
  private readonly storageRoot: string;

  constructor(private readonly configService: ConfigService) {
    this.storageRoot = path.resolve(
      this.configService.get<string>('MEDIA_STORAGE_ROOT') || './storage/media',
    );
  }

  /**
   * Resolves a storage key to an absolute physical filesystem path and enforces
   * strict path-traversal containment within the configured storage root.
   */
  public getSafePath(key: string): string {
    if (!key || typeof key !== 'string') {
      throw new BadRequestException('Storage key must be a non-empty string');
    }

    // Explicitly disallow absolute paths or root/drive prefixes
    if (
      path.isAbsolute(key) ||
      key.startsWith('/') ||
      key.startsWith('\\') ||
      /^[a-zA-Z]:/.test(key)
    ) {
      throw new BadRequestException(
        'Security Violation: Absolute path or leading separator not allowed in storage key',
      );
    }

    // Normalize separators and resolve against storageRoot
    const normalizedKey = path.normalize(key).replace(/^(\.\.[\/\\])+/, '');
    const resolvedPath = path.resolve(this.storageRoot, key);

    const rootWithSep = this.storageRoot.endsWith(path.sep)
      ? this.storageRoot
      : this.storageRoot + path.sep;

    if (
      !resolvedPath.startsWith(rootWithSep) &&
      resolvedPath !== this.storageRoot
    ) {
      throw new BadRequestException(
        'Security Violation: Path traversal detected outside storage root',
      );
    }

    return resolvedPath;
  }

  async upload(
    key: string,
    buffer: Buffer,
    _mimeType: string,
  ): Promise<string> {
    const safePath = this.getSafePath(key);
    const directory = path.dirname(safePath);

    await fs.promises.mkdir(directory, { recursive: true });
    await fs.promises.writeFile(safePath, buffer);

    return key;
  }

  async delete(key: string): Promise<boolean> {
    try {
      const safePath = this.getSafePath(key);
      await fs.promises.unlink(safePath);
      return true;
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        return false;
      }
      throw err;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const safePath = this.getSafePath(key);
      await fs.promises.access(safePath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  async getBuffer(key: string): Promise<Buffer | null> {
    try {
      const safePath = this.getSafePath(key);
      return await fs.promises.readFile(safePath);
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        return null;
      }
      throw err;
    }
  }

  async getStream(key: string): Promise<StorageFileStream | null> {
    try {
      const safePath = this.getSafePath(key);
      const stat = await fs.promises.stat(safePath);
      const stream = fs.createReadStream(safePath);
      return {
        stream,
        size: stat.size,
        mimeType: 'application/octet-stream',
      };
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        return null;
      }
      throw err;
    }
  }

  getPublicUrl(key: string): string {
    return `/media/${key}`;
  }

  getExternalUrl(key: string): string {
    const baseUrl =
      this.configService.get<string>('MEDIA_PUBLIC_BASE_URL') ||
      this.configService.get<string>('PUBLIC_MEDIA_BASE_URL') ||
      'http://localhost:3001/api/media';

    const normalizedKey = key.replace(/^\/+/, '');
    return `${baseUrl.replace(/\/+$/, '')}/${normalizedKey}`;
  }
}
