import crypto from 'crypto';
import { Transform } from 'stream';

/**
 * A pass-through transform that computes a SHA-256 checksum and byte count
 * of everything flowing through it, without buffering the whole stream.
 */
export class HashingStream extends Transform {
  private hash = crypto.createHash('sha256');
  public bytes = 0;

  override _transform(chunk: Buffer, _enc: BufferEncoding, cb: (err?: Error) => void): void {
    this.hash.update(chunk);
    this.bytes += chunk.length;
    this.push(chunk);
    cb();
  }

  digest(): string {
    return this.hash.digest('hex');
  }
}
