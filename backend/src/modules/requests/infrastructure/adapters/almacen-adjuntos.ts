import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { open, unlink } from 'node:fs/promises';
import path from 'node:path';
import multer from 'multer';
import type { RequestHandler } from 'express';
import { BadRequestError } from '../../../../shared/domain/errors';
import type { AlmacenAdjuntos } from '../../domain/interfaces/solicitud.repository';

export const TAMANO_MAXIMO_BYTES = 5 * 1024 * 1024;
export const MAXIMO_ARCHIVOS_POR_ENVIO = 5;

/** Tipos permitidos por el contrato: JPG, PNG, PDF y TXT. */
const TIPOS: Record<string, { extensiones: string[]; firma?: number[] }> = {
  'image/jpeg': { extensiones: ['.jpg', '.jpeg'], firma: [0xff, 0xd8, 0xff] },
  'image/png': { extensiones: ['.png'], firma: [0x89, 0x50, 0x4e, 0x47] },
  'application/pdf': { extensiones: ['.pdf'], firma: [0x25, 0x50, 0x44, 0x46] },
  'text/plain': { extensiones: ['.txt'] },
};

/**
 * Almacén de adjuntos en disco (volumen persistente en Docker).
 * - El nombre en disco es un UUID: el nombre original nunca forma parte de una ruta.
 * - Se valida tipo MIME + extensión al recibir y la firma binaria después,
 *   porque el MIME lo declara el cliente y puede falsearse.
 */
export class AlmacenAdjuntosDisco implements AlmacenAdjuntos {
  private readonly dir: string;

  constructor(dir: string) {
    this.dir = path.resolve(dir);
    mkdirSync(this.dir, { recursive: true });
  }

  rutaDe(nombreArchivo: string): string {
    return path.join(this.dir, path.basename(nombreArchivo));
  }

  async descartar(nombresArchivo: string[]): Promise<void> {
    await Promise.all(nombresArchivo.map((n) => unlink(this.rutaDe(n)).catch(() => undefined)));
  }

  /** Comprueba que el contenido corresponde al tipo declarado. */
  async firmaValida(nombreArchivo: string, mimeType: string): Promise<boolean> {
    const firma = TIPOS[mimeType]?.firma;
    if (!firma) return true;
    const archivo = await open(this.rutaDe(nombreArchivo), 'r');
    try {
      const buffer = Buffer.alloc(firma.length);
      await archivo.read(buffer, 0, firma.length, 0);
      return firma.every((byte, i) => buffer[i] === byte);
    } finally {
      await archivo.close();
    }
  }

  /** Middleware de recepción `multipart/form-data` para el campo `adjuntos`. */
  receptor(): RequestHandler {
    const upload = multer({
      storage: multer.diskStorage({
        destination: this.dir,
        filename: (_req, file, cb) => cb(null, `${randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
      }),
      limits: { fileSize: TAMANO_MAXIMO_BYTES, files: MAXIMO_ARCHIVOS_POR_ENVIO },
      fileFilter: (_req, file, cb) => {
        const tipo = TIPOS[file.mimetype];
        const extension = path.extname(file.originalname).toLowerCase();
        if (!tipo || !tipo.extensiones.includes(extension)) {
          cb(new BadRequestError('Tipo de archivo no permitido. Use JPG, PNG, PDF o TXT'));
          return;
        }
        cb(null, true);
      },
    });
    return upload.array('adjuntos', MAXIMO_ARCHIVOS_POR_ENVIO);
  }
}
