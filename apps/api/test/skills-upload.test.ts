import { describe, expect, it } from 'vitest';
import { extractSkillsFromFiles, parseFrontmatter, readZipSkillFiles } from '../src/modules/admin/skills.helper.js';

/** Minimal stored (uncompressed) ZIP builder for testing yauzl extraction without external deps. */
function buildStoredZip(entries: { name: string; content: string }[]): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  // CRC-32 table
  const crcTable = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crcTable[i] = c >>> 0;
  }
  const crc32 = (buf: Buffer) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff]! ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };

  for (const e of entries) {
    const nameBuf = Buffer.from(e.name, 'utf8');
    const dataBuf = Buffer.from(e.content, 'utf8');
    const crc = crc32(dataBuf);

    const local = Buffer.alloc(30 + nameBuf.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(dataBuf.length, 18);
    local.writeUInt32LE(dataBuf.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    nameBuf.copy(local, 30);

    const central = Buffer.alloc(46 + nameBuf.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(dataBuf.length, 20);
    central.writeUInt32LE(dataBuf.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    nameBuf.copy(central, 46);

    localParts.push(local, dataBuf);
    centralParts.push(central);
    offset += local.length + dataBuf.length;
  }

  const centralBuf = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralBuf, eocd]);
}

describe('skills.helper', () => {
  it('parses YAML frontmatter name and description', () => {
    const md = `---\nname: dental-motion\ndescription: "Panduan animasi edukasi gigi"\n---\n# Heading\nBody text`;
    const fm = parseFrontmatter(md);
    expect(fm.name).toBe('dental-motion');
    expect(fm.description).toBe('Panduan animasi edukasi gigi');
    expect(fm.body).toContain('# Heading');
  });

  it('extracts multi-skill bundles from folder files and skips __MACOSX', () => {
    const bundles = extractSkillsFromFiles([
      { path: 'skills/alpha/SKILL.md', content: '---\nname: alpha-skill\ndescription: Alpha desc\n---\n# Alpha' },
      { path: 'skills/alpha/references/guide.md', content: '# Extra reference' },
      { path: 'skills/beta/SKILL.md', content: '# Beta\nBeta description line' },
      { path: '__MACOSX/skills/alpha/._SKILL.md', content: 'junk' },
    ]);
    expect(bundles).toHaveLength(2);
    expect(bundles[0]!.name).toBe('alpha-skill');
    expect(bundles[0]!.filesCount).toBe(2);
    expect(bundles[1]!.name).toBe('beta');
    expect(bundles[1]!.description).toBe('Beta description line');
  });

  it('reads real ZIP buffer via yauzl and rejects path traversal', async () => {
    const goodZip = buildStoredZip([
      { name: 'my-skill/SKILL.md', content: '---\nname: zip-skill\ndescription: From zip\n---\n# Hello ZIP' },
      { name: 'my-skill/refs/tips.md', content: '# Tips' },
      { name: 'my-skill/scripts/helper.py', content: 'print("hello from helper")' },
    ]);
    const files = await readZipSkillFiles(goodZip);
    expect(files).toHaveLength(3);
    const bundles = extractSkillsFromFiles(files, 'my-skill');
    expect(bundles).toHaveLength(1);
    expect(bundles[0]!.name).toBe('zip-skill');
    expect(bundles[0]!.filesCount).toBe(3);
    expect(bundles[0]!.fileList).toContain('scripts/helper.py');
    expect(bundles[0]!.totalBytes).toBeGreaterThan(50);

    const badZip = buildStoredZip([{ name: '../evil/SKILL.md', content: '# Evil' }]);
    await expect(readZipSkillFiles(badZip)).rejects.toThrow();
  });
});
