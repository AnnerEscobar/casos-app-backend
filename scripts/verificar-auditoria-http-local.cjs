// Cuentas ficticias temporales; creación y limpieza también quedan auditadas.
// No modifica usuarios ni expedientes existentes ni imprime credenciales.
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const { randomUUID, randomBytes } = require('node:crypto');
const { auditoriaPlugin } = require('../dist/auditoria/auditoria-plugin');
const { contextoAuditoria, verificarFirma } = require('../dist/auditoria/auditoria-core');
const { UsuarioSchema } = require('../dist/auth/entities/auth.entity');
async function main() {
  const conexion = await mongoose.createConnection(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000, autoIndex: false, autoCreate: false }).asPromise();
  conexion.plugin(auditoriaPlugin);
  const Usuarios = conexion.model('Usuario', UsuarioSchema.clone());
  const diario = conexion.collection('bitacora_auditoria');
  const runId = randomUUID(); const creados = [];
  const contexto = { solicitudId: runId, usuario: { id: 'sgic_admin_local', nombre: 'Configuración local autorizada (prueba temporal)', rol: 'Administrador de MongoDB local' }, metodo: 'PRUEBA', ruta: '/configuracion/prueba-roles', ip: '127.0.0.1', agente: 'Prueba local', eventos: 0 };
  async function transaccion(fn) {
    const session = await conexion.startSession();
    try {
      session.startTransaction();
      const resultado = await contextoAuditoria.run({ ...contexto, session }, async () => await fn());
      await session.commitTransaction(); return resultado;
    } catch (e) { if (session.inTransaction()) await session.abortTransaction(); throw e; }
    finally { await session.endSession(); }
  }
  const base = `http://127.0.0.1:${process.env.PORT || 3000}`;
  async function pedir(ruta, opciones = {}) { return fetch(base + ruta, { ...opciones, signal: AbortSignal.timeout(15000) }); }
  if (process.argv.includes('--limpiar')) {
    try {
      const temporales = await Usuarios.find({ email: /^prueba-(administrador|jefe|analista|investigador)-[a-f0-9-]{36}@example\.invalid$/, nombre: /^PRUEBA TEMPORAL / }).select('_id');
      for (const u of temporales) await transaccion(() => Usuarios.deleteOne({ _id: u._id }).exec());
      console.log(`Cuentas temporales limpiadas con auditoría: ${temporales.length}.`);
    } finally { await conexion.close(); }
    return;
  }
  try {
    const anonimo = await pedir('/auditoria');
    if (anonimo.status !== 401) throw new Error('Se admitió acceso anónimo a bitácora.');
    for (const rol of ['Administrador', 'Jefe', 'Analista', 'Investigador']) {
      const password = randomBytes(24).toString('hex');
      const email = `prueba-${rol.toLowerCase()}-${runId}@example.invalid`;
      const usuario = await transaccion(() => new Usuarios({ nombre: `PRUEBA TEMPORAL ${rol}`, email, password: bcrypt.hashSync(password, 10), role: rol, activo: true }).save());
      creados.push(usuario._id);
      const login = await pedir('/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
      if (!login.ok) throw new Error(`Login de prueba ${rol}: HTTP ${login.status}`);
      const cookie = login.headers.get('set-cookie')?.split(';')[0];
      if (!cookie) throw new Error('Falta cookie de sesión.');
      const res = await pedir('/auditoria?limite=100', { headers: { Cookie: cookie } });
      const esperado = ['Administrador', 'Jefe'].includes(rol) ? 200 : 403;
      if (res.status !== esperado) throw new Error(`Permiso ${rol}: esperado ${esperado}, recibido ${res.status}`);
      if (res.ok) {
        const datos = await res.json();
        if (!datos.registros.length || datos.registros.some(e => !e.integridadValida)) throw new Error('La consulta no contiene eventos verificables.');
      }
      const logout = await pedir('/auth/logout', { method: 'POST', headers: { Cookie: cookie } });
      if (!logout.ok) throw new Error(`Logout falló: HTTP ${logout.status}`);
      console.log(`${rol}: consulta HTTP ${res.status}; login y logout correctos.`);
    }
  } finally {
    // La cuenta de aplicación sí puede limpiar usuarios, pero los eventos quedan.
    try { for (const id of creados) await transaccion(() => Usuarios.deleteOne({ _id: id }).exec()); }
    finally { await conexion.close(); }
  }
  console.log('API real verificada: solo Administrador y Jefe consultan la bitácora. Cuentas temporales eliminadas con auditoría; usuarios originales intactos.');
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
