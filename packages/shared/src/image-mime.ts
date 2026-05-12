const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function sniffImageMimeType(buf: Uint8Array): string | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return 'image/png';
  }
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return 'image/webp';
  }
  return null;
}

/**
 * Alguns browsers enviam `type` vazio ou `application/octet-stream` para JPEG/PNG/WebP.
 * Usamos o declarado quando for um MIME aceito; caso contrário inspecionamos os primeiros bytes.
 */
export function resolveProductImageMimeType(
  declared: string | undefined,
  fileBody: Uint8Array,
): { contentType: string; ext: string } | null {
  let ct = (declared ?? '').trim().toLowerCase();
  if (ct === 'image/jpg') ct = 'image/jpeg';

  const needSniff = ct === '' || ct === 'application/octet-stream' || !ALLOWED.has(ct);
  if (needSniff) {
    const sniffed = sniffImageMimeType(fileBody);
    if (!sniffed) return null;
    ct = sniffed;
  }

  const ext =
    ct === 'image/jpeg' ? 'jpg' : ct === 'image/png' ? 'png' : ct === 'image/webp' ? 'webp' : null;
  if (!ext) return null;
  return { contentType: ct, ext };
}
