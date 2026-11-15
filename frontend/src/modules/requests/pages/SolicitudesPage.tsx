import Button from '@mui/material/Button';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useUsuario } from '../../../app/providers/AuthProvider';
import { useAvisos } from '../../../app/providers/AvisosProvider';
import { useRecargaEnVivo } from '../../../app/providers/TiempoRealProvider';
import { EstadoBadge, PlazoBadge, Prioridad } from '../../../shared/components/atoms';
import { Filtro } from '../../../shared/components/forms';
import { Aviso, Buscador, Contenido, Encabezado, EstadoVacio, Paginacion, Pestanas, type Pestana } from '../../../shared/components/layout';
import { useConsulta, useRetardo } from '../../../shared/hooks/hooks';
import type { Rol, Solicitud } from '../../../shared/types/api';
import { fechaRelativa, formatoFechaHora, NOMBRE_ESTADO, NOMBRE_PRIORIDAD, PRIORIDADES } from '../../../shared/utils/format';
import { catalogService } from '../../catalogs/services/catalog.service';
import { solicitudService } from '../services/solicitud.service';
import type { FiltroSolicitudes } from '../types/solicitud.types';

type Vista = { valor: string; texto: string; estado: string };

/**
 * Configuración de la pantalla según el rol (misma estructura, distinto énfasis):
 * - Coordinador (CO2): bandeja de trabajo; abre en "Por aprobar" y la acción es "Revisar".
 * - Administrador (A2): consulta; abre en "Todas" y la acción es "Ver".
 * - Técnico (T2): su lista de trabajo ordenada por vencimiento.
 * - Cliente (C1): lo que ha pedido; puede crear una solicitud.
 * El alcance de los datos NO depende de esto: lo impone el backend según el rol.
 */
const VISTAS_GESTION: Vista[] = [
  { valor: 'aprobar', texto: 'Por aprobar', estado: 'REGISTRADA' },
  { valor: 'curso', texto: 'En curso', estado: 'APROBADA,ASIGNADA,EN_PROCESO' },
  { valor: 'info', texto: 'Pendiente de información', estado: 'PENDIENTE_INFO' },
  { valor: 'resueltas', texto: 'Resueltas', estado: 'RESUELTA' },
  { valor: 'cerradas', texto: 'Cerradas', estado: 'CERRADA' },
  { valor: 'todas', texto: 'Todas', estado: '' },
];

const CONFIG: Record<Rol, { titulo: string; subtitulo: string; vistas: Vista[]; inicial: string; accion: string; orden: FiltroSolicitudes['orden'] }> = {
  COORDINADOR: { titulo: 'Solicitudes', subtitulo: 'Bandeja de trabajo: lo que espera aprobación aparece primero', vistas: VISTAS_GESTION, inicial: 'aprobar', accion: 'Revisar', orden: 'vencimiento' },
  ADMIN: { titulo: 'Solicitudes', subtitulo: 'Consulta de todas las solicitudes · las gestiona el Coordinador', vistas: VISTAS_GESTION, inicial: 'todas', accion: 'Ver', orden: 'recientes' },
  TECNICO: {
    titulo: 'Mis solicitudes',
    subtitulo: 'Tu lista de trabajo, con el plazo siempre visible',
    vistas: [
      { valor: 'activas', texto: 'Activas', estado: 'ASIGNADA,EN_PROCESO,PENDIENTE_INFO' },
      { valor: 'resueltas', texto: 'Resueltas', estado: 'RESUELTA' },
      { valor: 'cerradas', texto: 'Cerradas', estado: 'CERRADA' },
      { valor: 'todas', texto: 'Todas', estado: '' },
    ],
    inicial: 'activas',
    accion: 'Atender',
    orden: 'vencimiento',
  },
  CLIENTE: { titulo: 'Mis solicitudes', subtitulo: 'El estado de todo lo que has pedido', vistas: [], inicial: '', accion: 'Ver', orden: 'recientes' },
};

const LIMITE = 10;

/** Exporta a CSV lo que el usuario está viendo (hasta 100 filas del filtro actual). */
function exportarCsv(filas: Solicitud[]) {
  const celda = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const cabecera = ['Código', 'Título', 'Cliente', 'Sede', 'Categoría', 'Prioridad', 'Estado', 'Técnico', 'Registrada', 'Fecha límite', 'Plazo'];
  const lineas = filas.map((s) =>
    [s.codigo, s.titulo, s.cliente_nombre, s.sede_nombre, s.categoria_nombre, NOMBRE_PRIORIDAD[s.prioridad], NOMBRE_ESTADO[s.estado], s.tecnico_nombre ?? 'Sin asignar', formatoFechaHora(s.created_at), formatoFechaHora(s.fecha_limite), s.estado_plazo]
      .map(celda)
      .join(';'),
  );
  const blob = new Blob([`﻿${[cabecera.map(celda).join(';'), ...lineas].join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
  const enlace = document.createElement('a');
  enlace.href = URL.createObjectURL(blob);
  enlace.download = 'solicitudes.csv';
  enlace.click();
  URL.revokeObjectURL(enlace.href);
}

export function SolicitudesPage() {
  const usuario = useUsuario();
  const avisos = useAvisos();
  const navegar = useNavigate();
  const config = CONFIG[usuario.rol];
  const esGestion = usuario.rol === 'ADMIN' || usuario.rol === 'COORDINADOR';
  const esCliente = usuario.rol === 'CLIENTE';

  // Los filtros viven en la URL: se pueden compartir, sobreviven a recargar y los usa la búsqueda global.
  const [parametros, setParametros] = useSearchParams();
  const vista = parametros.get('vista') ?? config.inicial;
  const pagina = Number(parametros.get('pagina') ?? 1);
  const [texto, setTexto] = useState(parametros.get('q') ?? '');
  const q = useRetardo(texto);
  const cambiar = (cambios: Record<string, string>) => {
    const siguientes = new URLSearchParams(parametros);
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor) siguientes.set(clave, valor);
      else siguientes.delete(clave);
    }
    if (!('pagina' in cambios)) siguientes.delete('pagina');
    setParametros(siguientes, { replace: true });
  };
  useEffect(() => setTexto(parametros.get('q') ?? ''), [parametros]);
  useEffect(() => {
    if (q !== (parametros.get('q') ?? '')) cambiar({ q });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const filtro = useMemo<FiltroSolicitudes>(
    () => ({
      page: pagina,
      limit: LIMITE,
      estado: esCliente ? (parametros.get('estado') ?? '') : (config.vistas.find((v) => v.valor === vista)?.estado ?? ''),
      prioridad: parametros.get('prioridad') ?? '',
      categoria_id: parametros.get('categoria') ?? '',
      tecnico_id: parametros.get('tecnico') ?? '',
      vencimiento: (parametros.get('vencimiento') ?? '') as FiltroSolicitudes['vencimiento'],
      q: parametros.get('q') ?? '',
      orden: config.orden,
    }),
    [parametros, pagina, vista, config, esCliente],
  );

  const consulta = useConsulta(() => solicitudService.listar(filtro), [filtro]);
  const categorias = useConsulta(() => catalogService.categorias(), []);
  // Contadores de las pestañas: una consulta mínima por vista (solo el total).
  const conteos = useConsulta(
    () => Promise.all(config.vistas.map((v) => solicitudService.contar({ estado: v.estado }))),
    [usuario.rol],
  );
  // Sin recargar: cuando el servidor avisa de un cambio se vuelven a pedir listado y contadores.
  useRecargaEnVivo(() => {
    consulta.recargar();
    conteos.recargar();
  });

  const pendientes = useConsulta(() => (esCliente ? solicitudService.listar({ estado: 'PENDIENTE_INFO', limit: 1 }) : Promise.resolve(null)), [usuario.rol]);
  useRecargaEnVivo(pendientes.recargar);

  const pestanas: Pestana<string>[] = config.vistas.map((v, i) => ({ valor: v.valor, texto: conteos.datos ? `${v.texto} (${conteos.datos[i]})` : v.texto }));
  const porAprobar = usuario.rol === 'COORDINADOR' ? conteos.datos?.[0] : undefined;
  const pendiente = pendientes.datos?.data[0];

  const exportar = async () => {
    try {
      const { data } = await solicitudService.listar({ ...filtro, page: 1, limit: 100 });
      if (!data.length) return avisos.info('No hay solicitudes para exportar con este filtro');
      exportarCsv(data);
    } catch (e) {
      avisos.error(e);
    }
  };

  return (
    <>
      <Encabezado titulo={config.titulo} subtitulo={config.subtitulo}>
        {esGestion && (
          <Button variant="outlined" onClick={() => void exportar()}>
            Exportar
          </Button>
        )}
        {(esCliente || usuario.rol === 'COORDINADOR') && (
          <Button component={Link} to="/solicitudes/nueva">
            + Nueva solicitud
          </Button>
        )}
      </Encabezado>

      {porAprobar !== undefined && porAprobar > 0 && vista !== 'aprobar' && (
        <Aviso
          titulo={`${porAprobar} ${porAprobar === 1 ? 'solicitud espera' : 'solicitudes esperan'} aprobación`}
          accion={
            <Button variant="outlined" onClick={() => cambiar({ vista: 'aprobar' })}>
              Revisar ahora
            </Button>
          }
        >
          Revísalas primero: su plazo de atención ya está corriendo.
        </Aviso>
      )}
      {pendiente && (
        <Aviso
          titulo="Una solicitud necesita tu respuesta"
          accion={
            <Button variant="outlined" component={Link} to={`/solicitudes/${pendiente.id}`}>
              Responder ahora
            </Button>
          }
        >
          {pendiente.codigo} está esperando la información que pidió el técnico.
        </Aviso>
      )}

      {pestanas.length > 0 && <Pestanas etiqueta="Vistas de solicitudes" opciones={pestanas} valor={vista} alCambiar={(v) => cambiar({ vista: v })} />}

      <div className="fila" style={{ marginBottom: 16 }}>
        <Buscador valor={texto} alCambiar={setTexto} placeholder="Buscar por código o título…" />
        {esCliente && (
          <Filtro etiqueta="Estado" valor={parametros.get('estado') ?? ''} alCambiar={(v) => cambiar({ estado: v })} opciones={Object.entries(NOMBRE_ESTADO).map(([valor, t]) => ({ valor, texto: t }))} />
        )}
        <Filtro etiqueta="Prioridad" valor={parametros.get('prioridad') ?? ''} alCambiar={(v) => cambiar({ prioridad: v })} opciones={PRIORIDADES.map((p) => ({ valor: p, texto: NOMBRE_PRIORIDAD[p] }))} />
        <Filtro etiqueta="Categoría" valor={parametros.get('categoria') ?? ''} alCambiar={(v) => cambiar({ categoria: v })} opciones={(categorias.datos ?? []).map((c) => ({ valor: c.id, texto: c.nombre }))} ancho={200} />
        {!esCliente && (
          <Filtro
            etiqueta="Plazo"
            valor={parametros.get('vencimiento') ?? ''}
            alCambiar={(v) => cambiar({ vencimiento: v })}
            opciones={[
              { valor: 'por_vencer', texto: 'Próximas a vencer' },
              { valor: 'vencida', texto: 'Vencidas' },
            ]}
          />
        )}
      </div>

      <div className="tarjeta sin-relleno">
        <Contenido consulta={consulta} filas={6}>
          {({ data }) =>
            data.length === 0 ? (
              <EstadoVacio
                titulo="No hay solicitudes para mostrar"
                accion={
                  esCliente && !filtro.q && !filtro.estado ? (
                    <Button component={Link} to="/solicitudes/nueva" sx={{ mt: 1 }}>
                      Crear mi primera solicitud
                    </Button>
                  ) : undefined
                }
              >
                {filtro.q || filtro.prioridad || filtro.categoria_id || filtro.vencimiento ? 'Prueba con otros filtros.' : 'Cuando existan, aparecerán aquí.'}
              </EstadoVacio>
            ) : (
              <div className="tabla-contenedor">
                <table className="tabla">
                  <thead>
                    <tr>
                      <th>Código</th>
                      <th>Título</th>
                      <th>{esCliente ? 'Sede' : 'Cliente · Sede'}</th>
                      <th>Prioridad</th>
                      <th>Estado</th>
                      {esGestion && <th>Técnico</th>}
                      <th>{esCliente ? 'Registrada' : 'Plazo'}</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((s) => (
                      <tr key={s.id} className="clicable" onClick={() => navegar(`/solicitudes/${s.id}`)}>
                        <td className="codigo">{s.codigo}</td>
                        <td className="principal-celda">{s.titulo}</td>
                        <td>{esCliente ? s.sede_nombre : `${s.cliente_nombre} · ${s.sede_nombre}`}</td>
                        <td>
                          <Prioridad nivel={s.prioridad} />
                        </td>
                        <td>
                          <EstadoBadge estado={s.estado} paraCliente={esCliente} />
                        </td>
                        {esGestion && <td className={s.tecnico_nombre ? '' : 'tenue'}>{s.tecnico_nombre ?? 'Sin asignar'}</td>}
                        <td>{esCliente ? fechaRelativa(s.created_at) : <PlazoBadge solicitud={s} />}</td>
                        <td>
                          {/* El enlace es el acceso por teclado; la fila completa es el acceso con ratón. */}
                          <Link className="enlace" to={`/solicitudes/${s.id}`} onClick={(e) => e.stopPropagation()} aria-label={`${config.accion} ${s.codigo}`}>
                            {config.accion}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          }
        </Contenido>
      </div>
      {consulta.datos && consulta.datos.meta.total > 0 && <Paginacion meta={consulta.datos.meta} sustantivo="solicitudes" alCambiar={(p) => cambiar({ pagina: String(p) })} />}
    </>
  );
}
