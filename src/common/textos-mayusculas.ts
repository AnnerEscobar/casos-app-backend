import { Schema } from 'mongoose';

// El valor principal es el normalizado. Este campo privado solo conserva la
// escritura original; nunca se expone en las respuestas de la aplicación.
const PRESENTACION = '_presentacionTextos';
type Originales = Record<string, { ruta: string; original: string; normalizado: string }>;
const internos = new Set([
  'email', 'password', 'token', 'role', 'tipo', 'tipoCaso', 'tipoInforme',
  'estado', 'estadoRegistro', 'estadoInvestigacion', 'nuevoEstado',
  'origenCaso', 'estadoExpedienteHistorico', 'fuenteInformacionHistorica',
  'modalidadMaltrato', 'codigo', 'seccionesCompletadas', 'camarasEstado',
  'indicadoresEstado', 'nombreArchivo', 'originalname', 'filename',
]);

// Determina si una ruta contiene texto descriptivo normalizable y excluye identificadores,
// credenciales, estados y otros valores técnicos.
function descriptivo(schema: Schema, ruta: string): boolean {
  const partes = ruta.split('.');
  const campo = [...partes].reverse().find(p => !/^\d+$/.test(p)) || '';
  if (partes.some(p => p === PRESENTACION || p.startsWith('$') || p.startsWith('_'))) return false;
  if (internos.has(campo) || /(?:url|urls|email|password|token|hash|fileid|usuarioid|casoid)$/i.test(campo)) return false;
  if (['archivos', 'fileUrls'].some(p => partes.includes(p))) return false;
  // Los identificadores, fechas, horas y coordenadas no son texto descriptivo.
  if (/^(?:numero|fecha|hora)/i.test(campo) || /(?:Id|Ids)$/.test(campo) || /gps|coordenadas/i.test(campo)) return false;
  const path: any = schema.path(ruta);
  return !path?.enumValues?.length && !path?.options?.enum;
}

// Recorre propiedades y arreglos para visitar los valores de texto con su ruta, sin
// transformar fechas, referencias ni archivos binarios.
function recorrer(value: any, ruta: string, visitar: (ruta: string, texto: string) => void): void {
  if (typeof value === 'string') { visitar(ruta, value); return; }
  if (!value || value instanceof Date || Buffer.isBuffer(value) || value._bsontype) return;
  if (Array.isArray(value)) {
    value.forEach((item, i) => recorrer(item, `${ruta}.${i}`, visitar));
  } else if (typeof value === 'object') {
    const plano = value._doc || value;
    for (const [key, child] of Object.entries(plano)) {
      if (key !== PRESENTACION) recorrer(child, ruta ? `${ruta}.${key}` : key, visitar);
    }
  }
}

// Construye la presentación original y su versión en mayúsculas únicamente para campos
// descriptivos permitidos.
function entrada(schema: Schema, ruta: string, original: string): Originales[string] | undefined {
  if (!descriptivo(schema, ruta)) return;
  return { ruta, original, normalizado: original.toUpperCase() };
}

// Codifica una ruta como texto hexadecimal para usarla como clave segura en el mapa de
// presentaciones originales.
const clave = (ruta: string) => Buffer.from(ruta, 'utf8').toString('hex');

// Restaura un texto solo si su ruta ya existe y mantiene el valor esperado, sin reconstruir
// campos excluidos por una consulta.
function asignarExistente(obj: any, ruta: string, original: string, normalizado: string) {
  const partes = ruta.split('.');
  let parent = obj;
  for (const key of partes.slice(0, -1)) {
    parent = (parent?._doc || parent)?.[key];
    if (!parent) return;
  }
  parent = parent?._doc || parent;
  const key = partes[partes.length - 1];
  // No reconstruir campos excluidos por una proyección, ni datos eliminados.
  if (parent && Object.prototype.hasOwnProperty.call(parent, key) && parent[key] === normalizado) parent[key] = original;
}

// Aplica al documento las presentaciones originales guardadas para recuperar la escritura
// recibida por el backend.
function restaurar(obj: any) {
  if (!obj) return;
  const raw = obj._doc || obj;
  const originales: Originales = raw[PRESENTACION] || {};
  for (const entry of Object.values(originales)) {
    if (entry && typeof entry.ruta === 'string' && typeof entry.original === 'string') {
      asignarExistente(obj, entry.ruta, entry.original, entry.normalizado);
    }
  }
}

// Restaura los textos de objetos y arreglos serializados y retira los metadatos auxiliares
// antes de exponerlos.
function presentarPlano(obj: any): any {
  if (!obj || obj instanceof Date || Buffer.isBuffer(obj) || obj._bsontype) return obj;
  if (Array.isArray(obj)) { obj.forEach(presentarPlano); return obj; }
  if (typeof obj === 'object') {
    restaurar(obj);
    delete obj[PRESENTACION];
    for (const child of Object.values(obj)) presentarPlano(child);
  }
  return obj;
}

/** Se instala antes de compilar cada modelo; también cubre sus subdocumentos. */
// Instala la normalización de textos al guardar o actualizar y restaura su presentación al
// consultar, conservando tipos y campos técnicos.
export function textosMayusculasPlugin(schema: Schema) {
  schema.add({ [PRESENTACION]: { type: Schema.Types.Mixed } });

  schema.pre('save', function () {
    const doc: any = this;
    const plano = doc.toObject({ transform: false, getters: false, depopulate: true });
    const originales: Originales = { ...(plano[PRESENTACION] || {}) };
    // Limpiar solamente los campos leídos. Una edición con proyección no borra
    // la presentación de otros campos del mismo expediente.
    for (const [key, entry] of Object.entries(originales)) {
      if (entry?.ruta && doc.isSelected(entry.ruta.replace(/\.\d+(?=\.|$)/g, '')) &&
          Object.prototype.hasOwnProperty.call(plano, entry.ruta.split('.')[0])) delete originales[key];
    }
    recorrer(plano, '', (ruta, texto) => {
      const item = entrada(schema, ruta, texto);
      if (!item) return;
      originales[clave(ruta)] = item;
      if (texto !== item.normalizado) doc.set(ruta, item.normalizado);
    });
    if (Object.keys(originales).length || plano[PRESENTACION]) doc.set(PRESENTACION, originales);
  });

  // La aplicación sigue trabajando con el texto original, incluso tras guardar.
  schema.post('init', function (doc: any) { restaurar(doc); });
  schema.post('save', function (doc: any) { restaurar(doc); });
  schema.post('save', function (error: any, doc: any, next: any) {
    restaurar(doc);
    next(error);
  });

  for (const option of ['toJSON', 'toObject'] as const) {
    const anterior = schema.get(option) || {};
    const transform = anterior.transform;
    schema.set(option, {
      ...anterior,
      // Restaura la presentación de los textos en la serialización y ejecuta también la
      // transformación que ya tenía configurada el esquema.
      transform(doc: any, ret: any, opts: any) {
        presentarPlano(ret);
        return typeof transform === 'function' ? transform(doc, ret, opts) : ret;
      },
    });
  }

  for (const op of ['find', 'findOne', 'findOneAndUpdate'] as const) {
    schema.pre(op, function () {
      const query: any = this;
      const fields = query.projection();
      // Los listados con select('nombre') también necesitan su presentación.
      if (fields && Object.entries(fields).some(([key, value]) => key !== '_id' && value === 1)) {
        query.select({ [PRESENTACION]: 1 });
      }
    });
    schema.post(op, function (result: any) {
      if ((this as any).mongooseOptions().lean) presentarPlano(result);
    });
  }

  // La solicitud de acceso usa una actualización atómica para motivo; no pasa
  // por save(). Conservar ambos valores en la misma escritura.
  for (const op of ['findOneAndUpdate', 'updateOne', 'updateMany'] as const) {
    schema.pre(op, function () {
      const query: any = this;
      const update = query.getUpdate();
      if (!update || Array.isArray(update)) return;
      for (const operator of ['$set', '$setOnInsert']) {
        const datos = update[operator] || (operator === '$set' ? update : undefined);
        if (!datos) continue;
        for (const [path, value] of Object.entries({ ...datos })) {
          if (path.startsWith('$') || path.startsWith(PRESENTACION)) continue;
          recorrer(value, path, (ruta, texto) => {
            const item = entrada(schema, ruta, texto);
            if (!item) return;
            // Convertir dentro del mismo objeto, sin crear claves Mongo que
            // colisionen con una sustitución de todo el contenedor.
            if (ruta === path) datos[path] = item.normalizado;
            else asignarExistente(value, ruta.slice(path.length + 1), item.normalizado, texto);
            update[operator] ||= {};
            update[operator][`${PRESENTACION}.${clave(ruta)}`] = item;
          });
        }
      }
      query.setUpdate(update);
    });
  }
}
