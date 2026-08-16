import { BadRequestException } from '@nestjs/common';
import * as path from 'node:path';
import { MediaType } from '../../../generated/prisma/client';

export interface InspectedContent {
  mimeType: string;
  extension: string;
  mediaType: MediaType;
}

/**
 * Inspects raw buffer magic bytes to accurately detect media format and prevent MIME/extension spoofing.
 */
export function inspectContent(
  buffer: Buffer,
  declaredMimeType?: string,
): InspectedContent {
  if (!buffer || buffer.length < 12) {
    throw new BadRequestException(
      'Invalid file content: buffer is empty or too small to inspect format',
    );
  }

  let detected: InspectedContent | null = null;

  // 1. JPEG Check: 0xFF 0xD8 0xFF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    detected = {
      mimeType: 'image/jpeg',
      extension: 'jpg',
      mediaType: MediaType.IMAGE,
    };
  }

  // 2. PNG Check: 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
  else if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    detected = {
      mimeType: 'image/png',
      extension: 'png',
      mediaType: MediaType.IMAGE,
    };
  }

  // 3. WebP Check: RIFF (bytes 0..3) ... WEBP (bytes 8..11)
  else if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    detected = {
      mimeType: 'image/webp',
      extension: 'webp',
      mediaType: MediaType.IMAGE,
    };
  }

  // 4. MP4 Check: 'ftyp' at offset 4..7
  else if (
    buffer[4] === 0x66 &&
    buffer[5] === 0x74 &&
    buffer[6] === 0x79 &&
    buffer[7] === 0x70
  ) {
    detected = {
      mimeType: 'video/mp4',
      extension: 'mp4',
      mediaType: MediaType.VIDEO,
    };
  }

  if (!detected) {
    throw new BadRequestException(
      'Unsupported file format. Only JPEG, PNG, WebP images and MP4 videos are supported',
    );
  }

  // Verify that declared MIME type does not spoof or contradict actual binary content
  if (declaredMimeType) {
    const normalizedDeclared = declaredMimeType.toLowerCase().trim();
    const isJpeg =
      detected.mimeType === 'image/jpeg' &&
      (normalizedDeclared === 'image/jpeg' ||
        normalizedDeclared === 'image/jpg' ||
        normalizedDeclared === 'image/pjpeg');

    const isPng =
      detected.mimeType === 'image/png' && normalizedDeclared === 'image/png';

    const isWebp =
      detected.mimeType === 'image/webp' &&
      normalizedDeclared === 'image/webp';

    const isMp4 =
      detected.mimeType === 'video/mp4' && normalizedDeclared === 'video/mp4';

    if (!isJpeg && !isPng && !isWebp && !isMp4) {
      throw new BadRequestException(
        `Declared MIME type '${declaredMimeType}' does not match actual detected file content '${detected.mimeType}' (MIME spoofing detected)`,
      );
    }
  }

  return detected;
}

/**
 * Sanitizes original client filename for safe storage as metadata only.
 * Never used for filesystem paths.
 */
export function sanitizeFileName(
  originalName: string | undefined,
  defaultExtension: string,
): string {
  if (!originalName || typeof originalName !== 'string') {
    return `media.${defaultExtension}`;
  }

  // Strip path traversal and path separators
  let baseName = path.basename(originalName.replace(/\\/g, '/'));

  // Strip non-printable / control characters and null bytes
  baseName = baseName.replace(/[\x00-\x1f\x80-\x9f]/g, '').trim();

  // If empty or only dots/spaces after stripping, return default
  const cleanContent = baseName.replace(/[\.\s]+/g, '');
  if (!baseName || !cleanContent) {
    return `media.${defaultExtension}`;
  }

  // Truncate to maximum 255 characters
  if (baseName.length > 255) {
    const ext = path.extname(baseName);
    const nameWithoutExt = baseName.slice(0, 255 - ext.length);
    baseName = `${nameWithoutExt}${ext}`;
  }

  return baseName;
}
