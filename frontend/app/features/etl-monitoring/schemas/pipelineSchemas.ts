import { z } from "zod";
import type { ProcesoEtl, TargetEntity } from "../types/etl";
import { TARGET_FIELDS_CATALOG } from "../types/etl";

// 1. Esquema Zod para Identidad (Paso 1)
export const pipelineIdentitySchema = z.object({
  nombre: z
    .string('El nombre del servicio es obligatorio.')
    .trim()
    .min(1, 'El nombre del servicio es obligatorio.')
    .min(3, 'El nombre debe contener al menos 3 caracteres.'),
  nombreConjunto: z
    .string('El nombre del dataset es obligatorio.')
    .trim()
    .min(1, 'El nombre del dataset es obligatorio.')
    .min(2, 'El nombre del dataset debe contener al menos 2 caracteres.'),
  descripcion: z.string().optional().default(''),
  icon: z.string().optional().default('i-lucide-database'),
  entidadDestino: z.enum(['aeropuertos', 'aerolineas', 'paises', 'rutas', 'otp_metrics'], {
    message: 'Debe seleccionar una entidad destino.',
  }),
});

export type PipelineIdentityForm = z.infer<typeof pipelineIdentitySchema>;

// 2. Esquema Zod para Endpoint & Conexión (Paso 2)
export const pipelineConnectionSchema = z
  .object({
    tipoFuente: z.literal('http_stream'),
    metodoHttp: z.literal('GET'),
    formatoDatos: z.literal('csv'),
    urlEndpoint: z
      .string('La URL del endpoint es obligatoria.')
      .trim()
      .min(1, 'La URL del endpoint es obligatoria.')
      .refine(
        (val) => val !== 'https://' && val !== 'http://',
        'La URL del endpoint es obligatoria.',
      )
      .refine(
        (val) => val.startsWith('http://') || val.startsWith('https://'),
        'La URL debe comenzar con http:// o https://.',
      )
      .refine((val) => {
        const sanitized = val.replace(/\{[^}]+\}/g, 'placeholder');
        try {
          new URL(sanitized);
          return true;
        } catch {
          return false;
        }
      }, 'La sintaxis de la URL es inválida.'),
    separadorCsv: z.string().optional(),
    csvConCabecera: z.boolean().optional(),
    rootJsonPath: z.string().optional(),
    headers: z
      .array(
        z.object({
          key: z.string(),
          referenciaCredencial: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/, 'Use el nombre de una variable del servidor.'),
        }),
      )
      .optional(),
  })
  .refine(
    (data) => {
      if (data.formatoDatos === 'csv' && data.separadorCsv !== undefined) {
        return data.separadorCsv.length > 0;
      }
      return true;
    },
    {
      message: 'El delimitador CSV no puede estar vacío.',
      path: ['separadorCsv'],
    },
  );

export type PipelineConnectionForm = z.infer<typeof pipelineConnectionSchema>;

// 3. Esquema Zod para Reglas de Mapeo (Paso 3)
export const pipelineSchemaMappingRuleSchema = z.object({
  columnaOrigen: z.string().optional().default(''),
  campoDestino: z.string(),
  transform: z
    .enum([
      'none',
      'uppercase',
      'trim',
      'to_number',
      'to_boolean',
      'srid_4326_point',
    ])
    .optional(),
  required: z.boolean().optional(),
});

// 4. Esquema Zod para Planificación y RNF-04 (Paso 4)
export const pipelineScheduleConfigSchema = z
  .object({
    cronPreset: z.enum([
      'manual',
      'hourly',
      'daily',
      'weekly',
      'monthly',
      'custom',
    ]),
    expresionCron: z.string().optional().default(''),
    scheduleDescription: z.string().optional().default('Manual'),
    tamanoLote: z
      .number()
      .min(1000, 'Mínimo 1.000 filas por lote (RNF-04).')
      .max(5000, 'Máximo 5.000 filas por lote (RNF-04).'),
    tiempoLimiteSegundos: z.number().int().min(1).max(3600),
    maximoReintentos: z.number().int().min(0).max(10),
  })
  .refine(
    (data) => {
      if (data.cronPreset === 'custom') {
        if (!data.expresionCron) return false;
        const parts = data.expresionCron.trim().split(/\s+/);
        return parts.length === 5;
      }
      return true;
    },
    {
      message:
        'La expresión cron personalizada debe contener 5 campos (ej. 0 4 * * *).',
      path: ['expresionCron'],
    },
  );

export type PipelineScheduleConfigForm = z.infer<
  typeof pipelineScheduleConfigSchema
>;

// 5. Esquema Zod Completo de Pipeline
export const pipelineSchema = z.unknown().superRefine((val, ctx) => {
  const data = (val && typeof val === 'object' ? val : {}) as Partial<ProcesoEtl>;

  // 1. Nombre del servicio
  const nameRes = z
    .string('El nombre del servicio es obligatorio.')
    .trim()
    .min(1, 'El nombre del servicio es obligatorio.')
    .min(3, 'El nombre debe contener al menos 3 caracteres.')
    .safeParse(data.nombre);
  if (!nameRes.success) {
    for (const issue of nameRes.error.issues) {
      ctx.addIssue({ ...issue, path: ['nombre'] });
    }
  }

  // 2. Nombre del dataset
  const datasetRes = z
    .string('El nombre del dataset es obligatorio.')
    .trim()
    .min(1, 'El nombre del dataset es obligatorio.')
    .min(2, 'El nombre del dataset debe contener al menos 2 caracteres.')
    .safeParse(data.nombreConjunto);
  if (!datasetRes.success) {
    for (const issue of datasetRes.error.issues) {
      ctx.addIssue({ ...issue, path: ['nombreConjunto'] });
    }
  }

  // 3. Endpoint URL (en conexion.urlEndpoint)
  const url = data.conexion?.urlEndpoint;
  const urlRes = z
    .string('La URL del endpoint es obligatoria.')
    .trim()
    .min(1, 'La URL del endpoint es obligatoria.')
    .refine(
      (v) => v !== 'https://' && v !== 'http://',
      'La URL del endpoint es obligatoria.',
    )
    .refine(
      (v) => v.startsWith('http://') || v.startsWith('https://'),
      'La URL debe comenzar con http:// o https://.',
    )
    .refine((v) => {
      const sanitized = v.replace(/\{[^}]+\}/g, 'placeholder');
      try {
        new URL(sanitized);
        return true;
      } catch {
        return false;
      }
    }, 'La sintaxis de la URL es inválida.')
    .safeParse(url);
  if (!urlRes.success) {
    for (const issue of urlRes.error.issues) {
      ctx.addIssue({ ...issue, path: ['urlEndpoint'] });
    }
  }

  // 4. Mapeo de campos requeridos
  const entidadDestino = (data.entidadDestino || 'otp_metrics') as TargetEntity;
  const targetDefs = TARGET_FIELDS_CATALOG[entidadDestino] || [];
  const requiredDefs = targetDefs.filter((d) => d.required);
  const mappings = Array.isArray(data.mapeoEsquema) ? data.mapeoEsquema : [];

  if (!data.mapeoEsquema || mappings.length === 0) {
    ctx.addIssue({
      code: 'custom',
      message: 'Debe configurar las reglas de mapeo de campos requeridos.',
      path: ['mapeoEsquema'],
    });
  } else {
    const unmapped = requiredDefs.filter((def) => {
      const rule = mappings.find((m) => m.campoDestino === def.key);
      return !rule || !rule.columnaOrigen || !rule.columnaOrigen.trim();
    });

    if (unmapped.length > 0) {
      ctx.addIssue({
        code: 'custom',
        message: `Faltan mapear los siguientes campos requeridos: ${unmapped.map((d) => d.label).join(', ')}.`,
        path: ['mapeoEsquema'],
      });
    }
  }

  // 5. Expresión Cron si es personalizada
  if (data.configuracionProgramacion?.expresionCron) {
    const cron = data.configuracionProgramacion.expresionCron?.trim() || '';
    const parts = cron.split(/\s+/);
    if (parts.length !== 5) {
      ctx.addIssue({
        code: 'custom',
        message:
          'La expresión cron personalizada debe contener 5 campos (ej. 0 4 * * *).',
        path: ['expresionCron'],
      });
    }
  }
});

export type PipelineSchemaInput = Partial<ProcesoEtl>;

// 6. Esquema Zod para Disparador Manual (EtlTriggerModal)
export const triggerSyncSchema = z.object({
  procesoId: z.string().min(1, 'El identificador del proceso es obligatorio.'),
});

export type TriggerSyncForm = z.infer<typeof triggerSyncSchema>;
