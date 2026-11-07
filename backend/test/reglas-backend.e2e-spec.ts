import { createDatabase } from '../src/prisma/db.js';

describe('Reglas propias fuera de PostgreSQL', () => {
  const db = createDatabase();
  afterAll(() => db.close());
  it('conserva PostGIS y no instala funciones o triggers propios en public', async () => {
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
         WHERE n.nspname='public' AND NOT t.tgisinternal) AS triggers
    `
        .returnsRow({
          postgis: 'pg/bool@1',
          funciones: 'pg/int4@1',
          triggers: 'pg/int4@1',
        })
        .build(),
    );
    expect(schema).toEqual({ postgis: true, funciones: 0, triggers: 0 });
  });
});
