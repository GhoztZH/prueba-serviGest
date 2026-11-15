import { offsetDe, pagina, type Pagina, type Paginacion } from '../../../../shared/application/pagination';
import type { AuditRepository, RegistroAuditoriaVista } from '../../domain/interfaces/audit.repository';

export class AuditQueryService {
  constructor(private readonly repo: AuditRepository) {}

  async listar(filtro: Paginacion & { entidad?: string; usuarioId?: number }): Promise<Pagina<RegistroAuditoriaVista>> {
    const { filas, total } = await this.repo.listar({
      entidad: filtro.entidad,
      usuarioId: filtro.usuarioId,
      limit: filtro.limit,
      offset: offsetDe(filtro),
    });
    return pagina(filas, total, filtro);
  }
}
