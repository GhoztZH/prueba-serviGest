import TextField from '@mui/material/TextField';
import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { Filtro } from '../../../shared/components/forms';
import { EstadoVacio } from '../../../shared/components/layout';
import type { Categoria, Indicadores } from '../../../shared/types/api';
import { ESTADO_CORTO, formatoDiaMes } from '../../../shared/utils/format';
import type { FiltroIndicadores } from '../services/dashboard.service';

/**
 * Gráficos de indicadores. Reciben los valores ya calculados por el backend y
 * solo los dibujan. Los colores son las variables del sistema: gris para el
 * conjunto y el color del rol para lo que se quiere destacar.
 */
const EJE = { fontSize: 11, fill: 'var(--color-text-muted)' };
const ESTILO_TOOLTIP = {
  contentStyle: { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12, boxShadow: 'var(--shadow-popover)' },
  labelStyle: { color: 'var(--color-text)', fontWeight: 600 },
  itemStyle: { color: 'var(--color-text)' },
  cursor: { fill: 'var(--color-fill-subtle)' },
};

export function BarrasPorEstado({ datos }: { datos: Indicadores['porEstado'] }) {
  if (!datos.some((d) => d.total > 0)) return <EstadoVacio titulo="Sin solicitudes en el período">Ajusta las fechas o la categoría.</EstadoVacio>;
  const filas = datos.map((d) => ({ ...d, corto: ESTADO_CORTO[d.codigo] }));
  return (
    <div className="grafico" role="img" aria-label={`Solicitudes por estado: ${datos.map((d) => `${d.nombre} ${d.total}`).join(', ')}`}>
      <ResponsiveContainer>
        <BarChart data={filas} margin={{ top: 20, right: 8, left: 8, bottom: 0 }} barCategoryGap="28%">
          <XAxis dataKey="corto" tickLine={false} axisLine={false} tick={EJE} interval={0} />
          <Tooltip {...ESTILO_TOOLTIP} formatter={(valor) => [valor, 'Solicitudes']} labelFormatter={(_l, p) => p[0]?.payload?.nombre ?? ''} />
          <Bar dataKey="total" radius={[4, 4, 4, 4]} isAnimationActive={false}>
            <LabelList dataKey="total" position="top" style={{ fontSize: 11, fill: 'var(--color-text)' }} />
            {filas.map((d) => (
              // "En proceso" es el trabajo en curso: es lo que se destaca con el color del rol.
              <Cell key={d.codigo} fill={d.codigo === 'EN_PROCESO' ? 'var(--color-accent)' : 'var(--color-control-border)'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Agrupa la serie diaria del backend para que sea legible: por día hasta 14 días; por semana si el período es mayor. */
export function agruparEvolucion(serie: Indicadores['evolucion']): Array<{ etiqueta: string; creadas: number; resueltas: number }> {
  if (serie.length <= 14) return serie.map((d) => ({ etiqueta: formatoDiaMes(d.fecha), creadas: d.creadas, resueltas: d.resueltas }));
  const semanas: Array<{ etiqueta: string; creadas: number; resueltas: number }> = [];
  serie.forEach((d, i) => {
    const indice = Math.floor(i / 7);
    const semana = (semanas[indice] ??= { etiqueta: `Sem. ${formatoDiaMes(d.fecha)}`, creadas: 0, resueltas: 0 });
    semana.creadas += d.creadas;
    semana.resueltas += d.resueltas;
  });
  return semanas;
}

export function BarrasEvolucion({ datos }: { datos: Indicadores['evolucion'] }) {
  const filas = agruparEvolucion(datos);
  if (!filas.some((d) => d.creadas > 0 || d.resueltas > 0)) return <EstadoVacio titulo="Sin movimiento en el período" />;
  return (
    <>
      <div className="leyenda">
        <span>
          <i style={{ background: 'var(--color-accent)' }} />
          Creadas
        </span>
        <span>
          <i style={{ background: 'var(--color-control-border)' }} />
          Resueltas
        </span>
      </div>
      <div className="grafico" style={{ height: 160 }} role="img" aria-label={`Evolución: ${filas.map((d) => `${d.etiqueta}, ${d.creadas} creadas y ${d.resueltas} resueltas`).join('; ')}`}>
        <ResponsiveContainer>
          <BarChart data={filas} margin={{ top: 8, right: 8, left: 8, bottom: 0 }} barGap={2} barCategoryGap="24%">
            <XAxis dataKey="etiqueta" tickLine={false} axisLine={false} tick={EJE} />
            <Tooltip {...ESTILO_TOOLTIP} />
            <Bar dataKey="creadas" name="Creadas" fill="var(--color-accent)" radius={[3, 3, 3, 3]} isAnimationActive={false} />
            <Bar dataKey="resueltas" name="Resueltas" fill="var(--color-control-border)" radius={[3, 3, 3, 3]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}

/** Filtros del período y de dimensión. Las fechas se envían al backend, que es quien filtra y calcula. */
export function FiltrosPeriodo({ filtro, alCambiar, categorias }: { filtro: FiltroIndicadores; alCambiar: (cambios: FiltroIndicadores) => void; categorias: Categoria[] }) {
  return (
    <>
      <div className="campo" style={{ width: 150 }}>
        <label htmlFor="desde">Desde</label>
        <TextField id="desde" type="date" value={filtro.desde ?? ''} onChange={(e) => alCambiar({ desde: e.target.value })} slotProps={{ htmlInput: { max: filtro.hasta } }} />
      </div>
      <div className="campo" style={{ width: 150 }}>
        <label htmlFor="hasta">Hasta</label>
        <TextField id="hasta" type="date" value={filtro.hasta ?? ''} onChange={(e) => alCambiar({ hasta: e.target.value })} slotProps={{ htmlInput: { min: filtro.desde } }} />
      </div>
      <div className="campo">
        <span className="rotulo">Categoría</span>
        <Filtro etiqueta="Todas" valor={String(filtro.categoria_id ?? '')} alCambiar={(v) => alCambiar({ categoria_id: v })} opciones={categorias.map((c) => ({ valor: c.id, texto: c.nombre }))} ancho={180} />
      </div>
    </>
  );
}
