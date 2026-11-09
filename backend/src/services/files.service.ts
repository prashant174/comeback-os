import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import mongoose from 'mongoose';
import type { Response } from 'express';
import { ApiError } from '../utils/ApiError.js';

/**
 * Images live in MongoDB GridFS so they survive free-tier hosts with an
 * ephemeral disk (Render free) and are included in mongodump backups.
 * Stored reference format: "gridfs:<ObjectId>". Older references that are
 * plain filenames are served from UPLOAD_DIR for backwards compatibility.
 */
export const LEGACY_DIR = path.resolve(process.env.UPLOAD_DIR ?? 'uploads');
const PREFIX = 'gridfs:';

const bucket = () => new mongoose.mongo.GridFSBucket(mongoose.connection.db!, { bucketName: 'uploads' });

export async function saveImage(file: Express.Multer.File, owner: string): Promise<string> {
  const stream = bucket().openUploadStream(file.originalname.slice(0, 100) || 'image', { metadata: { owner, contentType: file.mimetype } });
  await new Promise<void>((resolve, reject) => {
    Readable.from(file.buffer).pipe(stream).on('finish', () => resolve()).on('error', reject);
  });
  return PREFIX + String(stream.id);
}

export async function sendImage(ref: string, res: Response) {
  res.setHeader('Cache-Control', 'private, max-age=86400');
  if (!ref.startsWith(PREFIX)) {
    const p = path.join(LEGACY_DIR, path.basename(ref));
    if (!fs.existsSync(p)) throw ApiError.notFound('Image not found');
    return res.sendFile(p);
  }
  const id = new mongoose.Types.ObjectId(ref.slice(PREFIX.length));
  const [doc] = await bucket().find({ _id: id }).toArray();
  if (!doc) throw ApiError.notFound('Image not found');
  res.setHeader('Content-Type', (doc.metadata?.contentType as string) ?? 'application/octet-stream');
  res.setHeader('Content-Length', String(doc.length));
  await new Promise<void>((resolve, reject) => {
    bucket().openDownloadStream(id).on('error', reject).on('end', () => resolve()).pipe(res);
  });
}

export async function deleteImage(ref: string | null | undefined) {
  if (!ref) return;
  try {
    if (ref.startsWith(PREFIX)) await bucket().delete(new mongoose.Types.ObjectId(ref.slice(PREFIX.length)));
    else await fs.promises.unlink(path.join(LEGACY_DIR, path.basename(ref)));
  } catch { /* already gone */ }
}
