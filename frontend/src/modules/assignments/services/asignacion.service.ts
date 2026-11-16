import { api } from '../../../shared/http/client';
import type { CandidatoSugerido, Solicitud } from '../../../shared/types/api';

export const asignacionService = {
  /** Técnicos con la especialidad de la categoría; el backend indica quién es elegible y por qué no. */
  sugeridos: (solicitudId: number) => api.get<CandidatoSugerido[]>(`/solicitudes/${solicitudId}/tecnicos-sugeridos`).then((r) => r.data),
  /** Asigna (o reasigna, con motivo). El backend valida especialidad, disponibilidad y carga. */
  asignar: (solicitudId: number, tecnicoId: number, motivo?: string) =>
    api.post<Solicitud>(`/solicitudes/${solicitudId}/asignaciones`, { tecnico_id: tecnicoId, motivo }).then((r) => r.data),
};
