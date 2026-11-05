import { BadRequestException } from '@nestjs/common';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { get } from 'node:https';
import type { IncomingMessage } from 'node:http';
import type { PipelineConnectionConfig } from './interfaces/pipeline-configuration.js';

function envList(nombre: string, fallback = ''): string[] {
  return (process.env[nombre] ?? fallback)
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function validateSourceUrl(input: string): URL {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new BadRequestException('URL de catálogo inválida');
  }
  const hosts = envList(
    'ETL_ALLOWED_HOSTS',
    'raw.githubusercontent.com,davidmegginson.github.io',
  );
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.port && url.port !== '443') ||
    isIP(url.hostname) ||
    !hosts.includes(url.hostname)
  ) {
    throw new BadRequestException(
      'La fuente debe ser HTTPS, sin credenciales ni parámetros, y pertenecer a ETL_ALLOWED_HOSTS',
    );
  }
  return url;
}

export function sourceHeaders(
  conexion: PipelineConnectionConfig,
): Record<string, string> {
  const headers: Record<string, string> = {};
  const allowed = envList('ETL_ALLOWED_CREDENTIAL_REFS');
  for (const header of conexion.headers ?? []) {
    if (
      !/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(header.key) ||
      /^(host|connection|content-length|transfer-encoding|proxy-.*|cookie)$/i.test(
        header.key,
      ) ||
      !allowed.includes(header.referenciaCredencial) ||
      !process.env[header.referenciaCredencial]
    ) {
      throw new BadRequestException(
        'Header o referencia de credencial no autorizados',
      );
    }
    const value = process.env[header.referenciaCredencial]!;
    if (/[\r\n]/.test(value))
      throw new BadRequestException('Credencial inválida');
    headers[header.key] = value;
  }
  return headers;
}

function publicAddress(address: string): boolean {
  if (isIP(address) !== 4) return false;
  const [a, b] = address.split('.').map(Number);
  return !(
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 0 || b === 168)) ||
    (a === 198 && (b === 18 || b === 19))
  );
}

// Pin the validated IPv4 address so a second DNS lookup cannot bypass SSRF checks.
export async function openCsvSource(
  conexion: PipelineConnectionConfig,
  tiempoLimiteSegundos = 300,
): Promise<IncomingMessage> {
  const url = validateSourceUrl(conexion.urlEndpoint);
  const headers = sourceHeaders(conexion);
  const signal = AbortSignal.timeout(tiempoLimiteSegundos * 1000);
  let records: Awaited<ReturnType<typeof lookup>>[];
  try {
    records = await Promise.race([
      lookup(url.hostname, { all: true, family: 4 }),
      new Promise<never>((_, reject) =>
        signal.addEventListener('abort', () => reject(new Error('timeout')), {
          once: true,
        }),
      ),
    ]);
  } catch {
    throw new BadRequestException(
      'No fue posible resolver la fuente de catálogo',
    );
  }
  if (
    !records.length ||
    records.some(({ address }) => !publicAddress(address))
  ) {
    throw new BadRequestException(
      'La fuente de catálogo resuelve a una dirección no permitida',
    );
  }
  return new Promise<IncomingMessage>((resolve, reject) => {
    const request = get(
      url,
      {
        headers,
        family: 4,
        signal,
        lookup: (_hostname, _options, callback) =>
          callback(null, records[0].address, 4),
      },
      (response) => {
        if (response.statusCode !== 200) {
          response.destroy();
          reject(
            new BadRequestException(
              `La fuente respondió HTTP ${response.statusCode ?? 'desconocido'}; no se siguen redirecciones`,
            ),
          );
          return;
        }
        if (
          response.headers['content-encoding'] &&
          response.headers['content-encoding'] !== 'identity'
        ) {
          response.destroy();
          reject(
            new BadRequestException(
              'La fuente debe entregar CSV sin compresión HTTP',
            ),
          );
          return;
        }
        resolve(response);
      },
    );
    request.on('error', () =>
      reject(
        new BadRequestException(
          'No fue posible descargar la fuente de catálogo',
        ),
      ),
    );
  });
}

export function redactSourceRow(
  row: Record<string, string>,
  conexion: PipelineConnectionConfig,
): Record<string, string> {
  const secrets = (conexion.headers ?? [])
    .map(({ referenciaCredencial }) => process.env[referenciaCredencial])
    .filter((value): value is string => Boolean(value));
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key,
      /token|secret|password|authorization|api.?key|credential/i.test(key)
        ? '[REDACTED]'
        : secrets.reduce(
            (text, secret) => text.split(secret).join('[REDACTED]'),
            value,
          ),
    ]),
  );
}
