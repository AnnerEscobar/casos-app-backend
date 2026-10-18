# Registro, asignación y exportación de maltrato

## Flujo

1. El analista entra en **Registrar caso → Maltrato**, registra DEIC, fecha de recepción, investigador activo y al menos una víctima con nombre. Puede dejar MP, estado, nacimiento, edad, CUI, dirección y datos del hecho pendientes. No adjunta archivos.
2. El investigador entra en **Mis registros → Casos asignados → Registrar caso**. Abre el mismo expediente con los datos del analista precargados. Puede agregar víctimas y sindicados y guardar avances.
3. Para **Registrar y enviar a revisión**, completa MP, estado de investigación, departamento, municipio y dirección del hecho; cada víctima debe tener nombre y fecha de nacimiento o edad conocida. Adjunta el PDF completo. El CUI y los datos aún desconocidos no se inventan; el sindicado puede seguir sin identificar.
4. El analista recibe únicamente las entregas, consulta los datos del requerimiento y decide aprobar o rechazar. El investigador asignado corrige los rechazados y reenvía. Se conservan los PDFs y el historial de revisión.

Los estados de investigación existentes siguen siendo **Informado** y **Desestimado**. La preparación del expediente usa un indicador independiente y no crea otro estado de investigación ni un estado de archivado. Los seguimientos conservan su flujo y pueden tener otro investigador asignado. “Turno / FNNA” es un dato del expediente, no una asignación automática de turnos.

## Campos de la base

La referencia es `15. MALTRATO 2026.xlsx`, hoja `MALTRATO 2026`, columnas A:BD (56 columnas). La app registra procedencia, tipo y fechas del documento, unidad, investigador, víctimas, denunciantes, parentescos, sindicados, ubicación del hecho, reseña, móvil, modus operandi, circunstancias, informe al MP, clasificación y diligencias. Los departamentos y municipios reutilizan el catálogo geográfico ya verificado para alertas.

Cada víctima tiene su denunciante y parentesco. Los sindicados se conservan en la propiedad histórica `infractores` y se presentan como **sindicados**. Su campo de parentesco puede describir el vínculo con las víctimas, incluyendo diferencias cuando corresponda. La fecha de nacimiento puede usarse para calcular la edad a la fecha de recepción, pero una edad reportada no se convierte en una fecha de nacimiento supuesta.

Los desplegables de procedencia, tipo de documento, unidad, sexo, etnia, nacionalidad, clasificación y Turno/FNNA usan etiquetas de la referencia. No se copian nombres de personas al código. Se omiten errores de escritura `TORNO` y `TUENO` del catálogo de atención y se conserva `TURNO`; los valores anteriores fuera del catálogo siguen mostrándose al editar.

## Excel

El analista usa **Exportar base Excel**. Se exporta la hoja principal con los 56 encabezados originales, en el mismo orden, incluyendo sus nombres originales. No se copian las hojas auxiliares de estadísticas ni el subconjunto de Hoja1. El archivo de referencia permanece intacto y no se importan sus expedientes a MongoDB.

- Un caso con varias víctimas produce una fila por víctima y repite el DEIC y MP del mismo caso. No crea casos duplicados en la aplicación.
- Los sindicados se incluyen con saltos de línea y se mantiene su orden entre nombre, dirección y parentesco. Los datos faltantes de un sindicado se muestran como “Sin indicar”.
- Las diligencias y el plazo de entrega son del caso: solo la primera fila de sus víctimas contiene esas cantidades, para que sumar las columnas no duplique resultados.
- Las fechas se exportan como fechas de Excel, las cantidades como números y los identificadores como texto. Los ceros se conservan y lo desconocido queda vacío.
- El plazo se calcula entre recepción y entrega a análisis solo cuando ambas fechas existen y están ordenadas. Se evitan los plazos negativos que produce la referencia al restar una fecha de una celda vacía.
- Los textos que empiezan por `=` permanecen como texto. La edad se calcula a la recepción si hay nacimiento y fecha de recepción; en otro caso se conserva la edad reportada.
- La exportación incluye registros anteriores, sin completar datos que nunca se registraron.

## API

- `POST /maltratos/registro-inicial`: analista, JSON sin archivo.
- `POST /maltratos/crear-maltrato`: alias de apertura inicial; rechaza archivo.
- `GET /maltratos/gestion`: analista ve los nuevos casos; investigador solo los asignados a él.
- `GET /maltratos/gestion/:id`: detalle para analista o investigador asignado.
- `PATCH /maltratos/gestion/:id`: avance o corrección del investigador asignado.
- `POST /maltratos/gestion/:id/entregar`: PDF completo del investigador asignado.
- `GET /maltratos/exportar-excel`: exportación solo para analista.

Se reutilizan los endpoints de aprobación, rechazo y Mis registros. El reenvío anterior delega al flujo nuevo para los casos que tienen `procesoMaltrato: true`. La ruta de históricos sigue usando su DTO y operación originales. Los campos y validadores de los registros anteriores se conservan; la flexibilidad inicial se aplica solo al nuevo proceso.

No hace falta migrar expedientes ni quitar índices para este cambio. El índice único DEIC existente permanece. El nuevo frontend y backend deben ejecutarse juntos; si el navegador solicita un chunk anterior que devuelve 404, recargar con **Ctrl + Shift + R**.

## Verificación

`node node_modules/jest/bin/jest.js --config test/jest-maltrato-gestion.json --runInBand`

Prueba apertura con null, roles, responsable activo, avances, entrega completa, rechazo/reenvío/aprobación, conservación de PDFs, consultas, encabezados, varias víctimas, MP compartido, ceros, fechas, plazos y texto literal en Excel. También se comprueban los componentes de maltrato y Mis registros y la navegación real desde el selector en Chrome Headless.
