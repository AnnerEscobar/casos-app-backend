# Búsquedas V3: interfaz, permisos y solicitudes

## Corrección de permisos autorizados ausentes del listado

La comprobación de permisos consultaba `casoId` con ObjectId, pero los permisos existentes almacenaban ese campo Mixed como texto. MongoDB no iguala ambos tipos. La consulta ahora admite ambas representaciones sin migrar ni modificar registros. Dos pruebas de regresión reproducen la comparación por tipo BSON y comprueban listado, detalle y documentos. Se verificó además el expediente reportado mediante el servicio compilado contra la base local, en modo de solo lectura: aparece autorizado y devuelve un documento principal y dos seguimientos con sus archivos.

## Consulta completa de expedientes compartidos

Desde Búsquedas → Expedientes compartidos y permisos, se abre el expediente pulsando su DEIC o «Ver expediente». La columna de acciones queda fija al desplazar la tabla.

El diálogo consulta nuevamente el permiso en el backend y presenta datos del caso, personas, denunciante, localización, información histórica, documentos principales, seguimientos y revisiones con sus archivos. Los nombres de quienes registraron/asignaron/revisaron se resuelven sin incluir información privada de las cuentas. Los enlaces de Drive de descarga se convierten a enlaces de visor; los otros enlaces se conservan. No se alteran permisos de Google Drive ni se certifica aquí la disponibilidad de cada archivo externo.

La autorización de consulta no habilita edición ni registro de seguimientos. Las solicitudes revocadas siguen bloqueadas por el endpoint de detalle.

## Ampliación del 12/09/2026: expedientes compartidos y revocación

- Nueva ruta frontend `/casos/expedientes-compartidos`, accesible desde ambas pantallas de búsqueda. El investigador ve únicamente expedientes ajenos con autorización vigente o seguimiento asignado. Incluye filtro por identificador/persona y paginación de diez filas.
- La gestión de solicitudes se muestra expandida en esa pantalla. El beneficiario puede renunciar, el propietario puede revocar y los roles institucionales pueden gestionar permisos. Se pide confirmación dentro de la interfaz antes de revocar.
- Nuevo `GET /busquedas/compartidos` y `PATCH /busquedas/solicitudes/:id/revocar`. El backend valida al actor, cambia atómicamente AUTORIZADA a REVOCADA y registra `revocadoPor` y `fechaRevocacion`. Un tercero recibe 403; un permiso que ya no está autorizado devuelve 409. La titularidad no cambia.
- La revocación impide consultas posteriores mediante ese permiso; no cancela un seguimiento formalmente asignado. La interfaz explica esta diferencia. Se permite volver a solicitar acceso tras una revocación.
- Las tarjetas de búsqueda simple muestran el desaparecido en Alerta, las víctimas en Maltrato y los adolescentes en Conflicto. No se añaden nombres a resultados restringidos.
- La búsqueda avanzada utiliza una tabla Angular Material reutilizable, conservando filtro rápido y paginación. Columnas: expediente, persona, tipo/origen, investigador, estado/acceso, último movimiento y acción. En pantallas estrechas, la tabla tiene desplazamiento horizontal contenido dentro del módulo y accesible por teclado.
- Nuevos archivos frontend: `persona-expediente.ts`, `expedientes-compartidos.component.ts`, `components/tabla-expedientes.component.ts`. Se amplían servicios, rutas, solicitudes y pruebas existentes. No se modifica el layout global.

El resumen del rediseño inicial que sigue describe la versión anterior con tarjetas en búsqueda avanzada; esta ampliación la sustituye por la tabla solicitada.

Validación de esta ampliación: 185 pruebas backend y 87 frontend aprobadas. Compilación de backend correcta; las pruebas utilizan persistencia y respuestas HTTP simuladas, sin modificar datos reales.

## Corrección del 11/09/2026: identidad del investigador

La sesión real de `JwtStrategy` devuelve `userId` como ObjectId de MongoDB. Las comparaciones estrictas contra identificadores de texto hacían que un expediente propio apareciera restringido por DEIC y se excluyera en búsquedas por nombre y filtros. Se normalizan ambos valores al comprobar propiedad, seguimiento asignado y permisos de revisión, incluida la prohibición de autoautorizarse. No se modifican la titularidad ni los datos del expediente.

Se agregaron nueve regresiones con ObjectId reales, incluidas rutas HTTP de nombre, filtros y DEIC, acceso al detalle, los tres tipos de caso y titularidad histórica. Resultado: 178 pruebas backend aprobadas y compilación backend correcta. Estas pruebas simulan la persistencia; no escriben en la base de datos real.

## Resumen funcional

La búsqueda simple (DEIC, MP, Alerta, nombre y CUI), la búsqueda avanzada y los expedientes relacionados comparten tarjetas de resultados. El detalle se carga en un diálogo mediante un endpoint que vuelve a comprobar el acceso. Las solicitudes se persisten en MongoDB y pueden autorizarse o rechazarse desde la misma pantalla.

| Usuario / condición | Consulta en Búsquedas |
| --- | --- |
| Admin, Analista o Jefe | Consulta institucional; filtros de investigador y origen; revisión de solicitudes ajenas |
| Investigador responsable | Expediente propio; puede resolver solicitudes ajenas de su expediente |
| Investigador con seguimiento asignado | Acceso identificado como «Seguimiento asignado» |
| Investigador con solicitud autorizada | Acceso identificado como «Acceso autorizado»; no cambia la titularidad |
| Investigador sin acceso, búsqueda exacta | Solo identificador DEIC, tipo e investigador, más el estado de su solicitud |
| Investigador sin acceso, búsqueda general | El expediente se excluye de los resultados |

La titularidad se obtiene del investigador original vinculado a un usuario investigador en casos históricos; en los demás casos se utiliza el usuario investigador que registró el caso. Un creador con rol Analista no se presenta como investigador. Cuando no hay investigador vinculable, se muestra sin asignación y la revisión corresponde a los roles institucionales.

La identidad del solicitante y del revisor procede del JWT. El motivo admite de 10 a 1000 caracteres. Un índice único por tipo, expediente y solicitante impide duplicados. Las transiciones de pendiente a autorizada/rechazada son atómicas; nadie puede resolver su propia solicitud. Una solicitud rechazada puede reenviarse actualizando su registro. No se reasigna el expediente.

## Los 11 puntos del rediseño

1. **Cambio visual:** encabezados compactos, filtros agrupados, tarjetas con identificador dominante, información resumida y una acción principal. Historial y archivos quedan en el detalle.
2. **HTML reorganizado:** búsqueda simple y avanzada pasan a panel de filtros, resumen, estados y grilla; el perfil reutiliza las mismas tarjetas. Se extraen tarjetas, detalle, formulario de solicitud y listado de solicitudes.
3. **CSS:** `busquedas-v3.css` reúne estilos locales compartidos. Se reemplazan los CSS de las tres pantallas y se agregan estilos de componentes. Grid, flex y gap sustituyen distribuciones rígidas. La corrección del borde de Material está limitada al componente.
4. **Angular Material:** form-field, select, input, datepicker, button, icon, dialog, paginator y progress-spinner; etiquetas equivalentes a chips para estados. Paginador y controles del calendario en español.
5. **Responsive:** resultados en dos columnas en escritorio y una a partir de 1050 px hacia abajo. Filtros pasan de tres a dos y una columna; ajustes móviles a 600 px. Revisión con datos ficticios a 1440, 768 y 390 px sin desbordamiento horizontal en las pantallas revisadas.
6. **Resultado propio:** tarjeta con DEIC, tipo, estado, investigador, último movimiento y «Ver expediente». La cantidad de seguimientos se prioriza en la vista institucional.
7. **Resultado restringido:** tarjeta con candado, DEIC, tipo, investigador y «Solicitar acceso». El backend omite personas, MP, documentos, estado e historial en esa respuesta.
8. **Solicitud pendiente:** sustituye el botón por estado y fecha de envío. El formulario bloquea envíos repetidos y conserva el motivo ante errores.
9. **Acceso autorizado:** etiqueta explícita y «Ver expediente», manteniendo al investigador responsable. La asignación formal de seguimiento tiene su propia etiqueta.
10. **Sin resultados:** mensaje neutral que invita a corregir el criterio. Se distingue de un expediente restringido y de un fallo de red. Durante la carga se conservan los resultados anteriores y se deshabilita la búsqueda repetida.
11. **Consistencia V3:** se conservan sidenav, toolbar, tema, tipografía, paleta y rutas principales. Se usan Material, superficies limpias, bordes suaves, sombras discretas y estilos acotados al módulo; etiquetas y foco visible no dependen únicamente del color.

## Archivos principales

Frontend, relativos a `casos-app/src/app/busquedas/`:

- `search-profile/search-profile.component.{ts,html,css}` y `busqueda.service.ts`.
- `busqueda-avanzada/busqueda-avanzada.component.{ts,html,css}` y `busqueda-avanzada.service.ts`.
- `profile/profile.component.{ts,html,css}`.
- `busquedas-v3.css` y `busquedas.spec.ts`.
- `components/resultado-expediente.component.{ts,html,css}`.
- `components/expediente-dialog.component.{ts,html,css}`.
- `components/solicitar-acceso-dialog.component.ts`.
- `components/solicitudes-acceso.component.{ts,html,css}`.

Backend, relativos a `casos-app-backend/src/busquedas/`:

- `busquedas.controller.ts`, `busquedas.service.ts`, `busquedas.module.ts`.
- `busqueda-acceso.service.ts`, `solicitud-acceso.schema.ts`, `solicitud-acceso.dto.ts`.
- `busqueda-acceso.spec.ts`.

Además se corrigió la búsqueda avanzada sin tipo seleccionado para combinar los tres tipos, el filtro de estado de Conflicto, la validación de fechas y la devolución de todos los resultados por MP.

## API nueva

- `GET /busquedas/expediente/:tipo/:id`: detalle con comprobación de acceso.
- `GET /busquedas/investigadores`: opciones para roles institucionales.
- `GET /busquedas/solicitudes`: solicitudes visibles según rol e identidad.
- `POST /busquedas/solicitudes`: motivo, tipo y casoId; solicitante determinado por sesión.
- `PATCH /busquedas/solicitudes/:id`: estado AUTORIZADA o RECHAZADA, con autorización del revisor.

## Alcance y validación

Los controles añadidos protegen los endpoints de Búsquedas y su nuevo detalle. Esta implementación no constituye una revisión global de los otros endpoints de casos ni modifica permisos de enlaces existentes en Google Drive. Los PDFs siguen usando el almacenamiento existente.

Backend y frontend deben actualizarse juntos. El módulo registra la colección de solicitudes y sus índices de Mongoose; el despliegue debe permitir crear el índice único definido en el esquema.

Pruebas de backend: 169 aprobadas, incluyendo 31 nuevas de acceso, filtrado, validación, concurrencia y rutas HTTP con persistencia simulada. Comando desde el backend:

```powershell
node --experimental-vm-modules node_modules/jest/bin/jest.js --config test/jest-historicos.json --testRegex='.*\.spec\.ts$' --runInBand --silent
```

Frontend: 84 pruebas aprobadas, incluyendo 16 nuevas del módulo. Compilaciones finales de frontend (producción) y backend completadas correctamente. Karma emitió un aviso al cerrar ChromeHeadless después de finalizar las pruebas; el proceso terminó con código 0.

Comandos de frontend:

```powershell
npm.cmd test -- --watch=false --karma-config karma.historicos.conf.cjs
npm.cmd run build
```

Compilación de backend: `npm.cmd run build`.

La revisión visual utilizó componentes reales con datos ficticios. No se realizaron escrituras de prueba en MongoDB ni Google Drive; la integración con esos servicios reales no queda certificada por estas pruebas.
