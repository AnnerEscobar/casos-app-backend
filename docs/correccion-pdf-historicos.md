# Corrección del PDF en casos históricos V3

## Comportamiento existente y reutilizado

Los tres registros normales envían multipart/form-data: PDF en el campo **file**, datos simples como texto y objetos/arreglos como JSON. NestJS recibe los datos en CreateCasosAlertaDto, CreateCasosMaltratoDto o CreateCasosConflictoDto, y el archivo por UploadedFile con FileInterceptor('file'). ParseFilePipeBuilder conserva application/pdf; en la versión instalada también comprueba la firma del contenido. Los controles Angular conservan su validación existente de MIME/extensión PDF. No se encontró un máximo de tamaño configurado en estos controles/interceptores y no se agregó uno.

Los tres endpoints normales exigen PDF. Los históricos ya admitían registros sin PDF; siguen admitiéndolos con cualquier estado válido. COMPLETO y PARCIAL permiten adjuntar un PDF opcional con el mismo selector, cuyo indicador pasa a «Opcional» en modo histórico.

El servicio de cada módulo renombra el archivo con el número de caso normalizado y su extensión, por ejemplo DEIC51-2016-05-18-421.pdf. La operación existente se extrajo a subirDocumentoCaso dentro del mismo servicio para compartirla entre creación normal e histórica. Sigue llamando a GoogleApiService.uploadFile y, a través de este, a GoogleDriveService.uploadImage. Se conserva la carpeta configurada en GoogleApiModule mediante GOOGLE_DRIVE_FOLDER_ID y su configuración existente; no se crean carpetas históricas ni servicios de almacenamiento.

MongoDB conserva **fileUrls: string[]** en el documento del caso. Alerta extrae el ID del enlace devuelto y guarda https://drive.google.com/uc?export=download&id=ID. Maltrato y Conflicto guardan directamente la URL devuelta por el servicio. No se agregaron campos, colecciones ni migraciones.

## Endpoints y recepción

- POST /alertas/historico
- POST /maltratos/historico
- POST /conflictos/historico

Ahora aceptan FileInterceptor('file') y el validador PDF existente, con fileIsRequired: false. Mantienen los DTO históricos, adaptados para interpretar los objetos JSON de multipart y el año numérico, sin perder la validación anidada. JWT, roles y auditoría se conservan.

Angular envía un solo multipart cuando se adjunta PDF. Sin PDF conserva la petición JSON anterior. No hay carga posterior ni endpoint adicional. Los endpoints normales /alertas/crear-alerta, /maltratos/crear-maltrato y /conflictos/crear-conflicto mantienen su contrato y ahora llaman al mismo método privado de carga que los históricos.

Antes de subir se verifican permisos, estado, identificadores duplicados, investigador original y validación del documento Mongo. La URL se asigna a fileUrls del caso antes de guardarlo.

## Cambio de estado y consulta

Al cambiar a NO_LOCALIZADO se destruye el selector mediante ngIf, se limpian selectedFile y fileName y se omite el archivo al enviar. Se lee directamente el valor del FormControl porque valueChanges precede a la actualización del valor agregado del FormGroup. Al regresar a PARCIAL/COMPLETO aparece un selector vacío. El serializador también omite file para NO_LOCALIZADO y el backend rechaza un archivo enviado con ese estado antes de subirlo.

El diálogo conserva historicoCreado y su cierre actual para continuar el seguimiento. La consulta utiliza fileUrls y los componentes existentes: búsqueda avanzada con «Ver documento» y «Descargar», perfil con descargarArchivo y diálogos de detalle/revisión con enlaces «Documento». No se cambia el visor. Un histórico anterior sin fileUrls sigue ocultando estos enlaces con las condiciones existentes.

Los PDF de seguimientos permanecen en **seguimientos[].archivos**, separados de **fileUrls**. Se prueba la incorporación con PDF seguida de otro PDF de seguimiento para los tres tipos, sin modificar los servicios de seguimiento.

## Archivos frontend modificados por esta corrección

- [add-case-alerta.component.ts](<C:/Users/anner/Desktop/UMG/10MO SEMESTRE/SEMINARIO/PROYECTO/casos-app/src/app/casos/pages/add-case-alerta/add-case-alerta.component.ts>)
- [add-case-alerta.component.html](<C:/Users/anner/Desktop/UMG/10MO SEMESTRE/SEMINARIO/PROYECTO/casos-app/src/app/casos/pages/add-case-alerta/add-case-alerta.component.html>)
- [alerta.service.ts](<C:/Users/anner/Desktop/UMG/10MO SEMESTRE/SEMINARIO/PROYECTO/casos-app/src/app/casos/services/alerta.service.ts>)
- [add-case-maltrato.component.ts](<C:/Users/anner/Desktop/UMG/10MO SEMESTRE/SEMINARIO/PROYECTO/casos-app/src/app/casos/pages/add-case-maltrato/add-case-maltrato.component.ts>)
- [add-case-maltrato.component.html](<C:/Users/anner/Desktop/UMG/10MO SEMESTRE/SEMINARIO/PROYECTO/casos-app/src/app/casos/pages/add-case-maltrato/add-case-maltrato.component.html>)
- [maltrato.service.ts](<C:/Users/anner/Desktop/UMG/10MO SEMESTRE/SEMINARIO/PROYECTO/casos-app/src/app/casos/services/maltrato.service.ts>)
- [add-case-conflicto.component.ts](<C:/Users/anner/Desktop/UMG/10MO SEMESTRE/SEMINARIO/PROYECTO/casos-app/src/app/casos/pages/add-case-conflicto/add-case-conflicto.component.ts>)
- [add-case-conflicto.component.html](<C:/Users/anner/Desktop/UMG/10MO SEMESTRE/SEMINARIO/PROYECTO/casos-app/src/app/casos/pages/add-case-conflicto/add-case-conflicto.component.html>)
- [conflicto.service.ts](<C:/Users/anner/Desktop/UMG/10MO SEMESTRE/SEMINARIO/PROYECTO/casos-app/src/app/casos/services/conflicto.service.ts>)
- [historico-formulario.ts](<C:/Users/anner/Desktop/UMG/10MO SEMESTRE/SEMINARIO/PROYECTO/casos-app/src/app/casos/historicos/historico-formulario.ts>)
- [historicos.spec.ts](<C:/Users/anner/Desktop/UMG/10MO SEMESTRE/SEMINARIO/PROYECTO/casos-app/src/app/casos/historicos/historicos.spec.ts>)

## Archivos backend modificados por esta corrección

- [casos-alerta.controller.ts](<C:/Users/anner/Desktop/UMG/10MO SEMESTRE/SEMINARIO/PROYECTO/casos-app-backend/src/casos-alerta/casos-alerta.controller.ts>)
- [casos-alerta.service.ts](<C:/Users/anner/Desktop/UMG/10MO SEMESTRE/SEMINARIO/PROYECTO/casos-app-backend/src/casos-alerta/casos-alerta.service.ts>)
- [create-historico-alerta.dto.ts](<C:/Users/anner/Desktop/UMG/10MO SEMESTRE/SEMINARIO/PROYECTO/casos-app-backend/src/casos-alerta/dto/create-historico-alerta.dto.ts>)
- [casos-maltrato.controller.ts](<C:/Users/anner/Desktop/UMG/10MO SEMESTRE/SEMINARIO/PROYECTO/casos-app-backend/src/casos-maltrato/casos-maltrato.controller.ts>)
- [casos-maltrato.service.ts](<C:/Users/anner/Desktop/UMG/10MO SEMESTRE/SEMINARIO/PROYECTO/casos-app-backend/src/casos-maltrato/casos-maltrato.service.ts>)
- [create-historico-maltrato.dto.ts](<C:/Users/anner/Desktop/UMG/10MO SEMESTRE/SEMINARIO/PROYECTO/casos-app-backend/src/casos-maltrato/dto/create-historico-maltrato.dto.ts>)
- [casos-conflicto.controller.ts](<C:/Users/anner/Desktop/UMG/10MO SEMESTRE/SEMINARIO/PROYECTO/casos-app-backend/src/casos-conflicto/casos-conflicto.controller.ts>)
- [casos-conflicto.service.ts](<C:/Users/anner/Desktop/UMG/10MO SEMESTRE/SEMINARIO/PROYECTO/casos-app-backend/src/casos-conflicto/casos-conflicto.service.ts>)
- [create-historico-conflicto.dto.ts](<C:/Users/anner/Desktop/UMG/10MO SEMESTRE/SEMINARIO/PROYECTO/casos-app-backend/src/casos-conflicto/dto/create-historico-conflicto.dto.ts>)
- [caso-historico.dto.ts](<C:/Users/anner/Desktop/UMG/10MO SEMESTRE/SEMINARIO/PROYECTO/casos-app-backend/src/common/historicos/caso-historico.dto.ts>)
- [caso-historico.service.ts](<C:/Users/anner/Desktop/UMG/10MO SEMESTRE/SEMINARIO/PROYECTO/casos-app-backend/src/common/historicos/caso-historico.service.ts>)
- [casos-historicos.spec.ts](<C:/Users/anner/Desktop/UMG/10MO SEMESTRE/SEMINARIO/PROYECTO/casos-app-backend/src/common/historicos/casos-historicos.spec.ts>)
- [package.json](<C:/Users/anner/Desktop/UMG/10MO SEMESTRE/SEMINARIO/PROYECTO/casos-app-backend/package.json>)

Este documento también se agregó como entrega. Los cambios locales preexistentes en otros módulos, CSS, schemas y archivos de Mongo se conservaron.

## Verificación

- Frontend: 41 pruebas de históricos aprobadas en Chrome Headless. Cubren los tres tipos, controles normales, PDF COMPLETO/PARCIAL, envío multipart, metadatos, cambio dinámico y ausencia de PDF en NO_LOCALIZADO.
- Backend: 113 pruebas aprobadas; transporte HTTP real con Nest/Multer/ValidationPipe, validación PDF real, DTO anidados, persistencia simulada, ausencia de PDF, duplicados, creación normal y separación con seguimientos. Drive y Mongo se sustituyen en las pruebas; no se realizaron cargas a una cuenta real.
- Backend: npm run build aprobado.
- Frontend desarrollo: npm run build -- --configuration development aprobado.
- Frontend producción: npm run build falla únicamente por los presupuestos CSS existentes de seguimiento-maltrato (9.77 kB), seguimiento-alerta (9.32 kB) y seguimiento-conflicto (9.71 kB), frente a un máximo de 8.19 kB. No se modificaron esos CSS ni el presupuesto. La primera ejecución también encontró bloqueo de Google Fonts en el aislamiento; el reintento con acceso completó la descarga.

Comandos, desde cada proyecto:

Frontend:

```powershell
npm.cmd test -- --watch=false --karma-config karma.historicos.conf.cjs --include src/app/casos/historicos/historicos.spec.ts
npm.cmd run build -- --configuration development
npm.cmd run build
```

Backend:

```powershell
npm.cmd run test:historicos -- --silent
npm.cmd run build
```

El script test:historicos habilita los módulos VM que necesita Jest para ejecutar el import dinámico de file-type del validador Nest instalado. No se desactiva ni se simula esa validación.

## Pruebas manuales con almacenamiento real pendientes

Usar un entorno de pruebas, un usuario autorizado y números de caso nuevos:

1. Maltrato COMPLETO: adjuntar PDF, guardar, cerrar incorporación, consultar nuevamente y abrir el documento con el botón habitual.
2. Maltrato PARCIAL: repetir la carga y guardado.
3. Maltrato NO_LOCALIZADO: comprobar que no existe selector y permite guardar sin PDF.
4. Conflicto COMPLETO: cargar, guardar, consultar y abrir PDF.
5. Conflicto PARCIAL: cargar y guardar PDF.
6. Conflicto NO_LOCALIZADO: selector ausente y guardado sin PDF.
7. Alerta COMPLETO: cargar y abrir posteriormente con la presentación normal.
8. Alerta PARCIAL: cargar y guardar PDF.
9. Alerta NO_LOCALIZADO: selector ausente y guardado sin PDF.
10. Seleccionar PDF en COMPLETO y cambiar a NO_LOCALIZADO: se borra el nombre y no sale file en la petición; volver a PARCIAL muestra selector vacío.
11. Incorporar un caso con expediente.pdf y crear después seguimiento con lineamiento.pdf: comprobar que ambos abren y que fileUrls y seguimientos[].archivos contienen sus enlaces respectivos.
12. Abrir un caso normal anterior y un histórico anterior sin PDF: el primero conserva su enlace; el segundo abre sin exigirlo.

La subida efectiva y apertura de archivos en Google Drive requieren esta comprobación con el almacenamiento real; las pruebas automatizadas no acreditan conectividad ni permisos de esa cuenta.
