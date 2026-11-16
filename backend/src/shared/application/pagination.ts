/** Paginación común a todos los listados (forma `{ data, meta }` del contrato). */
export interface Paginacion {
  page: number;
  limit: number;
}

export interface Meta extends Paginacion {
  total: number;
  totalPages: number;
}

export interface Pagina<T> {
  data: T[];
  meta: Meta;
}

export function pagina<T>(data: T[], total: number, { page, limit }: Paginacion): Pagina<T> {
  return { data, meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } };
}

export function offsetDe({ page, limit }: Paginacion): number {
  return (page - 1) * limit;
}
