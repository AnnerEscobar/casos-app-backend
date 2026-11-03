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
- Los casos se incorporan como HISTORICO / REGISTRO_EXCEL, con fecha de incorporación y registrador de sesión. El investigador de la base se conserva como investigador original. Se puede vincular su usuario o crear su cuenta según el apartado siguiente; no se establece `investigadorAsignado`. Como en el flujo histórico existente, el Analista los incorpora aprobados; se consultan mediante la búsqueda habitual de casos, no como expedientes nuevos en preparación.
- La evidencia `importacionOrigen` conserva archivo, hoja, SHA-256 y celdas originales por fila, incluidas las columnas sin correspondencia. Tiene `select:false`, no aparece en consultas habituales y no se normaliza a mayúsculas. La observación histórica visible solo muestra procedencia y filas. No se escriben archivos subidos al disco ni se envían a Drive.

## API y concurrencia

Multipart: `file`, `accion` (`vista-previa` o `importar`), `estadoExpedienteHistorico`, `hoja` opcional para enumerar hojas, `huella` obligatoria al confirmar. Opcionales: `crearInvestigadores` (`si`/`no`) y `cuentasPropuestas` (JSON de nombre normalizado a identificador de acceso corregido). La huella vincula archivo, opciones y cuentas propuestas. El servidor vuelve a leer, validar y comprobar duplicados al confirmar; no confía en los objetos de la vista previa enviados por el cliente.

Hay un bloqueo por tipo en cada proceso mientras se confirma. Los índices únicos existentes de DEIC cubren peticiones concurrentes y otros procesos. Mantener los índices históricos preparados según `docs/casos-historicos.md` y el script existente `scripts/indices-historicos.cjs`. Esta función no altera índices ni realiza migraciones. No equivale a una transacción del lote: cada caso se guarda individualmente. Ante una desconexión puede haberse guardado parte del lote; volver a revisar el mismo archivo identifica los existentes. Los errores de un caso no detienen los demás y nunca sobrescriben datos existentes.

## Verificación

Backend: `node --experimental-vm-modules node_modules/jest/bin/jest.js --config test/jest-importacion.json --runInBand`. Prueba roles, múltiples víctimas, duplicados, contradicciones, fechas, CSV, campos reordenados, correspondencia con exportadores, evidencia, auditoría, reintentos, cuentas y cambio obligatorio de contraseña. Si los tres archivos originales están disponibles en sus rutas locales, también los previsualiza sin persistencia ni datos personales en los logs. Persistencia simulada; no modifica MongoDB ni Drive.

Frontend: prueba dirigida `carga-masiva.component.spec.ts`, compilación Angular y pruebas de las tres pantallas de gestión. Backend: compilación TypeScript y pruebas históricas existentes.

## Cuentas de investigadores

El Analista dispone de la opción **Vincular investigadores existentes y crear las cuentas que falten**, activada inicialmente en el diálogo. Desactivarla conserva el flujo anterior de nombres sin cuentas. Los clientes API anteriores que omitan la opción mantienen también ese flujo.

- La vista previa no crea usuarios. Compara nombres completos sin distinguir tildes, mayúsculas o espacios repetidos. Una coincidencia única, activa y con rol Investigador se reutiliza; no se cambia su contraseña. Las cuentas inactivas, otros roles y los homónimos se señalan para revisión. No se hace coincidencia aproximada ni por primer nombre/apellido solamente.
- Si falta una cuenta, propone `nombre.apellido`: `Anner Escobar` → `anner.escobar`. Para nombres de tres o más palabras toma la penúltima como primer apellido; los nombres compuestos y apellidos con partículas requieren revisión del Analista. El identificador propuesto se puede editar antes de volver a revisar. Las colisiones añaden un consecutivo (`anner.escobar2`) sin fusionar personas.
- El identificador se guarda en el campo existente `email`, que funciona como identificador de inicio de sesión. No se fabrica una dirección de correo. Los usuarios anteriores conservan sus correos y pueden seguir iniciando sesión con ellos. El formulario admite **Usuario o correo electrónico**. El registro administrativo habitual sigue exigiendo un correo válido.
- La contraseña inicial sigue el patrón solicitado: primera parte del identificador + `2026`, por ejemplo `anner2026`. Solo se guarda un hash bcrypt. No se muestra ni se exporta la contraseña; el listado descargable contiene nombres, identificadores, estados y errores. Este patrón se usa únicamente al crear la cuenta y nunca para restablecer una existente.
- Se fija `debeCambiarPassword=true`. Después de iniciar sesión, el frontend redirige al cambio de contraseña y la estrategia JWT bloquea la API de negocio hasta completar el cambio. Solo admite consultar sesión, renovar actividad, cerrar sesión o cambiar contraseña. La nueva contraseña debe tener al menos ocho caracteres y ser diferente de la actual; el cambio elimina la obligación. Las cuentas anteriores no quedan afectadas.
- Cada caso nuevo válido vincula `investigadorOriginal.usuarioId`. Se crea una cuenta como máximo una vez por nombre del lote; los casos con errores o ya existentes no provocan su creación. Máximo 500 investigadores diferentes por archivo cuando esta opción está activa. Las cuentas ya existentes pueden consultar sus históricos conforme a las reglas de acceso vigentes; esto no modifica asignaciones actuales.
- Las cuentas y los casos se guardan individualmente. Si una cuenta se crea y luego falla el guardado del caso, la cuenta permanece y se informa como creada; al reintentar se reutiliza, sin borrar cuentas ni reiniciar contraseñas. Un cambio concurrente de nombres, actividad o identificadores obliga a revisar nuevamente. Una colisión con otra persona nunca se reutiliza silenciosamente.
