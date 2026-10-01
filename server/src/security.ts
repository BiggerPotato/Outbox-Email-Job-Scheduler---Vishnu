import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { config } from './config.js';

const key = createHash('sha256').update(config.tokenEncryptionKey).digest();
export function encrypt(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return `${iv.toString('base64')}.${cipher.getAuthTag().toString('base64')}.${data.toString('base64')}`;
}
export function decrypt(value: string) {
  const [ivEncoded, tagEncoded, dataEncoded] = value.split('.');
  if (!ivEncoded || !tagEncoded || dataEncoded === undefined) throw new Error('Invalid encrypted value.');
  const iv = Buffer.from(ivEncoded, 'base64');
  const tag = Buffer.from(tagEncoded, 'base64');
  const data = Buffer.from(dataEncoded, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

export function requireUser(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) return res.status(401).json({ error: 'Sign in to continue.' });
  next();
}
