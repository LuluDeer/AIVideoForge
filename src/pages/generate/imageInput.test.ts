import { describe, expect, it } from 'vitest';
import { MAX_IMAGE_FILE_SIZE, MAX_IMAGE_URL_LENGTH, normalizeImageUrl, validateImageFile } from './imageInput';

describe('imageInput helpers', () => {
  it('validates supported image file types and sizes', () => {
    expect(validateImageFile({ type: 'image/png', size: 1 })).toBeNull();
    expect(validateImageFile({ type: 'text/plain', size: 1 })).toContain('仅支持');
    expect(validateImageFile({ type: 'image/png', size: 0 })).toContain('为空');
    expect(validateImageFile({ type: 'image/png', size: MAX_IMAGE_FILE_SIZE + 1 })).toContain('过大');
  });

  it('normalizes http image urls without requiring common extensions', () => {
    expect(normalizeImageUrl(' https://example.com/a.png?x=1 ')?.hasCommonImageExt).toBe(true);
    expect(normalizeImageUrl('https://example.com/signed-url')?.hasCommonImageExt).toBe(false);
    expect(normalizeImageUrl('ftp://example.com/a.png')).toBeNull();
    expect(normalizeImageUrl(`https://example.com/${'x'.repeat(MAX_IMAGE_URL_LENGTH)}`)).toBeNull();
  });
});
