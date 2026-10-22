# Preparación de documentos dentro del caso asignado

El investigador abre **Mis registros → Casos asignados → Registrar caso** y
guarda los datos antes de usar **Preparar documentos → Carátula, plan y rúbrica**.
La pantalla recibe tipo e ID del caso; el backend comprueba la asignación y
precarga DEIC, MP, personas, edades conocidas y ubicación. Para varias personas
se incluyen todos los nombres, separados por punto y coma. La edad se calcula
a la fecha de ingreso solo si constan nacimiento e ingreso; no se inventan datos.

La documentación mantiene el mismo DEIC y se vincula por `casoId`. Al regresar
se recupera el borrador existente; la precarga nunca reemplaza sus correcciones.
No se permite cambiar el DEIC vinculado. Los accesos por el módulo general
también comprueban el caso cuando ya existe, incluso si el cliente omite su ID.
Se conservan los documentos independientes anteriores.

## Borrador e impresión

Se puede guardar una carátula con MP o lugar pendientes, el plan parcial y la
rúbrica sin todas las respuestas. Las observaciones de un ítem pendiente se
conservan sin inventar una respuesta. Maltrato exige elegir OFICIO o
REQUERIMIENTO para cargar su rúbrica. Cambiar la modalidad limpia las respuestas
de la plantilla anterior.

**Descargar PDF para imprimir** utiliza solamente datos guardados. Antes de
generarlo se comprueban nombre, lugar, MP, número de alerta cuando corresponde,
contenido en cada elemento del plan y todas las respuestas de la rúbrica.
No se impone responder Sí; No es una respuesta válida. Las observaciones y la
edad desconocida pueden permanecer sin indicar.

El PDF conserva los diez formatos originales entregados por el usuario. La
salida reúne las tres páginas correspondientes al caso: carátula, plan y
rúbrica. Se mantienen sus medidas particulares, tipografía, logos, marcas de
agua, colores, rótulos, líneas y espacios de firma. No se añaden numeración,
títulos, pies ni cambios de orientación. Los datos se escriben exclusivamente
en las áreas destinadas a completarse.

Los campos del nombre del mando, la dependencia supervisada y el supervisor se
guardan por separado; no se confunde al investigador con el mando o supervisor.
Las firmas se mantienen en blanco para realizarlas físicamente. Los datos y
las marcas X de los expedientes usados como ejemplo se eliminaron de las bases,
incluidas sus anotaciones y metadatos. No se reutilizan en otros casos.

La generación no reduce automáticamente las letras, corta texto ni agrega
páginas. Si un dato excede su espacio, devuelve un error que identifica el
campo para abreviarlo. No se alteran los formatos para acomodar textos largos.

Las bases vectoriales y las fuentes están en `assets/formatos`; el manifiesto
registra los SHA-256 y el mapa de campos. Nest copia estos recursos a `dist`.
El servidor no necesita Word, Python, acceso a los originales ni Google Drive
para descargar. Los tres documentos se generan a partir de una misma lectura
del borrador, evitando mezclar revisiones durante la impresión.

## Entrega y revisión

Generar o descargar el PDF **no cambia el estado del caso ni lo envía al
analista**. El investigador imprime, obtiene las firmas correspondientes,
incorpora los documentos al expediente físico y vuelve al caso. Desde
**Entrega del expediente para revisión** adjunta un único PDF escaneado con
carátula, rúbrica, plan, informe y anexos, y usa el envío existente.

El envío conserva sus validaciones actuales; no inspecciona el contenido de
las páginas escaneadas ni pretende acreditar firmas físicas. No se introduce
un bloqueo adicional basado en haber descargado un archivo.

Mientras el caso está en revisión o aprobado, la documentación vinculada es
de consulta e impresión. El backend impide editarla o eliminarla aunque se
intente acceder por otra URL. Un rechazo del expediente vuelve a permitir
correcciones. No se crean nuevos estados de investigación ni revisiones
paralelas de estos borradores.

## Rutas

- `GET /documentacion-inicial/para-caso/:tipo/:casoId`: contexto y borrador,
  únicamente investigador asignado. No escribe al abrir la pantalla.
- `POST /documentacion-inicial`: creación; admite `casoId` y verifica su DEIC.
- `PATCH /documentacion-inicial/:id/caratula`: admite vincular un borrador
  anterior del mismo caso e investigador.
- Rutas de plan y rúbrica existentes: guardan avances y recuperan la plantilla.
- `GET /documentacion-inicial/:id/pdf`: descarga privada sin caché.

La interfaz restringe esta pantalla a Investigador. El permiso de consulta
siempre se valida también en el backend.

## Verificación

Se incluyen pruebas de servicios, autorización, precarga, recuperación,
borradores parciales, bloqueo tras entrega y reapertura tras rechazo. Se
generan PDF reales para Alerta, Conflicto y ambas modalidades de Maltrato,
comprobando el número y las medidas exactas de las páginas, integridad de las
bases y rechazo de textos que no caben. La revisión visual se hace con datos
ficticios. La comparación de las diez bases con sus referencias comprueba
igualdad de píxeles fuera de las áreas de datos y que los originales conservan
sus SHA-256. También se comprueba que las salidas llenas no cambian fuera de los
campos editables.
Las pruebas usan almacenamiento simulado; no incorporan casos a MongoDB ni
suben documentos a Drive.

Frontend y backend deben ejecutarse juntos para utilizar las rutas nuevas.

## Preparación de los originales

Los seis DOCX se exportaron con Microsoft Word en modo de solo lectura, sin
guardar cambios en los documentos originales. Las cuatro rúbricas PDF se
usaron directamente. La auditoría local conserva medidas, fuentes, partes
OOXML, SHA-256 y mapas de campos. Las referencias llenas permanecen fuera de
los recursos publicados del servidor.

`scripts/preparar-formatos.py --auditoria <carpeta-local>` usa PyMuPDF únicamente
durante la preparación: redacta texto de ejemplo preservando imágenes y líneas,
elimina anotaciones, adjuntos, enlaces y metadatos, y genera las bases limpias.
La auditoría requiere `inventario.json`, `geometria.json`, `codigos.json` y las
exportaciones PDF de Word. No es una dependencia del backend en ejecución.
