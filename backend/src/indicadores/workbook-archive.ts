import { createWriteStream } from 'node:fs';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { text } from 'node:stream/consumers';
import { pipeline } from 'node:stream/promises';
import { openPromise, type Entry } from 'yauzl';
import ZipStream from 'zip-stream';

const MAX_SOURCE = 32 * 1024 * 1024;
const MAX_EXPANSION = 128 * 1024 * 1024;
const workbookParts = [
  'xl/workbook.xml',
  'xl/_rels/workbook.xml.rels',
  'xl/sharedStrings.xml',
  'xl/styles.xml',
];

function notice(xml: string) {
  const entities: Record<string, string> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
  };
  return Array.from(
    xml.matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g),
    ([, value]) =>
      value.replace(
        /&(amp|lt|gt|quot|apos);/g,
        (_, entity: string) => entities[entity],
      ),
  ).join('\n');
}

// ExcelJS reads local ZIP records. Give it only entries verified through the central directory.
export async function withWorkbookArchive<T>(
  path: string,
  read: (verifiedPath: string, notices: string[]) => Promise<T>,
): Promise<T> {
  if ((await stat(path)).size > MAX_SOURCE)
    throw new Error('XLSX supera 32 MiB');
  const directory = await mkdtemp(join(tmpdir(), 'flywise-xlsx-'));
  try {
    const verifiedPath = join(directory, 'verificado.xlsx');
    const zip = await openPromise(path, {
      lazyEntries: true,
      autoClose: false,
      strictFileNames: true,
      validateEntrySizes: true,
    });
    const notices: string[] = [];
    try {
      const entries = new Map<string, Entry>();
      let expansion = 0;
      for await (const entry of zip.eachEntry()) {
        const { fileName, uncompressedSize } = entry;
        expansion += uncompressedSize;
        if (
          entries.size >= 500 ||
          expansion > MAX_EXPANSION ||
          entry.isEncrypted() ||
          entries.has(fileName) ||
          (fileName === 'xl/sharedStrings.xml' &&
            uncompressedSize > 4 * 1024 * 1024)
        ) {
          throw new Error('Límite de descompresión XLSX o entrada duplicada');
        }
        entries.set(fileName, entry);
      }
      for (const entry of entries.values()) {
        if (!/^xl\/drawings\/drawing\d+\.xml$/.test(entry.fileName)) continue;
        if (entry.uncompressedSize > 1024 * 1024)
          throw new Error('Aviso XLSX demasiado grande');
        const value = notice(
          await text(await zip.openReadStreamPromise(entry)),
        );
        if (value) notices.push(value);
      }
      const archive = new ZipStream();
      const writing = pipeline(
        archive,
        createWriteStream(verifiedPath, { flags: 'wx' }),
      );
      void writing.catch(() => {});
      try {
        const worksheets = [...entries.keys()].filter((name) =>
          /^xl\/worksheets\/sheet\d+\.xml$/.test(name),
        );
        for (const name of [...workbookParts, ...worksheets]) {
          const entry = entries.get(name);
          if (!entry) continue;
          const stream = await zip.openReadStreamPromise(entry);
          try {
            const appended = new Promise<void>((resolve, reject) => {
              stream.once('error', reject);
              archive.entry(stream, { name }, (error) =>
                error ? reject(error) : resolve(),
              );
            });
            await Promise.race([appended, writing]);
          } finally {
            stream.destroy();
          }
        }
        archive.finalize();
        await writing;
      } catch (error) {
        archive.destroy();
        await writing.catch(() => {});
        throw error;
      }
    } finally {
      zip.close();
    }
    return await read(verifiedPath, notices);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
