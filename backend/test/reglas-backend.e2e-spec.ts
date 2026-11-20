import { createDatabase } from '../src/prisma/db.js';

describe('Reglas propias fuera de PostgreSQL', () => {
  const db = createDatabase();
  afterAll(() => db.close());
  it('conserva la integridad estructural y retira reglas y objetos propios', async () => {
    const [schema] = await db.query(
      db.raw.sql`
      SELECT
        EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') AS postgis,
        (SELECT count(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
         WHERE n.nspname='public' AND NOT EXISTS (
           SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid
           AND d.refclassid='pg_extension'::regclass AND d.deptype='e'
         )) AS funciones,
        (SELECT count(*)::int FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
         JOIN pg_namespace n ON n.oid=c.relnamespace
         WHERE n.nspname='public' AND NOT t.tgisinternal) AS triggers,
        (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
         WHERE n.nspname='public' AND c.relkind IN ('v', 'm') AND NOT EXISTS (
           SELECT 1 FROM pg_depend d WHERE d.classid='pg_class'::regclass AND d.objid=c.oid
           AND d.refclassid='pg_extension'::regclass AND d.deptype='e'
         )) AS vistas,
        (SELECT jsonb_agg(pc.conname ORDER BY pc.conname)
         FROM pg_constraint pc JOIN pg_namespace n ON n.oid=pc.connamespace
         WHERE n.nspname='public' AND pc.contype='c') AS checks
    `
        .returnsRow({
          postgis: 'pg/bool@1',
          funciones: 'pg/int4@1',
          triggers: 'pg/int4@1',
          vistas: 'pg/int4@1',
          checks: 'pg/jsonb@1',
        })
        .build(),
    );
    expect(schema).toEqual({
      postgis: true,
      funciones: 0,
      triggers: 0,
      vistas: 0,
      checks: [
        'actividad_anac_config_id_check',
        'airports_location_check',
        'configuracion_bts_id_check',
        'etl_discarded_samples_attempt_check',
        'etl_discarded_samples_reason_check',
        'etl_discarded_samples_row_check',
        'etl_job_events_attempt_check',
        'etl_job_events_message_check',
        'etl_jobs_attempt_check',
        'etl_jobs_checksum_check',
        'etl_jobs_completion_check',
        'etl_jobs_rows_check',
        'etl_jobs_snapshot_check',
        'etl_jobs_source_uri_check',
        'etl_jobs_status_check',
        'etl_jobs_timestamps_check',
        'etl_pipelines_identity_check',
        'eurocontrol_instantaneas_checksum_check',
        'eventos_ejecucion_etl_nivel_check_6e38eb13',
        'procesos_etl_entidad_destino_check_84446cb8',
        'spatial_ref_sys_srid_check',
        'users_email_canonical_check',
        'usuarios_rol_check_09f07379',
        'valid_airport_coordinates_b3268cad',
        'vuelos_estado_check_13a8eb53',
      ],
    });
  });
});
