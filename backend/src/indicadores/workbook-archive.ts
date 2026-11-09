import { stat } from 'node:fs/promises';
import { open, type Entry } from 'yauzl';

// Validate actual expanded bytes, not only the size declared by the ZIP directory.
export async function validateWorkbookArchive(path: string) {
  if ((await stat(path)).size > 32 * 1024 * 1024)
    throw new Error('XLSX supera 32 MiB');
  return new Promise<string[]>((resolve, reject) => {
    open(
      path,
      { lazyEntries: true, validateEntrySizes: true },
      (error, zip) => {
        if (error || !zip) {
          reject(error ?? new Error('XLSX inválido'));
          return;
        }
        let total = 0,
          entries = 0;
        const notices: string[] = [];
        const fail = (error: unknown) => {
          zip.close();
          reject(error instanceof Error ? error : new Error('XLSX inválido'));
        };
        zip.on('error', fail);
        zip.on('end', () => resolve(notices));
        zip.on('entry', (entry: Entry) => {
          if (
            ++entries > 500 ||
            entry.uncompressedSize > 128 * 1024 * 1024 ||
            entry.isEncrypted() ||
            (entry.fileName === 'xl/sharedStrings.xml' &&
              entry.uncompressedSize > 4 * 1024 * 1024)
          ) {
            fail(new Error('Límite de descompresión XLSX'));
            return;
          }
          zip.openReadStream(entry, (error, stream) => {
            if (error || !stream) {
              fail(error ?? new Error('Entrada ZIP inválida'));
              return;
            }
            void (async () => {
              const drawing = /^xl\/drawings\/drawing\d+\.xml$/.test(
                entry.fileName,
              );
              let xml = '';
              for await (const chunk of stream) {
                const bytes = chunk as Buffer;
                total += bytes.length;
                if (total > 128 * 1024 * 1024)
                  throw new Error('Límite de descompresión XLSX');
                if (drawing) {
                  xml += bytes.toString('utf8');
                  if (xml.length > 1024 * 1024)
                    throw new Error('Aviso XLSX demasiado grande');
                }
              }
              if (drawing) {
                const texts = Array.from(
                  xml.matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g),
                  (match) =>
                    match[1].replace(
                      /&(amp|lt|gt|quot|apos);/g,
                      (_, entity: string) =>
                        ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" })[
                          entity
                        ] ?? '',
                    ),
                );
                if (texts.length) notices.push(texts.join('\n'));
              }
              zip.readEntry();
            })().catch(fail);
          });
        });
        zip.readEntry();
      },
    );
  });
}
