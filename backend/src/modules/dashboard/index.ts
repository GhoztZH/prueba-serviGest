import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { systemClock, type ParametrosOperativos } from '../../shared/application/ports';
import type { Database } from '../../shared/db/database';
import { authOf, parse } from '../../shared/http/http';
import { IndicadoresUseCase } from './application/indicadores.use-case';
import { PgDashboardRepository } from './infrastructure/pg-dashboard.repository';

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use el formato AAAA-MM-DD').refine((v) => !Number.isNaN(Date.parse(v)), 'Fecha inválida');
const id = z.coerce.number({ error: 'Debe ser un número' }).int().min(1).optional();

const filtroSchema = z.object({
  desde: fecha.optional(),
  hasta: fecha.optional(),
  categoria_id: id,
  prioridad_id: id,
  cliente_id: id,
  tecnico_id: id,
});

export interface DashboardModule {
  routes(authenticate: RequestHandler): Router;
}

export function createDashboardModule(db: Database, parametros: ParametrosOperativos, zonaHoraria: string): DashboardModule {
  const indicadores = new IndicadoresUseCase(new PgDashboardRepository(db, zonaHoraria), parametros, systemClock, zonaHoraria);
  return {
    routes: (authenticate) => {
      const router = Router();
      router.get('/dashboard/indicadores', authenticate, async (req, res) => {
        const f = parse(filtroSchema, req.query);
        res.json(
          await indicadores.execute(authOf(req), {
            desde: f.desde,
            hasta: f.hasta,
            categoriaId: f.categoria_id,
            prioridadId: f.prioridad_id,
            clienteId: f.cliente_id,
            tecnicoId: f.tecnico_id,
          }),
        );
      });
      return router;
    },
  };
}
