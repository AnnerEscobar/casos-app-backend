// Crea cuentas persistentes de prueba, solo en caso-db local y con auditoría transaccional.
// Conserva las cuentas existentes y guarda las claves fuera de Git, sin imprimirlas.
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes, randomUUID } = require('node:crypto');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const raiz = path.resolve(__dirname, '..');
require('dotenv').config({ path: path.join(raiz, '.env') });
const { auditoriaPlugin } = require('../dist/auditoria/auditoria-plugin');
const { contextoAuditoria } = require('../dist/auditoria/auditoria-core');
const { UsuarioSchema } = require('../dist/auth/entities/auth.entity');
const archivo = path.join(raiz, 'config/cuentas-prueba-locales.json');
const roles = [
  ['Administrador', 'admin.local@sgic.test'], ['Jefe', 'jefe.local@sgic.test'],
  ['Analista', 'analista.local@sgic.test'], ['Investigador', 'investigador.local@sgic.test'],
];

async function main() {
  const uri = new URL(process.env.MONGO_URI);
  if (!['127.0.0.1', 'localhost'].includes(uri.hostname) || uri.pathname !== '/caso-db')
    throw new Error('Este script solo admite caso-db en MongoDB local.');
  const cuentas = fs.existsSync(archivo) ? JSON.parse(fs.readFileSync(archivo, 'utf8')) :
    roles.map(([role, email]) => ({ nombre: `Prueba local ${role}`, email, role, password: randomBytes(18).toString('hex') }));
  if (!Array.isArray(cuentas) || cuentas.length !== roles.length || roles.some(([role, email], i) =>
    cuentas[i].role !== role || cuentas[i].email !== email || typeof cuentas[i].password !== 'string' || cuentas[i].password.length < 16))
    throw new Error('El archivo local de cuentas no tiene el formato esperado.');
  const conexion = await mongoose.createConnection(process.env.MONGO_URI,
    { autoCreate: false, autoIndex: false, serverSelectionTimeoutMS: 5000 }).asPromise();
  conexion.plugin(auditoriaPlugin);
  const Usuarios = conexion.model('Usuario', UsuarioSchema.clone());
  const session = await conexion.startSession();
  try {
    // Se conserva antes del commit para poder recuperar las claves si se interrumpe la ejecución.
    fs.mkdirSync(path.dirname(archivo), { recursive: true });
    if (!fs.existsSync(archivo)) fs.writeFileSync(archivo, JSON.stringify(cuentas, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
    session.startTransaction();
    await contextoAuditoria.run({ solicitudId: randomUUID(), metodo: 'MANTENIMIENTO',
      ruta: '/local/crear-cuentas-prueba', ip: '127.0.0.1', agente: 'Script local autorizado',
      usuario: { id: 'mantenimiento-local', nombre: 'Configuración local autorizada', rol: 'Mantenimiento local' },
      eventos: 0, session,
    }, async () => {
      for (const cuenta of cuentas) {
        const existente = await Usuarios.findOne({ email: cuenta.email });
        if (existente) {
          if (existente.role !== cuenta.role || !existente.activo || !await bcrypt.compare(cuenta.password, existente.password))
            throw new Error(`La cuenta ${cuenta.email} ya existe con otros datos; no se modificó.`);
          continue;
        }
        await Usuarios.create({ nombre: cuenta.nombre, email: cuenta.email, role: cuenta.role,
          activo: true, password: await bcrypt.hash(cuenta.password, 10) });
      }
    });
    await session.commitTransaction();
    console.log('Cuentas locales disponibles:');
    for (const cuenta of cuentas) console.log(`${cuenta.role}: ${cuenta.email}`);
    console.log('Contraseñas guardadas en config/cuentas-prueba-locales.json (excluido de Git).');
  } catch (error) {
    if (session.inTransaction()) await session.abortTransaction();
    throw error;
  } finally { await session.endSession(); await conexion.close(); }
}

main().catch(error => {
  console.error(error.name === 'Error' ? error.message : `No se completó la creación (${error.name}, código ${error.code ?? 'sin código'}).`);
  process.exitCode = 1;
});
