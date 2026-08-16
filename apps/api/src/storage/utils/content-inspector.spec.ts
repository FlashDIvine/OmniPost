import { BadRequestException } from '@nestjs/common';
import {
  inspectContent,
  sanitizeFileName,
} from './content-inspector';
import { MediaType } from '../../../generated/prisma/client';

describe('ContentInspector', () => {
  const validJpegBuffer = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x01, 0x00, 0x48,
  ]);

  const validPngBuffer = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52,
  ]);

  const validWebpBuffer = Buffer.from([
    0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
    0x56, 0x50, 0x38, 0x20,
  ]);

  const validMp4Buffer = Buffer.from([
    0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d,
    0x00, 0x00, 0x02, 0x00,
  ]);

  const invalidBinaryBuffer = Buffer.from(
    'MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff\x00\x00',
  );

  const textBuffer = Buffer.from('Hello world this is plain text content');

  describe('inspectContent', () => {
    it('should correctly detect valid JPEG buffer', () => {
      const result = inspectContent(validJpegBuffer, 'image/jpeg');
      expect(result).toEqual({
        mimeType: 'image/jpeg',
        extension: 'jpg',
        mediaType: MediaType.IMAGE,
      });
    });

    it('should correctly detect valid PNG buffer', () => {
      const result = inspectContent(validPngBuffer, 'image/png');
      expect(result).toEqual({
        mimeType: 'image/png',
        extension: 'png',
        mediaType: MediaType.IMAGE,
      });
    });

    it('should correctly detect valid WebP buffer', () => {
      const result = inspectContent(validWebpBuffer, 'image/webp');
      expect(result).toEqual({
        mimeType: 'image/webp',
        extension: 'webp',
        mediaType: MediaType.IMAGE,
      });
    });

    it('should correctly detect valid MP4 buffer', () => {
      const result = inspectContent(validMp4Buffer, 'video/mp4');
      expect(result).toEqual({
        mimeType: 'video/mp4',
        extension: 'mp4',
        mediaType: MediaType.VIDEO,
      });
    });

    it('should reject empty or undersized buffers', () => {
      expect(() => inspectContent(Buffer.from([0xff, 0xd8]))).toThrow(
        BadRequestException,
      );
      expect(() => inspectContent(Buffer.alloc(0))).toThrow(
        BadRequestException,
      );
    });

    it('should reject unsupported binary format', () => {
      expect(() => inspectContent(invalidBinaryBuffer)).toThrow(
        BadRequestException,
      );
      expect(() => inspectContent(textBuffer)).toThrow(
        BadRequestException,
      );
    });

    it('should reject MIME spoofing when declared MIME conflicts with actual magic bytes', () => {
      // Client declared PNG but uploaded JPEG
      expect(() => inspectContent(validJpegBuffer, 'image/png')).toThrow(
        BadRequestException,
      );

      // Client declared MP4 video but uploaded PNG image
      expect(() => inspectContent(validPngBuffer, 'video/mp4')).toThrow(
        BadRequestException,
      );

      // Client declared JPEG but uploaded MP4
      expect(() => inspectContent(validMp4Buffer, 'image/jpeg')).toThrow(
        BadRequestException,
      );
    });
  });

  describe('sanitizeFileName', () => {
    it('should strip path traversal sequences', () => {
      expect(sanitizeFileName('../../secret.txt', 'jpg')).toBe('secret.txt');
      expect(sanitizeFileName('..\\..\\evil.png', 'png')).toBe('evil.png');
      expect(sanitizeFileName('C:\\Windows\\System32\\cmd.exe', 'mp4')).toBe(
        'cmd.exe',
      );
    });

    it('should strip control characters and null bytes', () => {
      expect(sanitizeFileName('photo\x00\x1f.jpg', 'jpg')).toBe('photo.jpg');
    });

    it('should handle undefined or empty filename with fallback', () => {
      expect(sanitizeFileName(undefined, 'jpg')).toBe('media.jpg');
      expect(sanitizeFileName('', 'png')).toBe('media.png');
      expect(sanitizeFileName('...', 'webp')).toBe('media.webp');
    });

    it('should preserve valid unicode filenames', () => {
      expect(sanitizeFileName('foto_liburan_🌴.jpg', 'jpg')).toBe(
        'foto_liburan_🌴.jpg',
      );
    });
  });
});
