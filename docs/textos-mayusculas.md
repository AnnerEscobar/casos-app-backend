# Textos en mayúsculas y presentación original

Los textos descriptivos de nuevos registros y de expedientes que se guardan
después de una edición se persisten en mayúsculas. Se conservan tildes y ñ:
`María López` se almacena como `MARÍA LÓPEZ`.

El campo auxiliar `_presentacionTextos` conserva la escritura recibida por el
backend. Permite volver a mostrar `María López` sin intentar reconstruir un
nombre a partir de mayúsculas. No cambia el formato que ya aplique un formulario
antes de enviar sus datos. No se transforma automáticamente a título ni se
eliminan acentos.

## Cobertura

El plugin compartido `src/common/textos-mayusculas.ts` se instala en los modelos
de Alerta, Maltrato, Conflicto, usuarios, carátulas, documentación
inicial y solicitudes de acceso. Cubre sus objetos anidados, personas, fichas,
históricos, revisiones y seguimientos. Las escrituras actuales de la aplicación
usan `save`/`create` o actualizaciones `$set`/`$setOnInsert`; estas últimas
normalizan texto y guardan su presentación en la misma operación.

Se exceptúan credenciales, correos, tokens, enlaces y rutas de archivos,
identificadores, fechas, horas, coordenadas, códigos, roles, estados y enums.
Estos valores son contratos técnicos; por ejemplo, `Pendiente`, `Informado` y
`Remitido` siguen conservando la lógica de revisión y cierre existente.
Los números, ceros, booleanos, fechas BSON y referencias ObjectId mantienen sus
tipos. Los nombres de propiedades y colecciones no cambian.

## Lecturas y registros anteriores

Las respuestas con documentos Mongoose, `toJSON`, `toObject`, consultas `lean`
y referencias pobladas mantienen la presentación original. La información
auxiliar se elimina al serializar y no reconstruye campos excluidos por una
proyección. No hace falta modificar componentes ni usar CSS para simular el
resultado.

Leer un registro anterior no escribe nada. No hay migración masiva ni cambios
de índices. Cuando se guarda una edición, se normalizan los textos descriptivos
del documento leído y se conserva su presentación. Un registro que no se edita
continúa con sus valores actuales.

Las consultas directas a MongoDB ven los campos principales en mayúsculas y el
campo auxiliar. Un escritor externo que utilice el driver sin los modelos no
ejecuta esta política. Las agregaciones de MongoDB operan sobre los valores
persistidos; los conteos existentes no requieren cambios. Las exportaciones
actuales pasan por la lectura de la aplicación y conservan su presentación.

## Verificación

```powershell
node node_modules/typescript/bin/tsc --project tsconfig.build.json --pretty false
node node_modules/jest/bin/jest.js --config test/jest-textos.json --runInBand --cacheDirectory .cache/jest-textos
```

Las pruebas ejecutan los hooks y la serialización real de Mongoose y capturan
la operación enviada al driver. Cubren relectura, `lean`, proyecciones,
ediciones, errores al guardar, cambios de personas, arrays y actualizaciones
atómicas. Incluyen los siete esquemas reales y regresiones de gestión,
históricos, seguimiento, usuarios y búsquedas. Los métodos del driver se
sustituyen en las pruebas; no se modifican expedientes de una base real.
