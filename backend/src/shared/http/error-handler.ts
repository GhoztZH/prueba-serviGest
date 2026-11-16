import type { ErrorRequestHandler, RequestHandler } from 'express';
import { MulterError } from 'multer';
import { AppError, type ErrorCode } from '../domain/errors';

interface Logger {
  error(obj: unknown, msg?: string): void;
  warn(obj: unknown, msg?: string): void;
}

interface CuerpoError {
  error: { code: ErrorCode; message: string; details?: unknown };
}

function cuerpo(code: ErrorCode, message: string, details?: unknown): CuerpoError {
  return { error: details === undefined ? { code, message } : { code, message, details } };
}

/** Errores de integridad de PostgreSQL que el servicio no anticipó (red de seguridad). */
function desdePostgres(error: { code?: string }): { status: number; body: CuerpoError } | null {
  switch (error.code) {
    case '23505':
      return { status: 409, body: cuerpo('CONFLICTO', 'Ya existe un registro con esos datos') };
    case '23503':
      return { status: 409, body: cuerpo('CONFLICTO', 'La operación viola la integridad referencial: existen registros relacionados') };
    case '23514':
    case '23502':
    case '22001':
      return { status: 422, body: cuerpo('VALIDACION', 'Los datos no cumplen las restricciones del modelo') };
    case 'P0001':
      return { status: 409, body: cuerpo('CONFLICTO', 'El registro es inalterable') };
    case '40001':
    case '40P01':
      return { status: 409, body: cuerpo('CONFLICTO', 'La operación entró en conflicto con otra simultánea. Intente de nuevo') };
    default:
      return null;
  }
}

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json(cuerpo('NO_ENCONTRADO', 'Ruta no encontrada'));
};

/**
 * Manejo centralizado de errores: una sola forma de respuesta para toda la API
 * y ningún detalle interno (trazas, SQL) expuesto al cliente.
 */
export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (error, req, res, _next) => {
    if (res.headersSent) return;

    if (error instanceof AppError) {
      res.status(error.status).json(cuerpo(error.code, error.message, error.details));
      return;
    }
    if (error instanceof MulterError) {
      const mensaje =
        error.code === 'LIMIT_FILE_SIZE'
          ? 'El archivo supera el tamaño máximo permitido'
          : error.code === 'LIMIT_FILE_COUNT' || error.code === 'LIMIT_UNEXPECTED_FILE'
            ? 'Se superó el número de archivos permitido'
            : 'No se pudo procesar el archivo adjunto';
      res.status(400).json(cuerpo('SOLICITUD_INVALIDA', mensaje));
      return;
    }
    // body-parser: JSON mal formado o cuerpo demasiado grande.
    const tipo = (error as { type?: string }).type;
    if (tipo === 'entity.parse.failed' || tipo === 'entity.too.large' || tipo === 'charset.unsupported') {
      res.status(400).json(cuerpo('SOLICITUD_INVALIDA', 'El cuerpo de la petición no es válido'));
      return;
    }
    const pg = desdePostgres(error as { code?: string });
    if (pg) {
      logger.warn({ err: error, ruta: req.originalUrl }, 'Restricción de base de datos');
      res.status(pg.status).json(pg.body);
      return;
    }

    logger.error({ err: error, ruta: req.originalUrl, metodo: req.method }, 'Error no controlado');
    res.status(500).json(cuerpo('ERROR_INTERNO', 'Ocurrió un error inesperado'));
  };
}
