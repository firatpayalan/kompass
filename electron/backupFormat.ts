import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { argon2idAsync } from "@noble/hashes/argon2.js";

export type BackupFile = { name: string; data: Buffer };
const invalid = "Parola hatalı veya dosya bozuk";
const headerLength = 33;

async function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  // Electron uses BoringSSL, whose node:crypto Argon2 entry point is unsupported.
  const key = await argon2idAsync(Buffer.from(password, "utf8"), salt, {
    m: 19_456, t: 2, p: 1, dkLen: 32, version: 0x13, asyncTick: 10,
  });
  const result = Buffer.from(key);
  key.fill(0);
  return result;
}

/** The existing KMPS v1 layout, Argon2id parameters and AES-GCM tag are unchanged. */
export async function sealBackup(password: string, files: BackupFile[]): Promise<Buffer> {
  if (!password) throw new Error("Parola boş olamaz");
  const count = Buffer.alloc(4);
  count.writeUInt32BE(files.length);
  const chunks: Buffer[] = [count];
  for (const { name, data } of files) {
    const bytes = Buffer.from(name, "utf8");
    const length = Buffer.alloc(2);
    length.writeUInt16BE(bytes.length);
    const dataLength = Buffer.alloc(8);
    dataLength.writeBigUInt64BE(BigInt(data.length));
    chunks.push(length, bytes, dataLength, data);
  }
  const salt = randomBytes(16);
  const nonce = randomBytes(12);
  const key = await deriveKey(password, salt);
  const plaintext = Buffer.concat(chunks);
  try {
    const cipher = createCipheriv("aes-256-gcm", key, nonce);
    return Buffer.concat([Buffer.from("KMPS\x01", "binary"), salt, nonce, cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]);
  } finally { key.fill(0); plaintext.fill(0); }
}

export async function openBackup(password: string, blob: Buffer): Promise<BackupFile[]> {
  if (!password) throw new Error("Parola boş olamaz");
  if (blob.length < headerLength || blob.subarray(0, 4).toString() !== "KMPS" || blob[4] !== 1) throw new Error("Desteklenmeyen yedek biçimi");
  if (blob.length < headerLength + 16) throw new Error(invalid);
  const key = await deriveKey(password, blob.subarray(5, 21));
  let plaintext: Buffer;
  try {
    const cipher = createDecipheriv("aes-256-gcm", key, blob.subarray(21, 33));
    cipher.setAuthTag(blob.subarray(-16));
    plaintext = Buffer.concat([cipher.update(blob.subarray(33, -16)), cipher.final()]);
  } catch { throw new Error(invalid); }
  finally { key.fill(0); }
  try {
    let offset = 0;
    const take = (size: number): Buffer => {
      if (!Number.isSafeInteger(size) || size < 0 || size > plaintext.length - offset) throw new Error(invalid);
      const bytes = plaintext.subarray(offset, offset + size);
      offset += size;
      return bytes;
    };
    const count = take(4).readUInt32BE();
    if (count > (plaintext.length - 4) / 10) throw new Error(invalid);
    const files: BackupFile[] = [];
    const names = new Set<string>();
    for (let i = 0; i < count; i++) {
      const name = new TextDecoder("utf8", { fatal: true }).decode(take(take(2).readUInt16BE()));
      if (names.has(name)) throw new Error(invalid);
      names.add(name);
      const size = Number(take(8).readBigUInt64BE());
      files.push({ name, data: Buffer.from(take(size)) });
    }
    if (offset !== plaintext.length) throw new Error(invalid);
    return files;
  } catch { throw new Error(invalid); }
  finally { plaintext.fill(0); }
}
