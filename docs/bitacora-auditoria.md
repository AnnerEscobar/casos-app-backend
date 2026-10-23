# Bitácora de auditoría

## Qué registra

Colección independiente `bitacora_auditoria`, sin TTL ni rutas de modificación o
borrado. Conserva el UUID del evento y de su solicitud, fecha del servidor en
UTC, usuario autenticado (ID, nombre y rol de ese momento), recurso, ID del
recurso, caso relacionado, DEIC, método/ruta, dirección de conexión y agente de
usuario declarado. El navegador y su cabecera no prueban identidad: esta viene
de JWT validado contra el usuario activo y su sesión persistida.

Para cada escritura se comparan los datos realmente persistidos antes y después,
con una entrada por campo. Incluye `estadoInvestigacion: Localizado → Remitido`,
arrays de seguimientos, asignaciones, revisión, históricos, documentación,
carátulas, informes, solicitudes de acceso y cambios de usuarios. No introduce
estados nuevos ni cambia las reglas de seguimiento/cierre. No se reconstruye
historial anterior a instalar esta funcionalidad.

Se excluyen contraseñas, tokens, secretos y metadatos de presentación; tampoco se
copia el cuerpo HTTP ni las cookies o cabeceras de autorización. La bitácora sí
puede contener datos sensibles del expediente en los campos modificados y debe
protegerse como tal. No es un almacén de los archivos completos.

Las búsquedas, filtros, resultados y su paginación no generan eventos de consulta.
Abrir el detalle de un expediente genera un único evento EXITOSO, con su tipo,
identificador y DEIC cuando se consulta desde `/busquedas/expediente/:tipo/:id`.
La lista de auditoría tampoco se registra automáticamente al cargarla o paginarla;
la consulta individual de un evento sí. Las descargas generan solo INICIADO antes del handler: no acredita que
el navegador haya recibido el archivo. Un fallo posterior genera su evento de
error. Los rechazos de acceso se registran al terminar la respuesta, incluidos guards.
Las rutas de
login/logout identifican al usuario real sin guardar credenciales. Las lecturas
individuales de la propia bitácora también quedan registradas. Se omiten lecturas automáticas
de sesión, paneles, listados y catálogos, así como el 401 esperado de `/auth/session`
cuando no hay sesión. Los fallos de esas cargas (salvo rechazos de acceso) y las
rutas inexistentes sin usuario se envían al log técnico del servidor. Las URLs
se toman de `originalUrl` sin parámetros de consulta para conservar la ruta
completa aunque Express monte el middleware en `/`.
El cierre de sesión que solo
ocurra en el navegador no equivale a una llamada de logout al servidor.

## Atomicidad y operaciones permitidas

Un interceptor inicia una transacción por petición POST/PUT/PATCH/DELETE.
AsyncLocalStorage enlaza el contexto y la sesión con el middleware Mongoose
instalado en la conexión antes de compilar los ocho modelos auditados. Sus
lecturas comparten snapshot y sus escrituras, el registro del cambio y el evento
HTTP (cuando no duplica eventos de datos) se confirman juntos con
`writeConcern: majority`. Login/logout conservan su propio evento. Si falla la auditoría o el
handler, se aborta. El actor nunca procede del cuerpo de la petición. No se
reintenta automáticamente el handler, porque puede subir archivos a Drive.

Los expedientes no admiten DELETE desde HTTP ni desde operaciones Mongoose.
No se agregó una baja lógica ni un rol con permiso de borrar casos. Se conserva
la eliminación existente de borradores/documentos, ahora con su registro en una
colección independiente. `save`, `updateOne`, `findOneAndUpdate`, `deleteOne` y
`findOneAndDelete` tienen captura individual. Se rechazan escrituras masivas,
reemplazos, pipelines y upserts en modelos auditados. Nuevos jobs/scripts deberán
usar un contexto y transacción explícitos. No usar `.collection` para escribir
recursos auditados: el driver nativo no ejecuta middleware Mongoose.

Drive no participa en las transacciones MongoDB. Una subida seguida de un fallo
puede dejar un archivo sin referencia; no se agregó limpieza automática. Los
intentos HTTP fallidos se registran fuera de la transacción abortada al terminar
la respuesta: un corte del proceso o indisponibilidad del diario en ese momento
puede impedir registrar el intento; se emite un error técnico con su solicitud.
Esto no permite confirmar un cambio de datos sin auditoría.

## Preparación obligatoria antes de arrancar

1. Usar MongoDB autenticado **replica set o Atlas**. Standalone no admite las
   transacciones requeridas. No hay modo de desactivar auditoría para seguir
   guardando. No convertir ni modificar una base existente sin respaldo y una
   preparación explícita del entorno.
2. Con una cuenta administrativa, seleccionar la base correcta y ejecutar
   `scripts/configurar-auditoria.mongosh.js`. Crea colección, índices y un rol
   dedicado; no crea usuarios ni cambia sus roles. Revisar nombres de colecciones
   si el entorno utiliza convenciones diferentes a los modelos actuales.
3. Crear una cuenta de aplicación dedicada y asignarle **solo**
   `sgic_aplicacion_auditada`, con autenticación en la base correspondiente.
   Actualizar `MONGO_URI` mediante configuración de secretos. No sumar readWrite,
   dbOwner, dbAdmin, userAdmin ni root. Los privilegios MongoDB son acumulativos.
   En Atlas usar su configuración de roles personalizados equivalente; el script
   mongosh está orientado a MongoDB autogestionado.
4. Configurar `AUDIT_HMAC_KEY` con un secreto aleatorio de al menos 32 bytes,
   estable entre reinicios y compartido por las instancias. Guardar una copia
   protegida fuera de la base. Nunca incluirlo en Git ni en respuestas HTTP.
   Una rotación exige una estrategia de claves históricas; cambiarlo directamente
   hace fallar la verificación de eventos anteriores.
5. El inicio comprueba topología, autenticación, privilegios efectivos sobre el
   diario, índice único por evento y ausencia de TTL. La aplicación no tiene
   permisos para cambiar índices del diario ni para añadir expiración.

## Consulta y ejemplo

### Sesiones por inactividad

La sesión vence tras 15 minutos sin interacción. `/auth/actividad` renueva ese
plazo desde el reloj del servidor, únicamente si la sesión sigue vigente. El
frontend agrupa las interacciones y no renueva por polling, cargas HTTP ni por
consultar `/auth/session`. Las pestañas comparten el vencimiento y el servidor
comprueba la sesión persistida en cada petición protegida.

El JWT nuevo tiene identificador aleatorio y firma, sin vencimiento fijo de una
hora: su vigencia depende del token persistido, usuario activo y `sesionExpira`.
Los tokens emitidos antes de esta actualización requieren volver a iniciar
sesión. La cookie se renueva con la actividad. No se aceptan fechas de actividad
ni duraciones calculadas por el navegador.

El cierre guarda un evento firmado `CERRAR_SESION` con identificador de sesión,
inicio, última actividad, fin, duración total en segundos y motivo: `MANUAL`,
`INACTIVIDAD` o `NUEVO_INICIO` (otra sesión de la misma cuenta). La duración incluye
la espera antes de vencer; no mide trabajo efectivo. Un proceso revisa sesiones
vencidas cada 30 segundos y después de arrancar, incluso sin navegador abierto.
El fin por inactividad es el vencimiento calculado, no la hora tardía de detección.
La invalidación y el evento se confirman juntos; los conflictos concurrentes se
revisan en el siguiente ciclo. Las renovaciones técnicas no generan eventos.
No se reconstruyen duraciones de sesiones antiguas ni se alteran sus eventos.
No se necesitan nuevas colecciones ni privilegios MongoDB.

Pantalla `/casos/auditoria`, visible y autorizada en backend únicamente para
Administrador y Jefe. Frontend y backend deben actualizarse juntos. Búsqueda
paginada con DEIC exacto, nombre parcial literal o ID de usuario, recurso,
acción, resultado, solicitud y rango de fechas. Las fechas de la pantalla se
interpretan expresamente como Guatemala (UTC−06:00), independientemente del equipo.

Para el ejemplo, elegir recurso `CasosAlerta`, acción `MODIFICAR`, campo
`estadoInvestigacion`, anterior `Localizado` y nuevo `Remitido`. El filtro usa
`$elemMatch` para que ambos valores pertenezcan al mismo cambio. No enviar
“Localizado” por medio de un endpoint que no lo admita; los estados válidos
siguen siendo los del flujo existente.

API de solo lectura:

- `GET /auditoria?numeroDeic=...&campo=estadoInvestigacion&anterior=Localizado&nuevo=Remitido`
- `GET /auditoria/:eventoId`

La respuesta incluye `integridadValida`, calculada con HMAC-SHA256 del evento
completo, salvo su `_id` de Mongo y la propia firma. La clave nunca se devuelve.
La pantalla muestra los valores exactos, identidad histórica, hora local/UTC,
IP de conexión (puede ser del proxy), agente e identificadores para correlación.
No se confía directamente en X-Forwarded-For ni en un ID enviado por el cliente.

## Protección y límites

La aplicación solo puede INSERTAR y LEER el diario; no actualizarlo, borrarlo,
cambiar índices ni crear TTL. El servidor rechaza credenciales amplias que
anulen esta protección. La firma detecta alteraciones del contenido, pero no
demuestra la ausencia de eventos borrados, ni protege contra quien robe la clave
y controle el servidor. Un administrador de infraestructura puede cambiar roles
o borrar la base: ningún controlador HTTP puede impedirlo.

Para resistir ese acceso se requieren además respaldos automáticos en otra
cuenta/ubicación, retención inmutable (WORM/Object Lock o equivalente), pruebas
de restauración y separación de credenciales administrativas. Eso se configura
en infraestructura y no se ha aplicado a una base o servicio real en esta tarea.
Los accesos directos a URLs externas de Drive tampoco atraviesan este servidor.

## Verificación

Backend: `node node_modules/jest/bin/jest.js --config test/jest-auditoria.json --runInBand`.
Frontend: suite `src/app/auditoria/auditoria.component.spec.ts` con Karma.
Las pruebas unitarias usan middleware real de Mongoose y un driver simulado;
los tests del interceptor comprueban commit/abort y que no se confirma ante fallo
de auditoría. No equivalen a una prueba real de réplica, roles ni rollback en
MongoDB. Antes de producción, con expedientes ficticios, verificar que una
credencial de aplicación recibe Unauthorized al intentar update/delete/drop/TTL
del diario, que un fallo de inserción revierte el cambio, y que dos cambios
concurrentes conservan su trazabilidad. No se ha hecho push ni despliegue.

Resultado local de esta implementación: 36 pruebas de auditoría backend, 10
pruebas frontend en escritorio y móvil (20 ejecuciones), 18 regresiones de
documentación y 29 de mayúsculas correctas. Compilación Nest y Angular de
desarrollo correctas. La compilación Angular de producción no se verificó en
esta etapa; existe un bloqueo anterior documentado por presupuestos CSS.
## Activación local realizada el 22/10/2026

La base local `caso-db` se respaldó antes de modificar su configuración. MongoDB
7.0.12 continúa usando `./mongo` y ahora ejecuta el replica set de un miembro
`sgic-rs`, con autenticación y keyfile. El puerto se publica únicamente en
`127.0.0.1:27017`. Un replica set de un miembro habilita transacciones, pero no
proporciona alta disponibilidad ante la pérdida de este equipo.

Se crearon una cuenta administrativa local separada y una cuenta de aplicación
con el rol limitado. `.env` contiene la URI de esta última y `AUDIT_HMAC_KEY`.
No se cambiaron contraseñas ni sesiones de usuarios existentes de la aplicación.
`config/auditoria-local/` conserva el archivo de secretos, keyfile, copia anterior
de `.env`, conteos originales y `antes-auditoria.archive.gz`. Tanto `config/`
como `.env` están excluidos de Git. **Conservar esa carpeta**: Docker monta su
keyfile para arrancar; no es una carpeta temporal. El respaldo sigue siendo
local y no sustituye un respaldo externo inmutable.

Verificaciones reales completadas:

- Los conteos de todos los documentos originales permanecen iguales.
- La cuenta de aplicación recibe Unauthorized al intentar update/delete/drop
  o crear un índice TTL en la bitácora. DROP se comprobó cuando todavía estaba
  vacía; el script no lo vuelve a intentar si ya contiene eventos.
- Una transacción real guardó y verificó `Localizado → Remitido`, identidad y
  firmas, y luego se abortó: no quedó ningún expediente de prueba.
- Una inserción de auditoría fallida provocada durante la prueba revierte la
  escritura real del caso.
- El backend arrancó con la configuración protegida. Pruebas HTTP reales con
  cuentas ficticias: Administrador/Jefe 200; Analista/Investigador 403; anónimo
  401. Login y logout correctos. Las cuentas ficticias se eliminaron al terminar;
  su creación, accesos y limpieza permanecen en la bitácora.

Scripts locales (requieren Docker disponible y backend compilado):

- `node scripts/configurar-auditoria-local.cjs verificar`: cuenta limitada,
  respaldo de conteos, permisos y rollback de inserción en el diario.
- `node scripts/verificar-auditoria-local.cjs`: integración Mongoose/MongoDB con
  escrituras de expedientes siempre abortadas.
- `node scripts/verificar-auditoria-http-local.cjs`: API local en puerto 3000
  (o PORT), cuatro roles y limpieza de cuentas ficticias con auditoría.

La configuración realizada corresponde al entorno local. No se modificó
producción, no se hizo push y no se configuró almacenamiento WORM externo.
