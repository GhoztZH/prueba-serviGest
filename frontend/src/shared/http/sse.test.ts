import { describe, expect, it } from 'vitest';
import { interpretar } from './sse';

describe('sse.ts - interpretar', () => {
  it('interpreta un bloque con event y data JSON', () => {
    const bloque = 'event: notificacion\ndata: {"id": 1, "titulo": "Nueva solicitud"}';
    const resultado = interpretar(bloque);
    expect(resultado).toEqual({
      evento: 'notificacion',
      datos: { id: 1, titulo: 'Nueva solicitud' },
    });
  });

  it('asigna message como evento por defecto si no viene event', () => {
    const bloque = 'data: {"cambio": true}';
    const resultado = interpretar(bloque);
    expect(resultado).toEqual({
      evento: 'message',
      datos: { cambio: true },
    });
  });

  it('concatena multiples lineas de data', () => {
    const bloque = 'event: solicitud:actualizada\ndata: {\ndata: "id": 42\ndata: }';
    const resultado = interpretar(bloque);
    expect(resultado).toEqual({
      evento: 'solicitud:actualizada',
      datos: { id: 42 },
    });
  });

  it('retorna null si no contiene datos', () => {
    const bloque = ': ping heartbeat';
    expect(interpretar(bloque)).toBeNull();
  });

  it('retorna null si data no es JSON valido', () => {
    const bloque = 'event: error\ndata: no-es-json';
    expect(interpretar(bloque)).toBeNull();
  });
});
