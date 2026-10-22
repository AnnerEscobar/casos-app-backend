// Prueba de integración local: escrituras de casos y bitácora SIEMPRE abortadas.
// No crea expedientes persistentes ni cambia sesiones de usuarios existentes.
require('dotenv').config();
const mongoose = require('mongoose');
const { randomUUID } = require('node:crypto');
const { auditoriaPlugin } = require('../dist/auditoria/auditoria-plugin');
const { contextoAuditoria, verificarFirma } = require('../dist/auditoria/auditoria-core');
const { CasosAlertaSchema } = require('../dist/casos-alerta/entities/casos-alerta.entity');
async function main() {
  const conexion = await mongoose.createConnection(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000, autoIndex: false, autoCreate: false }).asPromise();
  conexion.plugin(auditoriaPlugin);
  const Modelo = conexion.model('CasosAlerta', CasosAlertaSchema.clone());
  const diario = conexion.collection('bitacora_auditoria');
  const sesion = await conexion.startSession();
  const id = new mongoose.Types.ObjectId();
  const solicitudId = randomUUID();
  const contexto = { solicitudId, usuario: { id: 'PRUEBA_CONFIGURACION', nombre: 'Prueba de configuración (rollback)', rol: 'Administrador' }, metodo: 'PRUEBA', ruta: '/configuracion/verificacion', ip: '127.0.0.1', agente: 'Prueba local', eventos: 0, session: sesion };
  try {
    sesion.startTransaction();
    await contextoAuditoria.run(contexto, async () => {
      const caso = new Modelo({ _id: id, numeroDeic: `PRUEBA-${solicitudId}`, procesoAlerta: true, estadoInvestigacion: 'Localizado' });
      await caso.save({ validateBeforeSave: false });
      caso.estadoInvestigacion = 'Remitido';
      await caso.save({ validateBeforeSave: false });
      const eventos = await diario.find({ solicitudId }, { session: sesion }).toArray();
      const cambio = eventos.find(e => e.cambios.some(c => c.campo === 'estadoInvestigacion' && c.anterior === 'Localizado' && c.nuevo === 'Remitido'));
      if (!cambio || !eventos.every(e => verificarFirma(e, process.env.AUDIT_HMAC_KEY))) throw new Error('El cambio o su firma no coincide.');
    });
    await sesion.abortTransaction();
    if (await Modelo.collection.findOne({ _id: id }) || await diario.countDocuments({ solicitudId })) throw new Error('El rollback no eliminó las escrituras de prueba.');
    sesion.startTransaction();
    const insertar = diario.insertOne;
    try {
      diario.insertOne = async () => { throw new Error('FALLO_AUDITORIA_SIMULADO'); };
      await contextoAuditoria.run(contexto, () => new Modelo({ _id: id, numeroDeic: `PRUEBA-${solicitudId}`, procesoAlerta: true }).save({ validateBeforeSave: false }));
      throw new Error('No se propagó el fallo de auditoría.');
    } catch (e) {
      if (e.message !== 'FALLO_AUDITORIA_SIMULADO') throw e;
      await sesion.abortTransaction();
    } finally { diario.insertOne = insertar; }
    if (await Modelo.collection.findOne({ _id: id })) throw new Error('Quedó un caso sin auditoría.');
    console.log('Integración MongoDB real correcta: Localizado → Remitido, identidad, firmas y rollback ante fallo de auditoría. Ningún expediente de prueba persistido.');
  } finally {
    if (sesion.inTransaction()) await sesion.abortTransaction();
    await sesion.endSession(); await conexion.close();
  }
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
