# Alerta: apertura, asignación, entrega y Excel

## Flujo

La pantalla de registro normal de Alerta permite al analista abrir un caso sin documentos. Exige DEIC, nombre de la persona, fecha real de ingreso y un investigador activo. MP y número de alerta son opcionales en la apertura, con formato validado cuando se conocen. El resto se registra según el requerimiento. La fecha de ingreso es independiente de `createdAt`.

El investigador encuentra su asignación en **Mis registros → Casos asignados → Registrar caso**. El botón abre el formulario con los datos del analista precargados y actualiza el mismo caso; no genera otro DEIC ni duplica el registro. El filtro **Pendientes de revisión** muestra las entregas ya enviadas y excluye las asignaciones aún sin entregar. También existe acceso desde **Registrar caso → Alerta**. Puede completar datos, guardar avances, preparar plan/carátula e informe con el mismo DEIC usando los módulos existentes y enviar un PDF completo. Para entregar debe tener MP, número de alerta, estado de investigación, departamento/municipio/dirección y fecha de nacimiento obligatoria para el investigador. La edad reportada representa la edad al recibir el caso; no se inventa nacimiento. Otros datos desconocidos pueden quedar vacíos.

El analista revisa la entrega en **Registros pendientes**. Ve la ficha adicional, aprueba o rechaza con motivo. El investigador puede corregir datos y enviar otro PDF después del rechazo. Se preservan archivos anteriores, historial, analista registrador y asignación original. Durante la revisión y después de aprobar se bloquea la edición del investigador.

No se agregan estados de investigación ni un estado de archivo físico. Se conservan Pendiente/Aprobado/Rechazado para revisión. `procesoAlerta` identifica el nuevo contrato y `expedienteEnPreparacion` evita enviar una apertura aún sin expediente a la bandeja de aprobación; no se usa como estado de investigación. Los casos previos y los históricos mantienen sus rutas y lectura. Las reglas de seguimiento y cierre no cambian.

## Rutas

- `POST /alertas/registro-inicial`: JSON, solo analista. `crear-alerta` queda como alias del nuevo contrato, sin PDF; el contrato anterior de creación normal fue sustituido.
- `GET /alertas/gestion`: analista ve los casos del nuevo flujo; investigador solo sus asignaciones.
- `GET /alertas/gestion/:id`: analista o investigador asignado.
- `PATCH /alertas/gestion/:id`: JSON, solo investigador asignado; preparación o rechazo. No admite cambiar DEIC, asignación, analista ni estado de aprobación.
- `POST /alertas/gestion/:id/entregar`: multipart, `file` PDF obligatorio, validación MIME/firma existente.
- Rutas de aprobación y rechazo existentes: solo analista; no se permite revisar una apertura aún en preparación.
- `GET /alertas/exportar-excel`: descarga XLSX, solo analista.

La auditoría procede de la sesión. Los identificadores asignados se comprueban contra usuarios Investigador activos. La edición preserva las observaciones del analista. Mongoose usa control optimista de versión para evitar que una escritura antigua sobrescriba una entrega/revisión concurrente. Una colisión devuelve 409. Una subida concurrente rechazada puede dejar un documento en Drive sin asociación; no se introduce eliminación automática de archivos.

## Excel

El botón **Exportar base Excel** está en la pantalla de Alerta del analista. Exporta todos los registros de Alerta visibles para este rol, incluidos pendientes/rechazados, casos previos e históricos, sin mezclar Maltrato/Conflicto.

- `DESAPARECIDOS`: las 73 columnas de datos de la referencia, en su mismo orden.
- `LOCALIZADOS`: las 28 columnas con encabezados de la referencia, para registros con fecha de localización. También reconoce la localización registrada en seguimientos.
- Encabezados, filtros, filas/columnas fijas, anchos y fechas Excel. No reproduce las hojas auxiliares de catálogos o estadísticas del archivo original.
- Mantiene ceros reales y deja datos desconocidos vacíos. No confunde al analista registrador con el investigador original/asignado.
- Día, mes, año, mayoría/minoría, rango de edad y plazos se calculan con los datos disponibles. El plazo en días de entrega equivale a entrega menos ingreso, como la fórmula de la referencia. El plazo horario de localización solo se calcula si constan ambas fechas y horas.
- No importa expedientes ni datos personales del Excel de referencia. La aplicación solo incorpora sus encabezados y estructura; el archivo original no es necesario en ejecución.

Los campos propios de la base se guardan en `fichaAlerta`, con esquema y DTO explícitos: recepción, demografía, desaparición, localización, informe y diligencias. Los datos existentes de persona, dirección, denunciante y localización se reutilizan.

## Preparación de índices en una base existente

Un mismo MP puede corresponder a varias alertas/personas. El índice MP de Alerta deja de ser único; DEIC y número de alerta conocido siguen siendo únicos. También se necesitan índices parciales para permitir varias alertas sin número de alerta al abrir.

**No se han modificado índices ni documentos de MongoDB en esta implementación.** Antes de arrancar el backend actualizado contra una base existente, compilar y ejecutar la inspección:

```powershell
node node_modules/typescript/bin/tsc --project tsconfig.build.json --pretty false
node scripts/indices-historicos.cjs --solo-alerta
```

Configurar `MONGO_URI` para la base elegida. Para aplicar, detener las escrituras y el backend durante la ventana de mantenimiento:

```powershell
node scripts/indices-historicos.cjs --solo-alerta --apply --maintenance
node scripts/indices-historicos.cjs --solo-alerta
```

El script no modifica documentos, no aplica `syncIndexes()` y verifica duplicados de identificadores únicos antes de cambiar índices. La opción `--solo-alerta` evita modificar índices de Maltrato o Conflicto. Cambiar el schema no reemplaza un índice ya existente automáticamente.

## Comprobaciones

Pruebas de servicios con documentos y validación Mongoose reales; almacenamiento, usuarios y Drive simulados. Excel generado y reabierto con ExcelJS para comprobar encabezados, fechas, ceros, responsables, MP compartido, localizaciones y texto que comienza con `=`. Pruebas Angular en Chrome de escritorio y móvil para apertura, asignaciones, edición, errores, entrega y rechazo.

```powershell
# Backend
node --experimental-vm-modules node_modules/jest/bin/jest.js --config test/jest-alerta-gestion.json --runInBand
node --experimental-vm-modules node_modules/jest/bin/jest.js --config test/jest-historicos.json --runInBand
node --experimental-vm-modules node_modules/jest/bin/jest.js --config test/jest-seguimientos.json --runInBand
# Frontend
node node_modules/@angular/cli/bin/ng.js build --configuration development
node node_modules/@angular/cli/bin/ng.js test --watch=false --karma-config=karma.historicos.conf.cjs --include=src/app/casos/alerta-gestion/alerta-gestion.component.spec.ts --browsers=HistoricosDesktop,HistoricosMobile
```

No se ha desplegado ni probado la entrega contra MongoDB/Drive reales. La compilación comprobada es de desarrollo; no implica validación de los presupuestos de producción anteriores.

