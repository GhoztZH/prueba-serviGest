/**
 * Cliente de Server-Sent Events sobre `fetch` en streaming.
 *
 * No se usa `EventSource` porque no permite enviar cabeceras: obligaría a
 * poner el token en la URL (queda en historiales y registros). Con `fetch` el
 * token viaja en `Authorization`, igual que en el resto de la API.
 *
 * Si la conexión se corta se reintenta sola; con 401 se detiene (sesión terminada).
 */
export interface EventoServidor {
  evento: string;
  datos: unknown;
}

const REINTENTO_MS = 4000;

export function conectarEventos(token: string, alRecibir: (e: EventoServidor) => void, alCambiarEstado?: (conectado: boolean) => void): () => void {
  const control = new AbortController();

  const escuchar = async (): Promise<'reintentar' | 'detener'> => {
    const respuesta = await fetch('/api/eventos', {
      headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
      signal: control.signal,
    });
    if (respuesta.status === 401 || respuesta.status === 403) return 'detener';
    if (!respuesta.ok || !respuesta.body) return 'reintentar';

    alCambiarEstado?.(true);
    const lector = respuesta.body.pipeThrough(new TextDecoderStream()).getReader();
    let pendiente = '';
    for (;;) {
      const { value, done } = await lector.read();
      if (done) return 'reintentar';
      pendiente += value;
      // Cada evento termina en una línea en blanco.
      const bloques = pendiente.split('\n\n');
      pendiente = bloques.pop() ?? '';
      for (const bloque of bloques) {
        const evento = interpretar(bloque);
        if (evento) alRecibir(evento);
      }
    }
  };

  void (async () => {
    while (!control.signal.aborted) {
      let resultado: 'reintentar' | 'detener' = 'reintentar';
      try {
        resultado = await escuchar();
      } catch {
        // Corte de red o aborto: se decide abajo.
      }
      alCambiarEstado?.(false);
      if (resultado === 'detener' || control.signal.aborted) return;
      await new Promise((r) => setTimeout(r, REINTENTO_MS));
    }
  })();

  return () => control.abort();
}

/** Convierte un bloque `event: x\ndata: {...}` en un evento; ignora comentarios (latidos). */
export function interpretar(bloque: string): EventoServidor | null {
  let evento = 'message';
  const datos: string[] = [];
  for (const linea of bloque.split('\n')) {
    if (linea.startsWith('event:')) evento = linea.slice(6).trim();
    else if (linea.startsWith('data:')) datos.push(linea.slice(5).trim());
  }
  if (!datos.length) return null;
  try {
    return { evento, datos: JSON.parse(datos.join('\n')) };
  } catch {
    return null;
  }
}
