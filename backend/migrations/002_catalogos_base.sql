-- =====================================================================
-- 002 · Catálogos base (datos de referencia, NO datos de prueba)
-- El script original (001) es solo diseño y no incluye datos. Sin estas
-- filas la aplicación no puede operar: los roles, los estados del ciclo
-- de vida y las prioridades son parte del modelo, no de la demostración.
-- Los datos de demostración viven aparte (src/seeds, SEED_DEMO=true).
-- =====================================================================

INSERT INTO roles (codigo, nombre) VALUES
    ('ADMIN',       'Administrador'),
    ('COORDINADOR', 'Coordinador'),
    ('TECNICO',     'Técnico'),
    ('CLIENTE',     'Cliente');

INSERT INTO estados (codigo, nombre, es_final, orden) VALUES
    ('REGISTRADA',     'Registrada',                FALSE, 1),
    ('APROBADA',       'Aprobada',                  FALSE, 2),
    ('ASIGNADA',       'Asignada',                  FALSE, 3),
    ('EN_PROCESO',     'En proceso',                FALSE, 4),
    ('PENDIENTE_INFO', 'Pendiente de información',  FALSE, 5),
    ('RESUELTA',       'Resuelta',                  FALSE, 6),
    ('CERRADA',        'Cerrada',                   TRUE,  7),
    ('CANCELADA',      'Cancelada',                 TRUE,  8);

-- Plazo de atención (SLA) por prioridad, en horas. Editable por el ADMIN.
INSERT INTO prioridades (codigo, nombre, horas_plazo, orden) VALUES
    ('BAJA',    'Baja',    72, 1),
    ('MEDIA',   'Media',   48, 2),
    ('ALTA',    'Alta',    24, 3),
    ('CRITICA', 'Crítica',  8, 4);

INSERT INTO parametros (clave, valor, descripcion) VALUES
    ('UMBRAL_POR_VENCER_PCT', '25',
     'Porcentaje del plazo restante a partir del cual una solicitud abierta se considera "por vencer" (1-90).'),
    ('MAX_SOLICITUDES_ACTIVAS_DEFECTO', '5',
     'Carga máxima de solicitudes activas que se propone al crear un técnico (1-50).'),
    ('MAX_ADJUNTOS_POR_SOLICITUD', '5',
     'Número máximo de archivos adjuntos por solicitud (1-20).');
