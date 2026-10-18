/*
 * Por defecto solo inspecciona. Ejecutar después de compilar.
 * Aplicar con las escrituras de la aplicación detenidas:
 * node scripts/indices-historicos.cjs --apply --maintenance
 * No modifica documentos y no utiliza syncIndexes().
 */
const mongoose = require('mongoose');
require('dotenv').config({ quiet: true });

async function main() {
  const apply = process.argv.includes('--apply');
  if (apply && !process.argv.includes('--maintenance')) {
    throw new Error('Detenga las escrituras y añada --maintenance para confirmar la ventana de mantenimiento.');
  }
  if (!process.env.MONGO_URI) throw new Error('Configure MONGO_URI para la base que desea revisar.');
  await mongoose.connect(process.env.MONGO_URI, { autoIndex: false, autoCreate: false });
  const planes = [];
  for (const tipo of (process.argv.includes('--solo-alerta') ? ['alerta'] : ['alerta', 'maltrato', 'conflicto'])) {
    const cap = tipo[0].toUpperCase() + tipo.slice(1);
    const entity = require(`../dist/casos-${tipo}/entities/casos-${tipo}.entity.js`);
    const modelo = mongoose.model(`Casos${cap}`, entity[`Casos${cap}Schema`]);
    const collection = modelo.collection;
    let indices;
    try { indices = await collection.listIndexes().toArray(); }
    catch (error) { if (error.code === 26) indices = []; else throw error; }
    const campos = tipo === 'alerta' ? ['numeroDeic', 'numeroMp', 'numeroAlerta'] : ['numeroDeic'];
    for (const campo of campos) {
      // Un requerimiento MP puede abarcar varias personas/alertas con distintos DEIC.
      const unico = !(tipo === 'alerta' && campo === 'numeroMp');
      // Revisar todas las colecciones antes de realizar cualquier modificación.
      const duplicados = await collection.aggregate([
        { $match: { [campo]: { $type: 'string' } } },
        { $group: { _id: `$${campo}`, cantidad: { $sum: 1 } } },
        { $match: { cantidad: { $gt: 1 } } },
        { $limit: 1 },
      ]).toArray();
      if (unico && duplicados.length) throw new Error(`${collection.name}.${campo}: hay duplicados; resolverlos antes de aplicar. No se modificaron índices.`);
      const parciales = tipo !== 'alerta' || campo !== 'numeroDeic';
      const filtro = { [campo]: { $type: 'string' } };
      const actuales = indices.filter(i => Object.keys(i.key).length === 1 && i.key[campo] === 1);
      const correcto = !unico
        ? actuales.some(i => !i.unique && !i.sparse && !i.partialFilterExpression) && !actuales.some(i=>i.unique)
        : actuales.some(i => i.unique && !i.sparse &&
          (parciales ? JSON.stringify(i.partialFilterExpression) === JSON.stringify(filtro) : !i.partialFilterExpression));
      if (correcto) {
        console.log(`${collection.name}.${campo}: correcto`);
        continue;
      }
      const nombre = `${campo}_1`;
      const retirar = actuales.filter(i => i.name === nombre || (i.unique && (!unico || (parciales && !i.partialFilterExpression))));
      if (retirar.some(i => i.collation)) throw new Error(`${collection.name}.${campo}: índice con collation; requiere revisión manual.`);
      planes.push({ collection, campo, nombre, retirar, opciones: {
        name: nombre, ...(unico ? { unique: true, ...(parciales ? { partialFilterExpression: filtro } : {}) } : {}),
      } });
      console.log(`${collection.name}.${campo}: ${!unico ? 'no único (requerimiento compartido)' : parciales ? 'único parcial para strings' : 'único'}; sustituir: ${retirar.map(i => i.name).join(', ') || 'ninguno'}`);
    }
  }
  if (!apply) {
    console.log(`Inspección terminada. ${planes.length} ajustes pendientes. No se modificaron índices ni documentos.`);
    return;
  }
  for (const plan of planes) {
    for (const previo of plan.retirar) await plan.collection.dropIndex(previo.name);
    try {
      await plan.collection.createIndex({ [plan.campo]: 1 }, plan.opciones);
    } catch (error) {
      // Intentar restaurar las restricciones previas si falla la creación.
      for (const previo of plan.retirar) {
        const { v, key, ns, ...opciones } = previo;
        await plan.collection.createIndex(key, opciones);
      }
      throw error;
    }
    console.log(`${plan.collection.name}.${plan.campo}: actualizado`);
  }
}

main().catch(error => {
  // Evitar imprimir URI o credenciales del driver.
  console.error(error.name === 'MongoServerSelectionError' ? 'No se pudo conectar con MongoDB.' : error.message);
  process.exitCode = 1;
}).finally(() => mongoose.disconnect());
