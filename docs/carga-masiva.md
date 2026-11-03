# Carga masiva de bases Excel

El botón **Carga masiva** aparece para el Analista en las pantallas de registro de Alerta, Maltrato y Conflicto. Abre un diálogo compartido; no agrega un módulo ni una entrada de menú. Las tres rutas `POST /{alertas|maltratos|conflictos}/carga-masiva` exigen sesión y rol Analista, y el servicio vuelve a comprobar ese rol.

## Uso

1. Seleccionar XLSX, CSV UTF-8 o TXT/TSV tabulado con los encabezados de la base. No se requiere convertir Excel a texto. Máximo 5 MB, 5,000 filas, 250 columnas y 10,000 caracteres por celda. XLS y libros protegidos deben convertirse a XLSX.
2. Elegir la hoja compatible. Los catálogos y tablas dinámicas sin DEIC no se ofrecen. La cabecera debe estar entre las primeras 30 filas. Si el libro contiene tanto una copia como la base principal, elegir la base que se desea incorporar.
3. Indicar disponibilidad documental: parcial o expediente no localizado. Un registro de Excel no acredita un expediente completo ni adjunta un PDF.
4. Revisar filas de origen, casos agrupados, personas, investigador original, errores y existentes. Confirmar explícitamente la importación de los casos válidos. Los casos con errores se omiten completos.
5. Descargar el resultado CSV y corregir en el archivo original los casos rechazados. Se puede reintentar: los casos existentes se omiten y no se actualizan.

## Datos y duplicados

- Maltrato agrupa por DEIC normalizado; cada fila aporta una víctima. Un mismo DEIC produce **un caso con un arreglo de víctimas**. Las personas con exactamente los mismos datos se deduplican. Los sindicados se reúnen también. Conflicto conserva los dos bloques de infractores y admite varias filas por DEIC. No se suman diligencias repetidas.
- Los datos generales no vacíos del mismo caso deben coincidir. Si difieren MP, fechas, investigador original, lugar, reseña, estado, cantidades u otros datos generales, se bloquea ese caso y se indican los campos. No se elige una fila arbitrariamente. Los valores vacíos se completan con los conocidos de otra fila.
- Las hojas DESAPARECIDOS y LOCALIZADOS se cargan por separado. Cada carga incorpora casos nuevos; **no fusiona ni actualiza casos que ya existan**, incluso cuando provienen de otra hoja del mismo libro. Revisar la hoja adecuada antes de confirmar. Los DEIC repetidos dentro de una hoja de Alerta se marcan para revisión.
- Se usan los validadores actuales de DEIC/MP/alerta y los schemas históricos; no se inventan fechas de nacimiento a partir de edades ni nombres, estados o números ausentes. Fechas de texto: dd/mm/aaaa o aaaa-mm-dd. Se reconocen fechas/horas de Excel y su calendario 1904. Los errores de una fórmula en columnas calculadas no bloquean el libro; un error en un campo importado bloquea el caso correspondiente. No se ejecutan fórmulas, macros ni instrucciones del documento.
- Los casos se incorporan como HISTORICO / REGISTRO_EXCEL, con fecha de incorporación y registrador de sesión. El investigador de la base se conserva por nombre como investigador original, sin asignarlo a una cuenta actual. Como en el flujo histórico existente, el Analista los incorpora aprobados; se consultan mediante la búsqueda habitual de casos, no como expedientes nuevos en preparación.
- La evidencia `importacionOrigen` conserva archivo, hoja, SHA-256 y celdas originales por fila, incluidas las columnas sin correspondencia. Tiene `select:false`, no aparece en consultas habituales y no se normaliza a mayúsculas. La observación histórica visible solo muestra procedencia y filas. No se escriben archivos subidos al disco ni se envían a Drive.

## API y concurrencia

Multipart: `file`, `accion` (`vista-previa` o `importar`), `estadoExpedienteHistorico`, `hoja` opcional para enumerar hojas, `huella` obligatoria al confirmar. La huella vincula archivo y opciones. El servidor vuelve a leer, validar y comprobar duplicados al confirmar; no confía en los objetos de la vista previa enviados por el cliente.

Hay un bloqueo por tipo en cada proceso mientras se confirma. Los índices únicos existentes de DEIC cubren peticiones concurrentes y otros procesos. Mantener los índices históricos preparados según `docs/casos-historicos.md` y el script existente `scripts/indices-historicos.cjs`. Esta función no altera índices ni realiza migraciones. No equivale a una transacción del lote: cada caso se guarda individualmente. Ante una desconexión puede haberse guardado parte del lote; volver a revisar el mismo archivo identifica los existentes. Los errores de un caso no detienen los demás y nunca sobrescriben datos existentes.

## Verificación

Backend: `node node_modules/jest/bin/jest.js --config test/jest-importacion.json --runInBand`. Prueba roles, múltiples víctimas, duplicados, contradicciones, fechas, CSV, campos reordenados, correspondencia con exportadores, evidencia, auditoría y reintentos. Si los tres archivos originales están disponibles en sus rutas locales, también los previsualiza sin persistencia ni datos personales en los logs. Persistencia simulada; no modifica MongoDB ni Drive.

Frontend: prueba dirigida `carga-masiva.component.spec.ts`, compilación Angular y pruebas de las tres pantallas de gestión. Backend: compilación TypeScript y pruebas históricas existentes.
