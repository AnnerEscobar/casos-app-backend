// Limpieza manual local: elimina únicamente la colección obsoleta usuarios si está vacía.
// No se ejecuta al arrancar la aplicación ni usa la cuenta de aplicación para borrar colecciones.
const fs = require('node:fs');
const path = require('node:path');
const { MongoClient } = require('mongodb');
const raiz = path.resolve(__dirname, '..');

async function main() {
  const secretos = JSON.parse(fs.readFileSync(path.join(raiz, 'config/auditoria-local/secretos.json'), 'utf8'));
  if (secretos.base !== 'caso-db') throw new Error('La limpieza solo admite la base local caso-db.');
  const uri = `mongodb://${encodeURIComponent(secretos.admin)}:${encodeURIComponent(secretos.adminPassword)}@127.0.0.1:27017/admin?replicaSet=sgic-rs&directConnection=true`;
  const cliente = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  try {
    await cliente.connect();
    const db = cliente.db('caso-db');
    const cantidadUsers = await db.collection('users').countDocuments({});
    if (!cantidadUsers) throw new Error('No se encontró la colección users con datos; revisa el servidor local.');
    const existe = await db.listCollections({ name: 'usuarios' }, { nameOnly: true }).hasNext();
    if (!existe) { console.log('usuarios ya no existe; no se realizaron cambios.'); return; }
    if (await db.collection('usuarios').countDocuments({}) !== 0)
      throw new Error('usuarios contiene documentos; no se eliminó.');
    await db.collection('usuarios').drop();
    if (await db.listCollections({ name: 'usuarios' }, { nameOnly: true }).hasNext())
      throw new Error('No se pudo verificar la eliminación.');
    if (await db.collection('users').countDocuments({}) !== cantidadUsers)
      throw new Error('Cambió el conteo de users durante la limpieza; revisa las escrituras concurrentes.');
    console.log(`Colección usuarios vacía eliminada de caso-db. users conserva ${cantidadUsers} documentos.`);
  } finally { await cliente.close(); }
}

main().catch(error => {
  console.error(error.name === 'Error' ? error.message : `No se completó la limpieza (${error.name}, código ${error.code ?? 'sin código'}).`);
  process.exitCode = 1;
});
