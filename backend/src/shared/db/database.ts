import { AsyncLocalStorage } from 'node:async_hooks';
import { Pool, types, type PoolClient, type QueryResultRow } from 'pg';
import type { UnitOfWork } from '../application/unit-of-work';

// BIGINT (ids BIGSERIAL, COUNT) y NUMERIC como número; DATE como texto 'YYYY-MM-DD'.
types.setTypeParser(20, (v) => Number.parseInt(v, 10));
types.setTypeParser(1700, (v) => Number.parseFloat(v));
types.setTypeParser(1082, (v) => v);

interface TxContext {
  client: PoolClient;
  afterCommit: Array<() => void | Promise<void>>;
}

type SqlParams = ReadonlyArray<unknown>;

/**
 * Acceso a PostgreSQL con unidad de trabajo implícita.
 *
 * `run()` abre una transacción y la asocia al flujo asíncrono actual
 * (AsyncLocalStorage). Cualquier repositorio que consulte dentro de ese flujo
 * usa la misma conexión, de modo que los casos de uso componen varios
 * repositorios de módulos distintos en una sola transacción sin pasar el
 * cliente de mano en mano ni conocer `pg`.
 */
export class Database implements UnitOfWork {
  private readonly als = new AsyncLocalStorage<TxContext>();

  constructor(private readonly pool: Pool) {}

  static connect(connectionString: string): Database {
    return new Database(new Pool({ connectionString, max: 10 }));
  }

  async query<T extends QueryResultRow = QueryResultRow>(text: string, params: SqlParams = []): Promise<T[]> {
    const executor = this.als.getStore()?.client ?? this.pool;
    const result = await executor.query<T>(text, params as unknown[]);
    return result.rows;
  }

  async one<T extends QueryResultRow = QueryResultRow>(text: string, params: SqlParams = []): Promise<T | undefined> {
    const rows = await this.query<T>(text, params);
    return rows[0];
  }

  /** Ejecuta una sentencia y devuelve el número de filas afectadas. */
  async execute(text: string, params: SqlParams = []): Promise<number> {
    const executor = this.als.getStore()?.client ?? this.pool;
    const result = await executor.query(text, params as unknown[]);
    return result.rowCount ?? 0;
  }

  async run<T>(work: () => Promise<T>): Promise<T> {
    // Transacción anidada: se une a la existente (misma atomicidad).
    if (this.als.getStore()) return work();

    const client = await this.pool.connect();
    const ctx: TxContext = { client, afterCommit: [] };
    let result: T;
    try {
      await client.query('BEGIN');
      result = await this.als.run(ctx, work);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
    for (const callback of ctx.afterCommit) {
      try {
        await callback();
      } catch (error) {
        // Un efecto posterior al commit (p. ej. empujar un evento SSE) nunca
        // debe convertir en error una operación que ya quedó persistida.
        console.error('Fallo en efecto posterior al commit', error);
      }
    }
    return result;
  }

  afterCommit(callback: () => void | Promise<void>): void {
    const ctx = this.als.getStore();
    if (ctx) ctx.afterCommit.push(callback);
    else void Promise.resolve().then(callback).catch((e) => console.error('Fallo en efecto diferido', e));
  }

  async ping(): Promise<void> {
    await this.pool.query('SELECT 1');
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
