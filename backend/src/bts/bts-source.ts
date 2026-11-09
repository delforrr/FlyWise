import { mkdtemp, rm } from 'node:fs/promises';
import { createWriteStream, statSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Transform, Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { crc32 } from 'node:zlib';
import yauzl, { type Entry, type ZipFile } from 'yauzl';
import { openCsvSource } from '../etl/http-source.js';

const MAX_ZIP = 128 * 1024 * 1024;
const MAX_CSV = 1024 * 1024 * 1024;

export async function descargarBts(url: string) {
  const directory = await mkdtemp(join(tmpdir(), 'flywise-bts-'));
  const path = join(directory, 'mes.zip');
  try {
    const source = await openCsvSource(
      {
        tipoFuente: 'http_stream',
        metodoHttp: 'GET',
        formatoDatos: 'csv',
        urlEndpoint: url,
      },
      600,
      ['www.transtats.bts.gov'],
    );
    let bytes = 0;
    await pipeline(
      source,
      new Transform({
        transform(chunk: Buffer, _encoding, done) {
          bytes += chunk.length;
          done(
            bytes > MAX_ZIP ? new Error('ZIP BTS supera 128 MiB') : null,
            chunk,
          );
        },
      }),
      createWriteStream(path),
    );
    return {
      path,
      cleanup: () => rm(directory, { recursive: true, force: true }),
    };
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}

export async function abrirCsvBts(
  path: string,
): Promise<{ stream: Readable; close: () => void }> {
  if (statSync(path).size > MAX_ZIP) throw new Error('ZIP BTS supera 128 MiB');
  const zip = await new Promise<ZipFile>((resolve, reject) =>
    yauzl.open(
      path,
      { lazyEntries: true, autoClose: false, validateEntrySizes: true },
      (error, file) => (error ? reject(error) : resolve(file)),
    ),
  );
  try {
    const entry = await new Promise<Entry>((resolve, reject) => {
      let count = 0,
        bytes = 0;
      const csvEntries: Entry[] = [];
      zip.on('error', reject);
      zip.on('entry', (entry: Entry) => {
        count++;
        bytes += entry.uncompressedSize;
        if (
          count > 16 ||
          bytes > MAX_CSV ||
          entry.generalPurposeBitFlag & 1 ||
          /(^\/|\.\.|\\)/.test(entry.fileName)
        ) {
          reject(
            new Error('ZIP BTS inválido o excede límites de descompresión'),
          );
          return;
        }
        if (/\.csv$/i.test(entry.fileName)) csvEntries.push(entry);
        zip.readEntry();
      });
      zip.on('end', () =>
        csvEntries.length === 1
          ? resolve(csvEntries[0])
          : reject(new Error('BTS debe contener exactamente un CSV')),
      );
      zip.readEntry();
    });
    const input = await new Promise<Readable>((resolve, reject) =>
      zip.openReadStream(entry, (error, stream) =>
        error ? reject(error) : resolve(stream),
      ),
    );
    // El consumidor inicia el flujo después de registrar el intento en la base.
    let fallo: Error | undefined;
    input.on('error', (error) => {
      fallo = error;
    });
    zip.on('error', (error: Error) => input.destroy(error));
    const stream = Readable.from(
      (async function* () {
        let bytes = 0;
        let checksum = 0;
        if (fallo) throw fallo;
        for await (const chunk of input as AsyncIterable<Buffer>) {
          bytes += chunk.length;
          if (bytes > MAX_CSV) throw new Error('CSV BTS supera 1 GiB');
          checksum = crc32(chunk, checksum);
          yield chunk;
        }
        if (checksum !== entry.crc32)
          throw new Error('El CRC del CSV BTS no coincide');
      })(),
      { objectMode: false },
    );
    return {
      stream,
      close: () => {
        input.destroy();
        stream.destroy();
        zip.close();
      },
    };
  } catch (error) {
    zip.close();
    throw error;
  }
}
