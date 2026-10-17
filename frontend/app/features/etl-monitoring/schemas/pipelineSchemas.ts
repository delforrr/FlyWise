import { z } from "zod";
import type { EtlPipeline, TargetEntity } from "../types/etl";
import { TARGET_FIELDS_CATALOG } from "../types/etl";

// 1. Esquema Zod para Identidad (Paso 1)
export const pipelineIdentitySchema = z.object({
  name: z
    .string('El nombre del servicio es obligatorio.')
    .trim()
    .min(1, 'El nombre del servicio es obligatorio.')
    .min(3, 'El nombre debe contener al menos 3 caracteres.'),
  datasetName: z
    .string('El nombre del dataset es obligatorio.')
    .trim()
    .min(1, 'El nombre del dataset es obligatorio.')
    .min(2, 'El nombre del dataset debe contener al menos 2 caracteres.'),
  description: z.string().optional().default(''),
  icon: z.string().optional().default('i-lucide-database'),
  targetEntity: z.enum(['airports', 'routes', 'otp_metrics'], {
    message: 'Debe seleccionar una entidad destino.',
  }),
});

export type PipelineIdentityForm = z.infer<typeof pipelineIdentitySchema>;

// 2. Esquema Zod para Endpoint & Conexión (Paso 2)
export const pipelineConnectionSchema = z
  .object({
    sourceType: z.enum(['http_stream', 'rest_api', 's3_bucket']),
    httpMethod: z.enum(['GET', 'POST']),
    dataFormat: z.enum(['csv', 'json', 'jsonl']),
    endpointUrl: z
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
    csvDelimiter: z.string().optional(),
    csvHasHeader: z.boolean().optional(),
    rootJsonPath: z.string().optional(),
    headers: z
      .array(
        z.object({
          key: z.string(),
          value: z.string(),
        }),
      )
      .optional(),
  })
  .refine(
    (data) => {
      if (data.dataFormat === 'csv' && data.csvDelimiter !== undefined) {
        return data.csvDelimiter.length > 0;
      }
      return true;
    },
    {
      message: 'El delimitador CSV no puede estar vacío.',
      path: ['csvDelimiter'],
    },
  );

export type PipelineConnectionForm = z.infer<typeof pipelineConnectionSchema>;

// 3. Esquema Zod para Reglas de Mapeo (Paso 3)
export const pipelineSchemaMappingRuleSchema = z.object({
  sourceColumn: z.string().optional().default(''),
  targetField: z.string(),
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
    cronExpression: z.string().optional().default(''),
    scheduleDescription: z.string().optional().default('Manual'),
    batchSize: z
      .number()
      .min(1000, 'Mínimo 1.000 filas por lote (RNF-04).')
      .max(5000, 'Máximo 5.000 filas por lote (RNF-04).'),
    concurrency: z.number().min(1).max(6),
    timeoutSeconds: z.number().min(10),
    maxRetries: z.number().min(1).max(5),
  })
  .refine(
    (data) => {
      if (data.cronPreset === 'custom') {
        if (!data.cronExpression) return false;
        const parts = data.cronExpression.trim().split(/\s+/);
        return parts.length === 5;
      }
      return true;
    },
    {
      message:
        'La expresión cron personalizada debe contener 5 campos (ej. 0 4 * * *).',
      path: ['cronExpression'],
    },
  );

export type PipelineScheduleConfigForm = z.infer<
  typeof pipelineScheduleConfigSchema
>;

// 5. Esquema Zod Completo de Pipeline
export const pipelineSchema = z.any().superRefine((val, ctx) => {
  const data = (val && typeof val === 'object' ? val : {}) as Partial<EtlPipeline>;

  // 1. Nombre del servicio
  const nameRes = z
    .string('El nombre del servicio es obligatorio.')
    .trim()
    .min(1, 'El nombre del servicio es obligatorio.')
    .min(3, 'El nombre debe contener al menos 3 caracteres.')
    .safeParse(data.name);
  if (!nameRes.success) {
    for (const issue of nameRes.error.issues) {
      ctx.addIssue({ ...issue, path: ['name'] });
    }
  }

  // 2. Nombre del dataset
  const datasetRes = z
    .string('El nombre del dataset es obligatorio.')
    .trim()
    .min(1, 'El nombre del dataset es obligatorio.')
    .min(2, 'El nombre del dataset debe contener al menos 2 caracteres.')
    .safeParse(data.datasetName);
  if (!datasetRes.success) {
    for (const issue of datasetRes.error.issues) {
      ctx.addIssue({ ...issue, path: ['datasetName'] });
    }
  }

  // 3. Endpoint URL (en connection.endpointUrl)
  const url = data.connection?.endpointUrl;
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
      ctx.addIssue({ ...issue, path: ['endpointUrl'] });
    }
  }

  // 4. Mapeo de campos requeridos
  const targetEntity = (data.targetEntity || 'otp_metrics') as TargetEntity;
  const targetDefs = TARGET_FIELDS_CATALOG[targetEntity] || [];
  const requiredDefs = targetDefs.filter((d) => d.required);
  const mappings = Array.isArray(data.schemaMapping) ? data.schemaMapping : [];

  if (!data.schemaMapping || mappings.length === 0) {
    ctx.addIssue({
      code: 'custom',
      message: 'Debe configurar las reglas de mapeo de campos requeridos.',
      path: ['schemaMapping'],
    });
  } else {
    const unmapped = requiredDefs.filter((def) => {
      const rule = mappings.find((m) => m.targetField === def.key);
      return !rule || !rule.sourceColumn || !rule.sourceColumn.trim();
    });

    if (unmapped.length > 0) {
      ctx.addIssue({
        code: 'custom',
        message: `Faltan mapear los siguientes campos requeridos: ${unmapped.map((d) => d.label).join(', ')}.`,
        path: ['schemaMapping'],
      });
    }
  }

  // 5. Expresión Cron si es personalizada
  if (data.scheduleConfig?.cronPreset === 'custom') {
    const cron = data.scheduleConfig.cronExpression?.trim() || '';
    const parts = cron.split(/\s+/);
    if (parts.length !== 5) {
      ctx.addIssue({
        code: 'custom',
        message:
          'La expresión cron personalizada debe contener 5 campos (ej. 0 4 * * *).',
        path: ['cronExpression'],
      });
    }
  }
});

export type PipelineSchemaInput = Partial<EtlPipeline>;

// 6. Esquema Zod para Disparador Manual (EtlTriggerModal)
export const triggerSyncSchema = z.object({
  pipelineId: z.string().min(1, 'El identificador del pipeline es obligatorio.'),
  mode: z.enum(['incremental', 'full']),
  dryRun: z.boolean(),
  batchSize: z
    .number()
    .min(1000, 'El tamaño de lote mínimo es 1.000 filas (RNF-04).')
    .max(5000, 'El tamaño de lote máximo es 5.000 filas (RNF-04).'),
});

export type TriggerSyncForm = z.infer<typeof triggerSyncSchema>;
