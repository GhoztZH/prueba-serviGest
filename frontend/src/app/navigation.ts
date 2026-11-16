import {
  BookOpen,
  Building2,
  ChartColumn,
  CircleHelp,
  ClipboardList,
  FilePlus,
  LayoutGrid,
  ListFilter,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  ToggleLeft,
  User,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { Rol } from '../shared/types/api';

export interface ItemMenu {
  ruta: string;
  texto: string;
  icono: LucideIcon;
  /** La ruta debe coincidir exactamente para marcarse activa (evita que "Mis solicitudes" se active en "Nueva solicitud"). */
  exacta?: boolean;
}

export interface SeccionMenu {
  titulo: string;
  items: ItemMenu[];
}

const cuenta = (extra: ItemMenu[] = []): SeccionMenu => ({
  titulo: 'Cuenta',
  items: [{ ruta: '/perfil', texto: 'Mi perfil', icono: User }, ...extra, { ruta: '/configuracion', texto: 'Configuración', icono: Settings }],
});

/**
 * Menú lateral por rol (docs/design/design-system.md §5.1).
 * Las notificaciones NO van en el menú: solo en la campana de la barra superior.
 * El menú es comodidad de interfaz; cada ruta y cada operación se autorizan además en el servidor.
 */
export const MENU: Record<Rol, SeccionMenu[]> = {
  ADMIN: [
    {
      titulo: 'Seguimiento',
      items: [
        { ruta: '/reportes', texto: 'Reportes', icono: ChartColumn },
        { ruta: '/solicitudes', texto: 'Solicitudes', icono: ClipboardList },
      ],
    },
    {
      titulo: 'Administración',
      items: [
        { ruta: '/usuarios', texto: 'Usuarios y técnicos', icono: Users },
        { ruta: '/clientes', texto: 'Clientes y sedes', icono: Building2 },
        { ruta: '/catalogos', texto: 'Catálogos', icono: BookOpen },
        { ruta: '/parametros', texto: 'Parámetros', icono: SlidersHorizontal },
        { ruta: '/auditoria', texto: 'Auditoría', icono: ShieldCheck },
      ],
    },
    cuenta(),
  ],
  COORDINADOR: [
    {
      titulo: 'Operación',
      items: [
        { ruta: '/dashboard', texto: 'Dashboard', icono: ChartColumn },
        { ruta: '/solicitudes', texto: 'Solicitudes', icono: ClipboardList },
        { ruta: '/carga', texto: 'Carga del equipo', icono: ListFilter },
      ],
    },
    {
      titulo: 'Consulta',
      items: [
        { ruta: '/tecnicos', texto: 'Técnicos', icono: Users },
        { ruta: '/clientes', texto: 'Clientes y sedes', icono: Building2 },
      ],
    },
    cuenta(),
  ],
  TECNICO: [
    {
      titulo: 'Mi trabajo',
      items: [
        { ruta: '/panel', texto: 'Mi panel', icono: LayoutGrid },
        { ruta: '/solicitudes', texto: 'Mis solicitudes', icono: ClipboardList },
      ],
    },
    cuenta([{ ruta: '/disponibilidad', texto: 'Disponibilidad', icono: ToggleLeft }]),
  ],
  CLIENTE: [
    {
      titulo: 'Mis solicitudes',
      items: [
        { ruta: '/solicitudes', texto: 'Mis solicitudes', icono: ClipboardList, exacta: true },
        { ruta: '/solicitudes/nueva', texto: 'Nueva solicitud', icono: FilePlus },
      ],
    },
    cuenta([{ ruta: '/ayuda', texto: 'Ayuda', icono: CircleHelp }]),
  ],
};

/** Pantalla con la que abre cada rol. */
export const INICIO: Record<Rol, string> = {
  ADMIN: '/reportes',
  COORDINADOR: '/dashboard',
  TECNICO: '/panel',
  CLIENTE: '/solicitudes',
};

export function itemsDe(rol: Rol): ItemMenu[] {
  return MENU[rol].flatMap((s) => s.items);
}

/** Ítem del menú al que pertenece una ruta (para marcarlo activo y armar la miga de pan). */
export function itemActivo(rol: Rol, ruta: string): ItemMenu | undefined {
  return itemsDe(rol)
    .filter((i) => (i.exacta ? ruta === i.ruta : ruta === i.ruta || ruta.startsWith(`${i.ruta}/`)))
    .sort((a, b) => b.ruta.length - a.ruta.length)[0];
}
