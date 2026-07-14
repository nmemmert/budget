import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

// Minimal tar builder (POSIX ustar) — no deps
function encodeHeader(name: string, size: number): Buffer {
  const h = Buffer.alloc(512, 0);
  const write = (val: string, offset: number, len: number) =>
    h.write(val.slice(0, len), offset, 'ascii');

  write(name.slice(0, 99), 0, 100);       // name
  write('0000644\0', 100, 8);             // mode
  write('0000000\0', 108, 8);             // uid
  write('0000000\0', 116, 8);             // gid
  write(size.toString(8).padStart(11, '0') + '\0', 124, 12); // size
  write(Math.floor(Date.now() / 1000).toString(8).padStart(11, '0') + '\0', 136, 12); // mtime
  h.write('        ', 148, 8, 'ascii');   // checksum placeholder
  h[156] = 0x30;                          // type '0' = regular file
  write('ustar\0', 257, 6);
  write('00', 263, 2);

  let ck = 0;
  for (let i = 0; i < 512; i++) ck += h[i];
  h.write(ck.toString(8).padStart(6, '0') + '\0 ', 148, 8, 'ascii');

  return h;
}

function walkDir(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...walkDir(full));
    else if (entry.isFile()) results.push(full);
  }
  return results;
}

export function buildTarGz(sourceDir: string): Buffer {
  const files = walkDir(sourceDir);
  const blocks: Buffer[] = [];

  for (const file of files) {
    const content = fs.readFileSync(file);
    const relName = 'data/' + path.relative(sourceDir, file);
    blocks.push(encodeHeader(relName, content.length));
    // file content padded to 512-byte boundary
    const padded = Buffer.alloc(Math.ceil(content.length / 512) * 512, 0);
    content.copy(padded);
    blocks.push(padded);
  }

  // two 512-byte zero blocks = end of archive
  blocks.push(Buffer.alloc(1024, 0));

  const tar = Buffer.concat(blocks);
  return zlib.gzipSync(tar);
}

export async function extractTarGz(buffer: Buffer, destDir: string): Promise<void> {
  const tar = zlib.gunzipSync(buffer);
  let offset = 0;

  while (offset + 512 <= tar.length) {
    const header = tar.slice(offset, offset + 512);
    offset += 512;

    // All-zero block = end of archive
    if (header.every(b => b === 0)) break;

    const name = header.toString('ascii', 0, 100).replace(/\0/g, '').trim();
    const size = parseInt(header.toString('ascii', 124, 136).trim(), 8) || 0;
    const type = String.fromCharCode(header[156]);

    const dataBlocks = Math.ceil(size / 512) * 512;

    if (type === '0' || type === '\0') {
      // Strip leading 'data/' prefix and resolve inside destDir
      const rel = name.replace(/^data\//, '');
      if (!rel) { offset += dataBlocks; continue; }
      const dest = path.join(destDir, rel);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, tar.slice(offset, offset + size));
    }

    offset += dataBlocks;
  }
}
