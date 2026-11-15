import { createReadStream } from 'node:fs';
import { join } from 'node:path';
import { Readable } from 'node:stream';

export function catalogFile(path: string) {
  return Readable.from(
    (async function* () {
      yield* createReadStream(path);
    })(),
  );
}

export function openFlightsFixture(filename: string) {
  const directory = process.env.OPENFLIGHTS_FIXTURE_DIR;
  if (!directory)
    throw new Error('Configurá OPENFLIGHTS_FIXTURE_DIR según el README.');
  return join(directory, filename);
}
