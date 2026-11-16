import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { mensajeDe } from '../../shared/http/client';

type Tipo = 'success' | 'error' | 'info';
interface Aviso {
  id: number;
  tipo: Tipo;
  texto: string;
}

interface AvisosContexto {
  exito(texto: string): void;
  error(error: unknown): void;
  info(texto: string): void;
}

const Contexto = createContext<AvisosContexto | null>(null);

/** Mensajes breves de confirmación o error tras una acción (uno a la vez, se cierran solos). */
export function AvisosProvider({ children }: { children: ReactNode }) {
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const mostrar = useCallback((tipo: Tipo, texto: string) => setAviso({ id: Date.now(), tipo, texto }), []);

  const valor = useMemo<AvisosContexto>(
    () => ({
      exito: (texto) => mostrar('success', texto),
      error: (e) => mostrar('error', typeof e === 'string' ? e : mensajeDe(e)),
      info: (texto) => mostrar('info', texto),
    }),
    [mostrar],
  );

  return (
    <Contexto.Provider value={valor}>
      {children}
      <Snackbar
        key={aviso?.id}
        open={aviso !== null}
        autoHideDuration={aviso?.tipo === 'error' ? 7000 : 4000}
        onClose={(_e, motivo) => motivo !== 'clickaway' && setAviso(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {aviso ? (
          <Alert severity={aviso.tipo} variant="filled" onClose={() => setAviso(null)} role={aviso.tipo === 'error' ? 'alert' : 'status'}>
            {aviso.texto}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Contexto.Provider>
  );
}

export function useAvisos(): AvisosContexto {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error('useAvisos debe usarse dentro de AvisosProvider');
  return contexto;
}
