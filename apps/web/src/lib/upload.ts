'use client';

import { uploadProductImageAction } from '@/actions/uploads';

export async function uploadProductImage(file: File): Promise<string> {
  const fd = new FormData();
  fd.append('image', file);
  const res = await uploadProductImageAction(fd);
  if (!res.ok) throw new Error(res.message);
  return res.payload.publicUrl;
}
