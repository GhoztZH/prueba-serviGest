import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import MenuItem from '@mui/material/MenuItem';
import TextField, { type TextFieldProps } from '@mui/material/TextField';
import { useId, useState, type ReactNode } from 'react';
import { ApiError } from '../http/client';

/**
 * Campo (v2 del sistema de diseño): etiqueta visible arriba, control y mensaje.
 * El error lleva un texto que explica qué corregir; nunca depende solo del color.
 */
type CampoProps = Omit<TextFieldProps, 'label' | 'error' | 'variant'> & {
  etiqueta: string;
  /** Mensaje de error (del servidor o de la validación local). */
  error?: string;
  ayuda?: ReactNode;
};

export function Campo({ etiqueta, error, ayuda, id, className, ...props }: CampoProps) {
  const generado = useId();
  const campoId = id ?? generado;
  return (
    <div className={`campo ${className ?? ''}`}>
      <label htmlFor={campoId}>
        {etiqueta}
        {props.required && <span aria-hidden="true"> *</span>}
      </label>
      <TextField id={campoId} error={Boolean(error)} helperText={error ?? ayuda} {...props} />
    </div>
  );
}

export interface Opcion {
  valor: string | number;
  texto: string;
  deshabilitada?: boolean;
}

/** Selector: los datos que viven en la base (sedes, técnicos, catálogos) se eligen, nunca se escriben. */
export function Selector({ opciones, vacio, ...props }: CampoProps & { opciones: Opcion[]; vacio?: string }) {
  return (
    <Campo select {...props} slotProps={{ select: { displayEmpty: true } }}>
      {vacio !== undefined && (
        <MenuItem value="">
          <span className="tenue">{vacio}</span>
        </MenuItem>
      )}
      {opciones.map((o) => (
        <MenuItem key={o.valor} value={o.valor} disabled={o.deshabilitada}>
          {o.texto}
        </MenuItem>
      ))}
    </Campo>
  );
}

/** Filtro compacto de una barra de filtros ("Estado: Todos ▾"). */
export function Filtro({ etiqueta, valor, opciones, alCambiar, ancho = 170 }: { etiqueta: string; valor: string; opciones: Opcion[]; alCambiar: (valor: string) => void; ancho?: number }) {
  return (
    <TextField
      select
      value={valor}
      onChange={(e) => alCambiar(e.target.value)}
      sx={{ width: ancho, maxWidth: '100%' }}
      slotProps={{
        htmlInput: { 'aria-label': etiqueta },
        select: {
          displayEmpty: true,
          renderValue: (v) => {
            const elegida = opciones.find((o) => String(o.valor) === String(v));
            return elegida ? elegida.texto : <span className="tenue">{etiqueta}</span>;
          },
        },
      }}
    >
      <MenuItem value="">{etiqueta}: todos</MenuItem>
      {opciones.map((o) => (
        <MenuItem key={o.valor} value={String(o.valor)}>
          {o.texto}
        </MenuItem>
      ))}
    </TextField>
  );
}

/** Errores por campo que devolvió la API (422 VALIDACION), para mostrarlos junto a cada control. */
export function camposDe(error: unknown): Record<string, string> {
  return error instanceof ApiError ? error.campos : {};
}

/** Mensaje general de un error que no pertenece a un campo concreto. */
export function mensajeGeneral(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof ApiError && error.code === 'VALIDACION' && Object.keys(error.campos).length) return null;
  return error instanceof Error ? error.message : 'Ocurrió un error inesperado';
}

interface ConfirmacionProps {
  abierta: boolean;
  titulo: string;
  children?: ReactNode;
  textoConfirmar: string;
  /** Si se indica, se pide un texto obligatorio (motivo, comentario) antes de confirmar. */
  motivo?: { etiqueta: string; minimo: number; placeholder?: string; error?: string };
  enviando?: boolean;
  alConfirmar: (motivo: string) => void;
  alCerrar: () => void;
}

/** Diálogo de confirmación para acciones con consecuencias (cancelar, eliminar, reabrir). */
export function Confirmacion({ abierta, titulo, children, textoConfirmar, motivo, enviando, alConfirmar, alCerrar }: ConfirmacionProps) {
  const [texto, setTexto] = useState('');
  const falta = motivo ? texto.trim().length < motivo.minimo : false;
  const cerrar = () => {
    setTexto('');
    alCerrar();
  };
  return (
    <Dialog open={abierta} onClose={enviando ? undefined : cerrar} aria-labelledby="confirmacion-titulo">
      <div className="pila md">
        <h2 id="confirmacion-titulo" className="titulo-seccion">
          {titulo}
        </h2>
        {children && <div className="tenue">{children}</div>}
        {motivo && (
          <Campo
            etiqueta={motivo.etiqueta}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            multiline
            minRows={3}
            placeholder={motivo.placeholder}
            error={motivo.error}
            ayuda={`Mínimo ${motivo.minimo} caracteres`}
            autoFocus
            required
          />
        )}
        <div className="fila final">
          <Button variant="text" onClick={cerrar} disabled={enviando}>
            Cancelar
          </Button>
          <Button onClick={() => alConfirmar(texto.trim())} disabled={falta || enviando}>
            {enviando ? 'Enviando…' : textoConfirmar}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
