import type { AuditLogger } from '../../../../shared/application/ports';

export interface FiltroAuditoria {
  entidad?: string;
  usuarioId?: number;
  limit: number;
  offset: number;
}

export interface RegistroAuditoriaVista {
  id: number;
  usuario_id: number | null;
  usuario_nombre: string | null;
  entidad: string;
  entidad_id: string | null;
  accion: string;
  datos_antes: unknown;
  datos_despues: unknown;
  ip: string | null;
  fecha: Date;
}

export interface AuditRepository extends AuditLogger {
  listar(filtro: FiltroAuditoria): Promise<{ filas: RegistroAuditoriaVista[]; total: number }>;
}
