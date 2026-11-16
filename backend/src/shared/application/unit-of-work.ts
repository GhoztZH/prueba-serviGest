/**
 * Unidad de trabajo: frontera transaccional que usan los casos de uso.
 * La capa de aplicación depende de esta abstracción, no de PostgreSQL.
 */
export interface UnitOfWork {
  /** Ejecuta `work` de forma atómica: todo se confirma o nada se aplica. */
  run<T>(work: () => Promise<T>): Promise<T>;
  /** Registra un efecto que solo debe ocurrir si la transacción se confirma. */
  afterCommit(callback: () => void | Promise<void>): void;
}
