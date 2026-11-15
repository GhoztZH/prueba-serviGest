import { ValidationError } from '../../../shared/domain/errors';

export interface Especialidad {
  id: number;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Categoria {
  id: number;
  nombre: string;
  descripcion: string | null;
  especialidad_id: number;
  especialidad_nombre: string;
  activo: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Prioridad {
  id: number;
  codigo: string;
  nombre: string;
  horas_plazo: number;
  orden: number;
}

export interface Estado {
  id: number;
  codigo: string;
  nombre: string;
  es_final: boolean;
  orden: number;
}

export interface Parametro {
  clave: string;
  valor: string;
  descripcion: string | null;
  updated_at: Date;
}

export interface CatalogRepository {
  listarEspecialidades(activo?: boolean): Promise<Especialidad[]>;
  buscarEspecialidad(id: number): Promise<Especialidad | undefined>;
  existeNombreEspecialidad(nombre: string, exceptoId?: number): Promise<boolean>;
  crearEspecialidad(d: { nombre: string; descripcion: string | null }): Promise<number>;
  actualizarEspecialidad(id: number, d: { nombre?: string; descripcion?: string | null; activo?: boolean }): Promise<void>;
  eliminarEspecialidad(id: number): Promise<void>;
  usoEspecialidad(id: number): Promise<{ categorias: number; categoriasActivas: number; tecnicos: number }>;

  listarCategorias(activo?: boolean): Promise<Categoria[]>;
  buscarCategoria(id: number): Promise<Categoria | undefined>;
  existeNombreCategoria(nombre: string, exceptoId?: number): Promise<boolean>;
  crearCategoria(d: { nombre: string; descripcion: string | null; especialidadId: number }): Promise<number>;
  actualizarCategoria(
    id: number,
    d: { nombre?: string; descripcion?: string | null; especialidadId?: number; activo?: boolean },
  ): Promise<void>;
  eliminarCategoria(id: number): Promise<void>;
  solicitudesDeCategoria(id: number): Promise<number>;

  listarPrioridades(): Promise<Prioridad[]>;
  buscarPrioridad(id: number): Promise<Prioridad | undefined>;
  actualizarPrioridad(id: number, d: { nombre?: string; horasPlazo?: number }): Promise<void>;

  listarEstados(): Promise<Estado[]>;

  listarParametros(): Promise<Parametro[]>;
  buscarParametro(clave: string): Promise<Parametro | undefined>;
  actualizarParametro(clave: string, valor: string): Promise<void>;
}

/**
 * Reglas de los parámetros operativos: cada clave conocida declara su rango.
 * Así un valor fuera de rango nunca llega a los cálculos de plazo o de carga.
 */
const REGLAS_PARAMETROS: Record<string, { min: number; max: number }> = {
  UMBRAL_POR_VENCER_PCT: { min: 1, max: 90 },
  MAX_SOLICITUDES_ACTIVAS_DEFECTO: { min: 1, max: 50 },
  MAX_ADJUNTOS_POR_SOLICITUD: { min: 1, max: 20 },
};

export function validarValorParametro(clave: string, valor: string): string {
  const regla = REGLAS_PARAMETROS[clave];
  const limpio = valor.trim();
  if (!regla) return limpio;
  if (!/^\d+$/.test(limpio)) throw ValidationError.campo('valor', 'Debe ser un número entero');
  const numero = Number(limpio);
  if (numero < regla.min || numero > regla.max) {
    throw ValidationError.campo('valor', `Debe estar entre ${regla.min} y ${regla.max}`);
  }
  return String(numero);
}
