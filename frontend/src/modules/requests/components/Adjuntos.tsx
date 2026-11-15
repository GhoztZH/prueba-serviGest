import { Paperclip, Upload } from 'lucide-react';
import { useRef, useState, type DragEvent } from 'react';
import { useAvisos } from '../../../app/providers/AvisosProvider';
import type { Adjunto } from '../../../shared/types/api';
import { tamanoArchivo } from '../../../shared/utils/format';
import { solicitudService } from '../services/solicitud.service';

export const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'application/pdf', 'text/plain'];
export const TAMANO_MAXIMO = 5 * 1024 * 1024;
export const MAXIMO_ARCHIVOS = 5;

/**
 * Comprobación previa en el navegador, solo para avisar pronto al usuario.
 * La validación que cuenta (tipo, tamaño, contenido real) la hace el backend.
 */
export function motivoRechazo(archivo: File): string | null {
  if (!TIPOS_PERMITIDOS.includes(archivo.type)) return `"${archivo.name}": solo se admiten JPG, PNG, PDF o TXT`;
  if (archivo.size > TAMANO_MAXIMO) return `"${archivo.name}" supera los 5 MB`;
  return null;
}

/** Zona para elegir o arrastrar archivos. */
export function ZonaArchivos({ alElegir, deshabilitada = false }: { alElegir: (archivos: File[]) => void; deshabilitada?: boolean }) {
  const entrada = useRef<HTMLInputElement>(null);
  const [sobre, setSobre] = useState(false);

  const soltar = (e: DragEvent) => {
    e.preventDefault();
    setSobre(false);
    if (!deshabilitada) alElegir([...e.dataTransfer.files]);
  };

  return (
    <>
      <button
        type="button"
        className={`zona-archivos ${sobre ? 'sobre' : ''}`}
        onClick={() => entrada.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setSobre(true);
        }}
        onDragLeave={() => setSobre(false)}
        onDrop={soltar}
        disabled={deshabilitada}
      >
        <span className="fila cuerpo-medio">
          <Upload size={16} aria-hidden="true" /> Arrastra archivos aquí o haz clic para elegirlos
        </span>
        <span className="nota">JPG, PNG, PDF o TXT · máximo 5 MB cada uno · hasta {MAXIMO_ARCHIVOS} archivos</span>
      </button>
      <input
        ref={entrada}
        type="file"
        multiple
        hidden
        accept=".jpg,.jpeg,.png,.pdf,.txt"
        onChange={(e) => {
          alElegir([...(e.target.files ?? [])]);
          e.target.value = '';
        }}
      />
    </>
  );
}

/** Adjuntos de una solicitud: descarga autenticada y, si el backend lo permite, subida de nuevos. */
export function Adjuntos({ solicitudId, adjuntos, puedeAdjuntar, alCambiar }: { solicitudId: number; adjuntos: Adjunto[]; puedeAdjuntar: boolean; alCambiar: () => void }) {
  const avisos = useAvisos();
  const [subiendo, setSubiendo] = useState(false);

  const subir = async (archivos: File[]) => {
    const rechazo = archivos.map(motivoRechazo).find(Boolean);
    if (rechazo) return avisos.error(rechazo);
    if (!archivos.length) return;
    setSubiendo(true);
    try {
      await solicitudService.subirAdjuntos(solicitudId, archivos);
      avisos.exito(archivos.length === 1 ? 'Archivo adjuntado' : 'Archivos adjuntados');
      alCambiar();
    } catch (e) {
      avisos.error(e);
    } finally {
      setSubiendo(false);
    }
  };

  return (
    <div className="pila md">
      {adjuntos.length > 0 && (
        <div className="fila">
          {adjuntos.map((a) => (
            <button
              key={a.id}
              type="button"
              className="archivo"
              title={`${tamanoArchivo(a.tamano_bytes)} · subido por ${a.subido_por_nombre}`}
              onClick={() => solicitudService.descargarAdjunto(solicitudId, a).catch(avisos.error)}
            >
              <Paperclip aria-hidden="true" />
              <span className="recortar">{a.nombre_original}</span>
            </button>
          ))}
        </div>
      )}
      {puedeAdjuntar && <ZonaArchivos alElegir={(archivos) => void subir(archivos)} deshabilitada={subiendo} />}
    </div>
  );
}
