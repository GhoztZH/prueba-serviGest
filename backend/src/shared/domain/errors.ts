/**
 * Errores de aplicación. Cada uno conoce su código de contrato (OpenAPI) y su
 * estado HTTP, pero no depende de Express: la traducción a respuesta ocurre en
 * el manejador centralizado de la capa de presentación.
 */
export type ErrorCode =
  | 'SOLICITUD_INVALIDA'
  | 'NO_AUTENTICADO'
  | 'PROHIBIDO'
  | 'NO_ENCONTRADO'
  | 'CONFLICTO'
  | 'VALIDACION'
  | 'REGLA_NEGOCIO'
  | 'DEMASIADOS_INTENTOS'
  | 'ERROR_INTERNO';

export interface DetalleValidacion {
  campo: string;
  mensaje: string;
}

export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'La solicitud no es válida', details?: unknown) {
    super(400, 'SOLICITUD_INVALIDA', message, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Autenticación requerida') {
    super(401, 'NO_AUTENTICADO', message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'No tiene permisos para realizar esta operación') {
    super(403, 'PROHIBIDO', message);
  }
}

export class NotFoundError extends AppError {
  constructor(entidad = 'Recurso') {
    super(404, 'NO_ENCONTRADO', `${entidad} no encontrado`);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: unknown) {
    super(409, 'CONFLICTO', message, details);
  }
}

export class ValidationError extends AppError {
  constructor(details: DetalleValidacion[], message = 'Los datos enviados no son válidos') {
    super(422, 'VALIDACION', message, details);
  }

  static campo(campo: string, mensaje: string): ValidationError {
    return new ValidationError([{ campo, mensaje }]);
  }
}

export class BusinessRuleError extends AppError {
  constructor(message: string, details?: unknown) {
    super(422, 'REGLA_NEGOCIO', message, details);
  }
}
