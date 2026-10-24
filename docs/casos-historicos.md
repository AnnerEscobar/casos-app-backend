# Casos históricos — backend V3

Los tres módulos incorporan históricos en sus modelos y colecciones actuales. No se crea una colección adicional ni se necesita completar metadatos en documentos anteriores. Angular queda pendiente, sin cambios visuales.

## Decisiones y compatibilidad

- Se agregan rutas `POST /alertas/historico`, `/maltratos/historico` y `/conflictos/historico`, con JSON y sin PDF obligatorio. Separarlas conserva los DTOs, interceptores y requisitos del registro normal, que exige PDF.
- `registradoPor` ya existía en los casos. Se reutiliza con `req.user.userId`, obtenido por `JwtStrategy` del usuario autenticado. Nunca representa automáticamente al investigador original.
- Maltrato recibe `sindicados` y conserva `infractores` en MongoDB. Conflicto mantiene `infractores`. Alerta recibe `lugarDesaparicion` y conserva `direccion`; mantiene sus nombres de localización existentes.
- Los DTOs históricos permiten omitir datos desconocidos, incluidos campos dentro de personas y lugares. Los tipos de los datos proporcionados siguen validándose. `COMPLETO` describe la disponibilidad del expediente; tampoco obliga a inventar datos que el expediente no contenga.
- Los DTOs de creación normal no se flexibilizan. En Mongoose, los requisitos modificados solo se relajan con `origenCaso = HISTORICO`. La ausencia de origen se interpreta como `SISTEMA`. Las consultas con `lean()` o agregaciones no materializan defaults: sus consumidores deben interpretar también la ausencia como `SISTEMA`.
- Alerta conserva la posibilidad de guardar expedientes anteriores sin denunciante. No se añade ese requisito al schema.
- Se preservan JWT, roles y autorización de registros: Analista → `Aprobado`; Investigador → `Pendiente`. No se aprueban históricos automáticamente por el mero hecho de ser históricos.
- Los seguimientos siguen embebidos: su caso padre establece la relación. No se duplica `casoId` ni se agrega `investigadorActual` al caso.
- Se reutiliza `normalizeCaseNumber`/`normalizeMpNumber`, ampliando la limpieza de caracteres Unicode invisibles como U+200E. Las búsquedas por DEIC de cada módulo y sus seguimientos usan la misma normalización. No se reescriben identificadores ya almacenados; si existen datos antiguos contaminados, conviene auditarlos aparte antes de corregirlos.
- No se modifican las carátulas ni sus requisitos. Incorporar un histórico no fabrica una carátula ni evita que sus rutas exijan los datos documentales que necesitan. Las estadísticas por `createdAt` continúan contando incorporaciones al sistema, no el año de los hechos.
- Pendiente para la fase Angular: `actualizarCasosPorInvestigador` en `estadistics.component.ts` usa actualmente `registradoPor` para su gráfica. Al habilitar históricos en la interfaz, debe distinguir el investigador original del registrador usando los nuevos metadatos; no interpretar esa gráfica actual como atribución del trabajo original de los históricos. No se cambió esa pantalla en esta entrega de backend.

## Campos

| Campo del caso | Regla |
| --- | --- |
| `origenCaso` | `SISTEMA` por defecto; la ruta histórica lo fija en `HISTORICO`. |
| `estadoExpedienteHistorico` | Obligatorio en históricos: `COMPLETO`, `PARCIAL`, `NO_LOCALIZADO`. |
| `fechaIncorporacionSistema` | Fecha real generada por el backend al incorporar; no se rellena retroactivamente. |
| `registradoPor` | Campo existente, referencia `Usuario`, asignado desde JWT. |
| `investigadorOriginal.usuarioId` | Opcional, referencia a un usuario existente, aunque ya no esté activo. |
| `investigadorOriginal.nombre` | Opcional; permite identificar a quien nunca tuvo cuenta. No se guarda un nombre ficticio cuando falta. |
| `fuenteInformacionHistorica` | Opcional: `EXPEDIENTE_FISICO`, `COPIA_ANALISIS`, `REGISTRO_EXCEL`, `NUEVO_REQUERIMIENTO`, `OTRO`. |
| `observacionHistorica` | Texto opcional. |
| `anioCaso` | Entero opcional entre 1 y 9999; evita inventar una fecha exacta. |

Los seguimientos agregan `registradoPor` e `investigadorAsignado`, ambos referencias a `Usuario`. Los seguimientos antiguos pueden seguir sin ellos. Para un nuevo seguimiento histórico se exige un responsable: un investigador autenticado puede omitirlo para autoasignarse; un analista debe enviarlo. El asignado debe existir, tener rol Investigador y estar activo. Para casos normales, los clientes anteriores pueden seguir omitiendo la asignación; un analista no se convierte por defecto en investigador.

El investigador original puede tener solo nombre, solo usuario o ambos. Si se envía `usuarioId`, se verifica existencia; no se exige actividad actual. Si no se conoce, omitir la estructura o enviar `null`; la presentación de “No determinado” corresponde al frontend.

## Preparar los índices antes del despliegue

**Este ajuste no se ha ejecutado sobre la base de datos.** Es necesario en una base existente para admitir múltiples Alertas sin MP/número de alerta y garantizar unicidad de DEIC en Maltrato/Conflicto bajo concurrencia.

Alerta tenía índices únicos convencionales en `numeroMp` y `numeroAlerta`: MongoDB considera duplicados los valores ausentes dentro de esos índices. Ahora deben ser únicos parciales para valores string. Se conserva la unicidad de números conocidos; los datos desconocidos se omiten, sin números artificiales.

El script usa las colecciones derivadas de los modelos reales, no nombres inventados. Por defecto solo inspecciona. Revisa duplicados en todos los campos involucrados antes de cambiar índices y no modifica documentos. No utiliza `syncIndexes()` ni elimina índices ajenos. La comprobación de duplicados del service considera todos los estados de autorización. Un índice único resuelve la carrera entre peticiones simultáneas y el service histórico devuelve HTTP 409 para E11000.

Desde la carpeta del backend, con `MONGO_URI` apuntando a la base elegida:

```powershell
npm.cmd run build
node scripts/indices-historicos.cjs
```

Para aplicar durante una ventana sin escrituras (detener la aplicación antes de sustituir índices):

```powershell
node scripts/indices-historicos.cjs --apply --maintenance
```

Después, volver a ejecutar la inspección: debe mostrar cero ajustes pendientes. Si encuentra duplicados, se detiene sin resolverlos ni borrar documentos. La sustitución de índices no es una transacción: mantener las escrituras detenidas hasta verificar el resultado. El script intenta restaurar el índice anterior si falla su reemplazo. Desplegar el backend actualizado después de este paso; cambiar el schema no reemplaza índices ya existentes automáticamente.

## Requests: Postman / Thunder Client

Base de ejemplo: `http://localhost:3000`. Usar la sesión actual o `Authorization: Bearer <token>`. Para creación histórica: `Content-Type: application/json`.

También se incluye `docs/casos-historicos.postman_collection.json`. Configurar `baseUrl`, `token` e `investigadorId` (ID real de un investigador activo). Los nombres/números de esta guía son ejemplos de prueba.

### Alerta

`POST /alertas/historico`

```json
{
  "numeroDeic": "DEIC52-2016-05-18-421",
  "origenCaso": "HISTORICO",
  "estadoExpedienteHistorico": "NO_LOCALIZADO",
  "fuenteInformacionHistorica": "NUEVO_REQUERIMIENTO",
  "observacionHistorica": "Expediente original no localizado.",
  "anioCaso": 2016
}
```

No exige número MP, número de alerta, desaparecido, fecha de nacimiento, denunciante ni lugar de desaparición. Si se conocen MP/Alerta, sus formatos siguen siendo `M0030-AAAA-NNN` y `NNN-AAAA`.

Buscar, una vez aprobado: `GET /alertas/by-deic/DEIC52-2016-05-18-421`.

### Maltrato

`POST /maltratos/historico`

```json
{
  "numeroDeic": "DEIC51-2016-05-18-421",
  "origenCaso": "HISTORICO",
  "estadoExpedienteHistorico": "NO_LOCALIZADO",
  "fuenteInformacionHistorica": "NUEVO_REQUERIMIENTO",
  "observacionHistorica": "Expediente original no localizado."
}
```

Buscar, una vez aprobado: `GET /maltratos/buscar/DEIC51-2016-05-18-421`.

Ejemplo parcial alternativo, con un DEIC distinto:

```json
{
  "numeroDeic": "DEIC51-2018-04-12-422",
  "estadoExpedienteHistorico": "PARCIAL",
  "fuenteInformacionHistorica": "EXPEDIENTE_FISICO",
  "investigadorOriginal": { "nombre": "Juan Pérez" },
  "victimas": [{ "nombre": "Nombre conocido de la víctima" }],
  "sindicados": [{ "nombre": "Nombre conocido del sindicado" }],
  "lugarHechos": { "municipio": "Guatemala" }
}
```

### Conflicto

`POST /conflictos/historico`

```json
{
  "numeroDeic": "DEIC53-2016-05-18-421",
  "origenCaso": "HISTORICO",
  "estadoExpedienteHistorico": "NO_LOCALIZADO",
  "fuenteInformacionHistorica": "NUEVO_REQUERIMIENTO",
  "observacionHistorica": "Expediente original no localizado."
}
```

Buscar, una vez aprobado: `GET /conflictos/buscar/DEIC53-2016-05-18-421`. Los datos opcionales de personas usan `victimas` e `infractores`.

Se mantienen los identificadores históricos reconocidos por el normalizador: `AK000001`, `MT000001`, `AC000001`, en su módulo correspondiente. No se cambia el patrón de los DTOs de creación normal.

### Respuesta y continuación con seguimiento

La creación devuelve HTTP 201 con el documento del módulo, `_id`, `numeroDeic`, metadatos históricos, `registradoPor`, fecha de incorporación, `estadoRegistro` y arreglos de archivos/seguimientos. No se deben enviar `registradoPor`, `fechaIncorporacionSistema`, `estadoRegistro`, `fileUrls` ni `seguimientos` en el request de incorporación: el ValidationPipe los rechaza.

Conservar el `numeroDeic` devuelto para llamar inmediatamente a la ruta de seguimiento. El flujo de búsqueda existente muestra solo aprobados: si incorporó un investigador, el caso seguirá pendiente hasta la aprobación por Analista. El frontend futuro puede continuar directamente con el número devuelto sin volver a buscarlo en el listado de aprobados. Se mantiene el comportamiento actual de las rutas de seguimiento respecto al estado del caso.

Para registrar como María (Analista) y asignar a Pedro, usar el token de María y el `_id` de Pedro en `investigadorAsignado`. El nombre del investigador original no cambia.

| Ruta PATCH | Body | Archivo |
| --- | --- | --- |
| `/alertas/seguimiento/DEIC52-2016-05-18-421` | `nuevoEstado`, `investigadorAsignado`; campos de localización existentes opcionales | `files` opcional (multipart si hay archivos). |
| `/maltratos/seguimiento/DEIC51-2016-05-18-421` | `estadoInvestigacion`, `investigadorAsignado` | `file` PDF obligatorio, igual que antes. |
| `/conflictos/seguimiento/DEIC53-2016-05-18-421` | `estadoInvestigacion`, `investigadorAsignado` | `file` opcional, igual que antes. |

Ejemplo JSON para Alerta:

```json
{
  "nuevoEstado": "En investigación",
  "investigadorAsignado": "REEMPLAZAR_POR_OBJECTID_REAL"
}
```

Para Maltrato, seleccionar **Body → form-data** y agregar `estadoInvestigacion` = `En investigación`, `investigadorAsignado` = ID real, `file` = PDF. No establecer manualmente el boundary de `Content-Type`. Para Conflicto puede usarse JSON con `estadoInvestigacion` e `investigadorAsignado`, o multipart si se adjunta archivo.

Repetir el seguimiento con otro investigador debe crear una entrada adicional con su propia auditoría. No enviar un investigador original nuevo como parte del seguimiento.

## Verificación

```powershell
node node_modules/typescript/bin/tsc --project tsconfig.build.json --pretty false
node node_modules/jest/bin/jest.js --config test/jest-historicos.json --runInBand
node --check scripts/indices-historicos.cjs
```

La suite utiliza el ValidationPipe real, DTOs y schemas Mongoose reales; simula persistencia, usuarios y Google Drive. Comprueba los tres módulos, datos mínimos/parciales, rechazo del registro normal incompleto, auditoría, referencias, roles declarados, duplicados, mapeos y varios seguimientos. No equivale a una prueba de integración contra MongoDB o Google Drive reales.

En una base de pruebas, después de preparar índices:

1. Crear los tres ejemplos con un token de Analista y comprobar HTTP 201, auditoría de sesión y ausencia de datos ficticios.
2. Crear una segunda Alerta sin MP/número de alerta usando un DEIC diferente: debe funcionar; repetir un DEIC debe devolver 409. Repetir concurrentemente la misma incorporación debe producir solo un caso.
3. Probar `PARCIAL` con personas que tengan solo nombre y lugares con datos parciales; probar `COMPLETO` con la información disponible.
4. Enviar metadatos inválidos, un MP incorrecto, DEIC de otro módulo o auditoría libre: debe devolver 400. Sin sesión: 401; con rol no autorizado en incorporación: 403.
5. Crear como Investigador: comprobar `Pendiente`. Agregar seguimiento usando el DEIC de la respuesta y luego aprobar por la ruta existente.
6. Agregar dos seguimientos con investigadores distintos y verificar que Juan siga como investigador original y María figure solamente como registradora de cada seguimiento.
7. Repetir una creación normal completa con PDF y una incompleta: la primera debe funcionar y la segunda rechazarse. Abrir casos anteriores y verificar sus búsquedas y documentos habituales.

## Archivos de esta implementación

Modificados:

- `src/casos-alerta/casos-alerta.controller.ts`
- `src/casos-alerta/casos-alerta.service.ts`
- `src/casos-alerta/entities/casos-alerta.entity.ts`
- `src/casos-alerta/dto/update-casos-alerta.dto.ts`
- `src/casos-maltrato/casos-maltrato.controller.ts`
- `src/casos-maltrato/casos-maltrato.service.ts`
- `src/casos-maltrato/entities/casos-maltrato.entity.ts`
- `src/casos-conflicto/casos-conflicto.controller.ts`
- `src/casos-conflicto/casos-conflicto.service.ts`
- `src/casos-conflicto/entities/casos-conflicto.entity.ts`
- `src/common/case-number.validator.ts`

Nuevos:

- `src/common/historicos/caso-historico.schema.ts`
- `src/common/historicos/caso-historico.dto.ts`
- `src/common/historicos/caso-historico.service.ts`
- `src/common/dto/seguimiento.dto.ts`
- `src/casos-alerta/dto/create-historico-alerta.dto.ts`
- `src/casos-maltrato/dto/create-historico-maltrato.dto.ts`
- `src/casos-conflicto/dto/create-historico-conflicto.dto.ts`
- `src/common/historicos/casos-historicos.spec.ts`
- `test/jest-historicos.json`
- `scripts/indices-historicos.cjs`
- `docs/casos-historicos.md`
- `docs/casos-historicos.postman_collection.json`

Los cambios que ya existían en `src/app.module.ts`, búsquedas, dashboard y archivos locales de MongoDB no pertenecen a esta implementación y se conservaron.
