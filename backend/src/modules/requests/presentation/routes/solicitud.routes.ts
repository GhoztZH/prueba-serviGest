import { Router, type Request, type RequestHandler } from 'express';
import { authOf, idParam, parse, requireRoles } from '../../../../shared/http/http';
import type { AdjuntarArchivosUseCase, ComentarSolicitudUseCase } from '../../application/use-cases/aportar-solicitud';
import type { CambiarEstadoUseCase, ReabrirSolicitudUseCase } from '../../application/use-cases/cambiar-estado';
import type { ConsultarSolicitudesUseCase } from '../../application/use-cases/consultar-solicitudes';
import type { RegistrarSolicitudUseCase } from '../../application/use-cases/registrar-solicitud';
import type { ArchivoSubido } from '../../domain/entities/solicitud';
import type { AlmacenAdjuntos } from '../../domain/interfaces/solicitud.repository';
import {
  cambioEstadoSchema,
  comentarioSchema,
  filtroSolicitudesSchema,
  reaperturaSchema,
  solicitudNuevaSchema,
} from '../validators/solicitud.schemas';

export interface SolicitudUseCases {
  registrar: RegistrarSolicitudUseCase;
  consultar: ConsultarSolicitudesUseCase;
  cambiarEstado: CambiarEstadoUseCase;
  reabrir: ReabrirSolicitudUseCase;
  comentar: ComentarSolicitudUseCase;
  adjuntar: AdjuntarArchivosUseCase;
}

function archivosDe(req: Request): ArchivoSubido[] {
  const files = Array.isArray(req.files) ? req.files : [];
  return files.map((f) => ({
    // multer entrega el nombre en latin1; se recupera el UTF-8 original (tildes, ñ).
    nombreOriginal: Buffer.from(f.originalname, 'latin1').toString('utf8').slice(0, 255),
    nombreArchivo: f.filename,
    mimeType: f.mimetype,
    tamanoBytes: f.size,
  }));
}

/**
 * Los controladores solo traducen HTTP ↔ caso de uso: validan la entrada,
 * invocan y serializan. La autorización por recurso vive en el dominio.
 */
export function solicitudRoutes(
  uc: SolicitudUseCases,
  almacen: AlmacenAdjuntos,
  recibirAdjuntos: RequestHandler,
  authenticate: RequestHandler,
): Router {
  const router = Router();
  router.use('/solicitudes', authenticate);

  router.get('/solicitudes', async (req, res) => {
    const { estado, prioridad, categoria_id, sede_id, cliente_id, tecnico_id, ...resto } = parse(filtroSolicitudesSchema, req.query);
    res.json(
      await uc.consultar.listar(authOf(req), {
        ...resto,
        estados: estado,
        prioridades: prioridad,
        categoriaId: categoria_id,
        sedeId: sede_id,
        clienteId: cliente_id,
        tecnicoId: tecnico_id,
      }),
    );
  });

  router.post('/solicitudes', requireRoles('CLIENTE', 'COORDINADOR', 'ADMIN'), recibirAdjuntos, async (req, res) => {
    const archivos = archivosDe(req);
    let entrada;
    try {
      entrada = parse(solicitudNuevaSchema, req.body);
    } catch (error) {
      await almacen.descartar(archivos.map((a) => a.nombreArchivo));
      throw error;
    }
    res.status(201).json(await uc.registrar.execute(authOf(req), entrada, archivos));
  });

  router.get('/solicitudes/:id', async (req, res) => {
    res.json(await uc.consultar.detalle(authOf(req), idParam(req)));
  });

  router.patch('/solicitudes/:id/estado', async (req, res) => {
    res.json(await uc.cambiarEstado.execute(authOf(req), idParam(req), parse(cambioEstadoSchema, req.body)));
  });

  router.get('/solicitudes/:id/historial', async (req, res) => {
    res.json(await uc.consultar.historial(authOf(req), idParam(req)));
  });

  router.post('/solicitudes/:id/reapertura', async (req, res) => {
    const { motivo } = parse(reaperturaSchema, req.body);
    res.json(await uc.reabrir.execute(authOf(req), idParam(req), motivo));
  });

  router.post('/solicitudes/:id/comentarios', async (req, res) => {
    const { comentario } = parse(comentarioSchema, req.body);
    res.status(201).json(await uc.comentar.execute(authOf(req), idParam(req), comentario));
  });

  router.post('/solicitudes/:id/adjuntos', recibirAdjuntos, async (req, res) => {
    const archivos = archivosDe(req);
    let id: number;
    try {
      id = idParam(req);
    } catch (error) {
      await almacen.descartar(archivos.map((a) => a.nombreArchivo));
      throw error;
    }
    res.status(201).json(await uc.adjuntar.execute(authOf(req), id, archivos));
  });

  router.get('/solicitudes/:id/adjuntos/:adjuntoId', async (req, res) => {
    const adjunto = await uc.consultar.adjunto(authOf(req), idParam(req), idParam(req, 'adjuntoId'));
    res.type(adjunto.mime_type);
    // Siempre como descarga: un adjunto nunca se interpreta en el origen de la aplicación.
    res.download(almacen.rutaDe(adjunto.nombre_archivo), adjunto.nombre_original);
  });

  return router;
}
