import type { Response } from 'express';
import type { CanalTiempoReal } from '../domain/notificaciones';

const LATIDO_MS = 25_000;

/**
 * Concentrador de conexiones Server-Sent Events, en memoria.
 *
 * SSE basta porque el flujo es unidireccional (servidor → navegador): no hace
 * falta el canal bidireccional de WebSocket ni una dependencia adicional, y
 * funciona sobre HTTP corriente a través del proxy inverso.
 *
 * Limitación conocida: el registro vive en el proceso. Con varias réplicas del
 * backend haría falta un bus compartido (p. ej. LISTEN/NOTIFY de PostgreSQL).
 */
export class SseHub implements CanalTiempoReal {
  private readonly conexiones = new Map<number, Set<Response>>();
  private readonly latido: NodeJS.Timeout;

  constructor() {
    // Comentario periódico: mantiene viva la conexión frente a proxies con tiempo de espera.
    this.latido = setInterval(() => {
      for (const respuestas of this.conexiones.values()) for (const res of respuestas) res.write(': latido\n\n');
    }, LATIDO_MS);
    this.latido.unref();
  }

  suscribir(usuarioId: number, res: Response, expiraEn: Date): void {
    res.status(200).set({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // nginx: no almacenar en búfer el flujo
    });
    res.flushHeaders();
    res.write('retry: 5000\n\n');
    this.escribir(res, 'conectado', { usuarioId });

    const respuestas = this.conexiones.get(usuarioId) ?? new Set<Response>();
    respuestas.add(res);
    this.conexiones.set(usuarioId, respuestas);

    // La conexión no sobrevive al token con el que se abrió.
    const caducidad = setTimeout(() => res.end(), Math.max(0, expiraEn.getTime() - Date.now()));
    caducidad.unref();

    res.on('close', () => {
      clearTimeout(caducidad);
      respuestas.delete(res);
      if (!respuestas.size) this.conexiones.delete(usuarioId);
    });
  }

  emitir(usuarioIds: number[], evento: string, datos: unknown): void {
    for (const usuarioId of new Set(usuarioIds)) {
      for (const res of this.conexiones.get(usuarioId) ?? []) this.escribir(res, evento, datos);
    }
  }

  conectados(): number {
    let total = 0;
    for (const respuestas of this.conexiones.values()) total += respuestas.size;
    return total;
  }

  cerrar(): void {
    clearInterval(this.latido);
    for (const respuestas of this.conexiones.values()) for (const res of respuestas) res.end();
    this.conexiones.clear();
  }

  private escribir(res: Response, evento: string, datos: unknown): void {
    res.write(`event: ${evento}\ndata: ${JSON.stringify(datos)}\n\n`);
  }
}
