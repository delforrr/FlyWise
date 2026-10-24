export function mockCollection() {
  return {
    where: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    include: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    all: jest.fn(),
    first: jest.fn(),
    firstOrThrow: jest.fn(),
    aggregate: jest.fn(),
    create: jest.fn(),
    createAndCount: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    deleteAndCount: jest.fn(),
    upsert: jest.fn(),
  };
}

export function mockDatabase() {
  const plan = {
    returnsRow: jest.fn().mockReturnThis(),
    affectedCount: jest.fn().mockReturnThis(),
    build: jest.fn().mockReturnThis(),
  };
  const db = {
    transaction: jest.fn(),
    raw: {
      sql: jest.fn<typeof plan, [TemplateStringsArray, ...unknown[]]>(
        () => plan,
      ),
    },
    query: jest.fn(),
    execute: jest.fn(),
  };
  db.transaction.mockImplementation((work: (tx: typeof db) => unknown) =>
    work(db),
  );
  return db;
}
