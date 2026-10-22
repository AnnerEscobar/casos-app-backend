// Ejecutar una sola vez como administrador en la BASE CORRECTA. No crea usuarios
// ni cambia contraseñas o permisos de usuarios existentes. No elimina nada.
// mongosh "<URI administrativa/base>" --file scripts/configurar-auditoria.mongosh.js
if (['admin', 'local', 'config', 'test'].includes(db.getName())) {
  throw new Error('Seleccione explícitamente la base SGIC en la URI.');
}
const diario = 'bitacora_auditoria';
if (!db.getCollectionNames().includes(diario)) db.createCollection(diario);
const bitacora = db.getCollection(diario);
if (bitacora.getIndexes().some(i => i.expireAfterSeconds !== undefined)) {
  throw new Error('Hay un índice TTL en la bitácora. Un administrador debe revisarlo; el script no lo elimina automáticamente.');
}
bitacora.createIndex({ eventoId: 1 }, { unique: true });
bitacora.createIndex({ fecha: -1, eventoId: -1 });
bitacora.createIndex({ numeroDeic: 1, fecha: -1 });
bitacora.createIndex({ 'usuario.id': 1, fecha: -1 });
bitacora.createIndex({ recursoId: 1, fecha: -1 });
bitacora.createIndex({ solicitudId: 1 });
bitacora.createIndex({ 'cambios.campo': 1, fecha: -1 });
const casos = ['casosalertas', 'casosmaltratos', 'casosconflictos'];
const otras = ['users', 'documentacioninicials', 'caratulas', 'informes', 'solicitudaccesos'];
// Usar recursos por colección. Un readWrite sobre toda la base ANULARÍA esta protección.
const privilegios = [
  ...casos.map(collection => ({ resource: { db: db.getName(), collection }, actions: ['find', 'insert', 'update', 'createIndex', 'listIndexes'] })),
  ...otras.map(collection => ({ resource: { db: db.getName(), collection }, actions: ['find', 'insert', 'update', 'remove', 'createIndex', 'listIndexes'] })),
  { resource: { db: db.getName(), collection: diario }, actions: ['find', 'insert', 'listIndexes'] },
  { resource: { db: db.getName(), collection: '' }, actions: ['listCollections', 'createCollection'] },
];
const rol = 'sgic_aplicacion_auditada';
if (!db.getRole(rol)) db.createRole({ role: rol, privileges: privilegios, roles: [] });
else {
  // No sobrescribir un rol existente sin revisar las diferencias.
  const actual = db.getRole(rol, { showPrivileges: true });
  print('El rol ya existe. Revise que no tenga privilegios adicionales:');
  printjson(actual);
}
print('Índices y rol preparados. Falta asignar SOLO este rol a una cuenta de aplicación dedicada y actualizar MONGO_URI.');
