// Configuración local de Docker. Los secretos se conservan en config (ignorado).
// No imprime credenciales. Preparar requiere un respaldo previo y Mongo local.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { MongoClient } = require('mongodb');
const raiz = path.resolve(__dirname, '..');
const carpeta = path.join(raiz, 'config/auditoria-local');
const secretosPath = path.join(carpeta, 'secretos.json');
require('dotenv').config({ path: path.join(raiz, '.env') });
const modo = process.argv[2];
function shell(codigo) {
  const p = spawnSync('docker', ['exec', '-i', 'casos-db', 'mongosh', '--quiet', '--norc', '--file', '/dev/stdin'], { input: codigo, encoding: 'utf8', timeout: 60000 });
  if (p.status !== 0) {
    fs.writeFileSync(path.join(carpeta, 'ultimo-error-privado.txt'), String(p.stderr || p.stdout || p.error));
    throw new Error('Falló mongosh. Diagnóstico privado en config/auditoria-local/ultimo-error-privado.txt.');
  }
  return p.stdout;
}
const leerSecretos = () => JSON.parse(fs.readFileSync(secretosPath, 'utf8'));
const autenticar = s => `if (!db.getSiblingDB('admin').auth(${JSON.stringify(s.admin)}, ${JSON.stringify(s.adminPassword)})) throw new Error('Autenticación administrativa fallida');\n`;
async function main() {
  if (modo === 'preparar') {
    const uri = new URL(process.env.MONGO_URI);
    if (!['127.0.0.1', 'localhost'].includes(uri.hostname)) throw new Error('Solo se admite el Mongo local del proyecto.');
    if (!fs.existsSync(path.join(carpeta, 'antes-auditoria.archive.gz'))) throw new Error('Falta el respaldo antes-auditoria.archive.gz.');
    fs.mkdirSync(carpeta, { recursive: true });
    let s;
    if (fs.existsSync(secretosPath)) s = leerSecretos();
    else {
      s = { base: uri.pathname.slice(1), admin: 'sgic_admin_local', adminPassword: crypto.randomBytes(36).toString('hex'), usuario: 'sgic_app_auditada', password: crypto.randomBytes(36).toString('hex'), firma: crypto.randomBytes(48).toString('hex') };
      fs.writeFileSync(secretosPath, JSON.stringify(s, null, 2), { flag: 'wx', mode: 0o600 });
      fs.writeFileSync(path.join(carpeta, 'mongo-keyfile'), crypto.randomBytes(512).toString('base64'), { flag: 'wx', mode: 0o600 });
      fs.copyFileSync(path.join(raiz, '.env'), path.join(carpeta, 'env-antes-auditoria.backup'));
    }
    // Nunca reemplaza credenciales de un usuario existente.
    shell(`const a = db.getSiblingDB('admin'); if (!a.getUser(${JSON.stringify(s.admin)})) a.createUser({user:${JSON.stringify(s.admin)},pwd:${JSON.stringify(s.adminPassword)},roles:[{role:'root',db:'admin'}]});`);
    const script = fs.readFileSync(path.join(raiz, 'scripts/configurar-auditoria.mongosh.js'), 'utf8');
    shell(`db = db.getSiblingDB(${JSON.stringify(s.base)});\n${script}\nif (!db.getUser(${JSON.stringify(s.usuario)})) db.createUser({user:${JSON.stringify(s.usuario)},pwd:${JSON.stringify(s.password)},roles:[{role:'sgic_aplicacion_auditada',db:${JSON.stringify(s.base)}}]});`);
    const conteos = shell(`db = db.getSiblingDB(${JSON.stringify(s.base)}); print(JSON.stringify(Object.fromEntries(db.getCollectionNames().filter(n=>n!=='bitacora_auditoria').map(n=>[n,db.getCollection(n).countDocuments({})]))));`);
    fs.writeFileSync(path.join(carpeta, 'conteos-previos.json'), conteos.trim());
    console.log('Usuarios, rol, índices, keyfile y respaldo de configuración preparados sin revelar secretos.');
  } else if (modo === 'iniciar-replica') {
    const s = leerSecretos();
    shell(autenticar(s) + `try { rs.status(); } catch(e) { if(e.code!==94) throw e; rs.initiate({_id:'sgic-rs',members:[{_id:0,host:'localhost:27017'}]}); }`);
    console.log('Replica set inicializado (o ya existente).');
  } else if (modo === 'activar-env') {
    const s = leerSecretos();
    const uri = `mongodb://${encodeURIComponent(s.usuario)}:${encodeURIComponent(s.password)}@127.0.0.1:27017/${s.base}?authSource=${encodeURIComponent(s.base)}&replicaSet=sgic-rs&directConnection=true`;
    let env = fs.readFileSync(path.join(raiz, '.env'), 'utf8');
    for (const [clave, valor] of Object.entries({ MONGO_URI: uri, AUDIT_HMAC_KEY: s.firma })) {
      const re = new RegExp(`^${clave}=.*$`, 'm');
      env = re.test(env) ? env.replace(re, `${clave}=${valor}`) : `${env.trimEnd()}\n${clave}=${valor}\n`;
    }
    fs.writeFileSync(path.join(raiz, '.env'), env);
    console.log('.env actualizado con cuenta limitada y clave de firma.');
  } else if (modo === 'compass') {
    const s = leerSecretos();
    if (!s.compassUsuario) {
      s.compassUsuario = 'sgic_compass_lectura';
      s.compassPassword = crypto.randomBytes(36).toString('hex');
      fs.writeFileSync(secretosPath, JSON.stringify(s, null, 2), { mode: 0o600 });
    }
    shell(autenticar(s) + `db=db.getSiblingDB(${JSON.stringify(s.base)}); if(!db.getUser(${JSON.stringify(s.compassUsuario)})) db.createUser({user:${JSON.stringify(s.compassUsuario)},pwd:${JSON.stringify(s.compassPassword)},roles:[{role:'read',db:${JSON.stringify(s.base)}}]});`);
    const uri = `mongodb://${s.compassUsuario}:${s.compassPassword}@127.0.0.1:27017/${s.base}?authSource=${encodeURIComponent(s.base)}&replicaSet=sgic-rs&directConnection=true`;
    const cliente = await new MongoClient(uri, { serverSelectionTimeoutMS: 5000 }).connect();
    try {
      const d = cliente.db(s.base);
      await d.command({ dbStats: 1 });
      const bases = await cliente.db('admin').command({ listDatabases: 1 });
      if (!bases.databases.some(b => b.name === s.base)) throw new Error('Compass no puede listar la base.');
      console.log('Conexión Compass verificada: base visible, estadísticas disponibles y ' + await d.collection('users').countDocuments({}) + ' usuarios. Solo lectura.');
      fs.writeFileSync(path.join(carpeta, 'conexion-compass.txt'), uri + '\n', { mode: 0o600 });
    } finally { await cliente.close(); }
  } else if (modo === 'verificar') {
    const s = leerSecretos();
    const admin = new MongoClient(`mongodb://${s.admin}:${s.adminPassword}@127.0.0.1:27017/admin?replicaSet=sgic-rs&directConnection=true`, { serverSelectionTimeoutMS: 10000 });
    const app = new MongoClient(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
    try {
      await admin.connect(); await app.connect();
      const antes = JSON.parse(fs.readFileSync(path.join(carpeta, 'conteos-previos.json'), 'utf8'));
      const base = admin.db(s.base);
      for (const [coleccion, cantidad] of Object.entries(antes)) {
        if (await base.collection(coleccion).countDocuments({}) !== cantidad) throw new Error('Cambió la cantidad de documentos en ' + coleccion);
      }
      const diario = app.db(s.base).collection('bitacora_auditoria');
      const privilegios = (await app.db(s.base).command({ connectionStatus: 1, showPrivileges: true })).authInfo.authenticatedUserPrivileges;
      if (privilegios.some(p => (p.resource.anyResource || (p.resource.db === s.base && ['', 'bitacora_auditoria'].includes(p.resource.collection))) && p.actions.some(a => ['anyAction', 'update', 'remove', 'dropCollection', 'dropDatabase', 'createIndex', 'collMod'].includes(a)))) throw new Error('Permisos de auditoría demasiado amplios.');
      const pruebas = [
        ['modificar', () => diario.updateOne({ eventoId: 'prueba-no-existe' }, { $set: { resultado: 'alterado' } })],
        ['borrar', () => diario.deleteOne({ eventoId: 'prueba-no-existe' })],
        // No ejecutar DROP contra una bitácora que ya contenga registros.
        ...(await diario.estimatedDocumentCount() === 0 ? [['eliminar colección', () => diario.drop()]] : []),
        ['crear expiración', () => diario.createIndex({ fecha: 1 }, { expireAfterSeconds: 1 })],
      ];
      for (const [nombre, ejecutar] of pruebas) {
        try { await ejecutar(); throw new Error('La cuenta pudo ' + nombre); }
        catch (e) { if (e.code !== 13) throw e; }
      }
      const session = app.startSession();
      session.startTransaction();
      await diario.insertOne({ eventoId: crypto.randomUUID(), prueba: true }, { session });
      await session.abortTransaction(); await session.endSession();
      if (await diario.countDocuments({ prueba: true })) throw new Error('Falló rollback.');
      console.log('Verificado: conteos originales intactos, autenticación, transacciones y denegación de update/delete/drop/TTL sobre bitácora.');
    } finally { await app.close(); await admin.close(); }
  } else throw new Error('Modo requerido: preparar | iniciar-replica | activar-env | compass | verificar');
}
main().catch(e => { console.error(e.message.replace(/mongodb[^\s]+/g, '[URI OCULTA]')); process.exitCode = 1; });
