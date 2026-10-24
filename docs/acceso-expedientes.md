# Permisos de expedientes y seguimiento

La política compartida vive en `src/common/acceso-expediente.ts`. Se aplica antes
de responder en listados y consultas directas y antes de subir archivos o guardar
un seguimiento. Búsquedas utiliza la misma selección del responsable principal.

| Identidad | Consultar expediente | Registrar seguimiento |
|---|---|---|
| Sin sesión o rol desconocido | No | No |
| Administrador / Jefe | Institucional | No |
| Analista | Institucional | Sí, en expedientes aprobados |
| Investigador responsable principal | Sí | Sí, si está aprobado y admite seguimientos |
| Investigador con seguimiento asignado | Sí | Sí, si está aprobado y admite seguimientos |
| Investigador con solicitud AUTORIZADA | Sí | No, salvo que además sea responsable o tenga seguimiento asignado |
| Investigador ajeno / solicitud pendiente, rechazada o revocada | No | No |

El responsable principal se resuelve por `investigadorAsignado`, luego por el
investigador original de un histórico y finalmente por el registrador de registros
anteriores sin asignación explícita. Los ID de objetos poblados, ObjectId y texto
se comparan por su valor. La asignación principal prevalece sobre un registrador
anterior al reasignar un expediente.

Un seguimiento ya asignado concede acceso independiente de una solicitud de
consulta. Revocar esta última no elimina esa asignación. Los investigadores no
pueden elegir a otra persona como responsable de un seguimiento; el analista sí
puede asignar investigadores activos.

Las rutas de listados solo devuelven los expedientes visibles. Las búsquedas
exactas mantienen sus tarjetas restringidas sin datos sensibles. Las rutas directas
de Alerta por DEIC/MP, Maltrato por DEIC y Conflicto por DEIC aplican la misma
política. Una solicitud de consulta no concede permiso de edición del caso.

Conflicto expone `GET /conflictos/buscar/:numeroDeic` y
`PATCH /conflictos/seguimiento/:numeroDeic` para el contrato del frontend.
La carga de seguimiento de Maltrato y Conflicto exige PDF. Los archivos opcionales
de Alerta también pasan por el validador de PDF. Los seguimientos no permiten
modificar expedientes todavía en preparación, pendientes o rechazados, y conservan
el control de estados terminales y de concurrencia existente.

Las escrituras y sus eventos siguen usando la misma transacción de auditoría.
Los rechazos no suben archivos a Drive ni asignan permisos de seguimiento.
