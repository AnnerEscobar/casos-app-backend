import 'reflect-metadata';
import { readFileSync, existsSync } from 'fs';
import { model } from 'mongoose';
import { Workbook } from 'exceljs';
import { importarMasivo, leerTexto, fechaImportada } from './importacion-masiva';
import { CasosMaltratoSchema } from '../casos-maltrato/entities/casos-maltrato.entity';
import { CasosConflictoSchema } from '../casos-conflicto/entities/casos-conflicto.entity';
import { CasosAlertaSchema } from '../casos-alerta/entities/casos-alerta.entity';
import { CasosAlertaController } from '../casos-alerta/casos-alerta.controller';
import { CasosMaltratoController } from '../casos-maltrato/casos-maltrato.controller';
import { CasosConflictoController } from '../casos-conflicto/casos-conflicto.controller';
import { UserRole } from '../auth/enums/user-role.enum';
import { EstadoExpedienteHistorico } from './historicos/caso-historico.schema';
import maltratoHeaders = require('../casos-maltrato/maltrato-excel-encabezados.json');
import { detectarMapa } from './importacion-masiva-mapeo';
import { filaDesaparecido } from '../casos-alerta/alerta-excel';
import { filasMaltrato } from '../casos-maltrato/maltrato-excel';
import { filasConflicto } from '../casos-conflicto/conflicto-excel';
import alertaHeaders = require('../casos-alerta/alerta-excel-encabezados.json');
import conflictoHeaders = require('../casos-conflicto/conflicto-excel-encabezados.json');

const usuario={userId:'507f1f77bcf86cd799439011',role:UserRole.ANALISTA};
const options={accion:'vista-previa',hoja:'Datos',estadoExpedienteHistorico:EstadoExpedienteHistorico.PARCIAL};
const models={maltrato:model('PruebaImportacionMaltrato',CasosMaltratoSchema),alerta:model('PruebaImportacionAlerta',CasosAlertaSchema),conflicto:model('PruebaImportacionConflicto',CasosConflictoSchema)};
function archivo(buffer:Buffer,name='prueba.xlsx'):Express.Multer.File {return {buffer,originalname:name,size:buffer.length} as Express.Multer.File;}
async function libro(filas:any[][],headers=maltratoHeaders) {const wb=new Workbook();const sh=wb.addWorksheet('Datos');sh.addRow(headers);filas.forEach(f=>sh.addRow(f));return archivo(Buffer.from(await wb.xlsx.writeBuffer()));}
const fila=(nombre='PERSONA DE PRUEBA',estado='EN FASE DE INVESTIGACION')=>{const f:any[]=Array(56).fill('');f[4]='DEIC51-2026-01-01-1';f[6]=new Date('2026-01-01Z');f[12]=nombre;f[14]=12;f[35]=estado;return f;};
beforeEach(()=>{for(const m of Object.values(models))jest.spyOn(m,'exists').mockResolvedValue(null);});
afterEach(()=>jest.restoreAllMocks());

it('protege las tres rutas para Analista y rechaza otros roles en el servicio',async()=>{
  for(const cls of [CasosAlertaController,CasosMaltratoController,CasosConflictoController])expect(Reflect.getMetadata('roles',cls.prototype.cargaMasiva)).toEqual([UserRole.ANALISTA]);
  await expect(importarMasivo(models.maltrato,'maltrato',null,options,{...usuario,role:UserRole.INVESTIGADOR})).rejects.toMatchObject({status:403});
});
it('agrupa tres filas y dos víctimas diferentes en un único caso sin guardar en la vista previa',async()=>{
  const guardar=jest.spyOn(models.maltrato.prototype,'save');
  const r:any=await importarMasivo(models.maltrato,'maltrato',await libro([fila('VICTIMA A'),fila('VICTIMA B'),fila('VICTIMA A')]),options,usuario);
  expect(r.resumen).toMatchObject({filas:3,casos:1,listos:1,errores:0});expect(r.casos[0].victimas).toBe(2);expect(guardar).not.toHaveBeenCalled();
});
it('bloquea todo el caso si hay datos generales contradictorios o una edad inválida',async()=>{
  const f=fila('VICTIMA B','CONCLUIDO');f[14]=-1;
  const r:any=await importarMasivo(models.maltrato,'maltrato',await libro([fila(),f]),options,usuario);
  expect(r.resumen.errores).toBe(1);expect(r.resumen.listos).toBe(0);expect(r.casos[0].errores.join(' ')).toContain('estadoInvestigacion');
});
it('omite un caso existente con todas sus víctimas sin modificarlo',async()=>{
  (models.maltrato.exists as jest.Mock).mockResolvedValue({_id:'existente'});
  const r:any=await importarMasivo(models.maltrato,'maltrato',await libro([fila(),fila('OTRA')]),options,usuario);
  expect(r.resumen.existentes).toBe(1);expect(r.casos[0].victimas).toBe(2);
});
it('exige una nueva vista previa cuando cambia el archivo o sus opciones',async()=>{
  await expect(importarMasivo(models.maltrato,'maltrato',await libro([fila()]),{...options,accion:'importar',huella:'0'.repeat(64)},usuario)).rejects.toMatchObject({status:409});
});
it('importa una sola escritura con ambas víctimas, auditoría y evidencia; reintentar omite el caso',async()=>{
  const file=await libro([fila('VICTIMA A'),fila('VICTIMA B')]);let saved:any;
  jest.spyOn(models.maltrato.prototype,'save').mockImplementation(async function(){saved=this;(models.maltrato.exists as jest.Mock).mockResolvedValue({_id:this._id});return this;});
  jest.spyOn(models.maltrato.prototype,'populate').mockImplementation(async function(){return this;});
  const preview:any=await importarMasivo(models.maltrato,'maltrato',file,options,usuario);
  const dto={...options,accion:'importar',huella:preview.huella};
  const r:any=await importarMasivo(models.maltrato,'maltrato',file,dto,usuario);
  expect(r.resumen.importados).toBe(1);expect(saved.victimas).toHaveLength(2);expect(String(saved.registradoPor)).toBe(usuario.userId);expect(saved.investigadorAsignado).toBeUndefined();expect(saved.importacionOrigen.filas).toHaveLength(2);
  const repeat:any=await importarMasivo(models.maltrato,'maltrato',file,dto,usuario);expect(repeat.resumen.existentes).toBe(1);
});
it('lee texto con comillas, saltos de línea, vacíos y UTF-8 y no interpreta fórmulas',()=>{
  expect(leerTexto('DEIC;NOMBRE;NOTA\r\n1;"María; López";"dos\nlineas"\r\n2;;=1+1')).toEqual([['DEIC','NOMBRE','NOTA'],['1','María; López','dos\nlineas'],['2','','=1+1']]);
  expect(()=>leerTexto('A;B\n"sin cierre')).toThrow();
  expect(fechaImportada(46023)).toBe('2026-01-01');expect(fechaImportada('03/04/2026')).toBe('2026-04-03');expect(()=>fechaImportada('31/02/2026')).toThrow();
});
it('crea una cuenta para varios casos solo al confirmar y vincula al investigador original',async()=>{
  const query=(v:any)=>({select:()=>({lean:()=>({exec:async()=>v})})});
  const persona={_id:'507f1f77bcf86cd799439012',nombre:'Anner Escobar',email:'anner.escobar',role:UserRole.INVESTIGADOR,activo:true};
  const usuarios:any={find:()=>query([]),findOne:()=>query(persona),exists:jest.fn().mockResolvedValue({_id:persona._id}),create:jest.fn().mockResolvedValue(persona)};
  jest.spyOn(models.maltrato.db,'model').mockReturnValue(usuarios);
  const guardados:any[]=[];
  jest.spyOn(models.maltrato.prototype,'save').mockImplementation(async function(){guardados.push(this);return this;});
  jest.spyOn(models.maltrato.prototype,'populate').mockImplementation(async function(){return this;});
  const a=fila('VICTIMA A'),b=fila('VICTIMA B');a[8]='Anner Escobar';b[8]='Anner Escobar';b[4]='DEIC51-2026-01-01-2';
  const file=await libro([a,b]),dto={...options,crearInvestigadores:'si'};
  const preview:any=await importarMasivo(models.maltrato,'maltrato',file,dto,usuario);
  expect(usuarios.create).not.toHaveBeenCalled();expect(preview.cuentas[0].usuario).toBe('anner.escobar');
  const resultado:any=await importarMasivo(models.maltrato,'maltrato',file,{...dto,accion:'importar',huella:preview.huella},usuario);
  expect(resultado.resumen.importados).toBe(2);expect(usuarios.create).toHaveBeenCalledTimes(1);
  for(const c of guardados){expect(String(c.investigadorOriginal.usuarioId)).toBe(persona._id);expect(c.investigadorAsignado).toBeUndefined();}
});
it('vincula cuentas existentes por nombre sin activar creación de investigadores',async()=>{
  const query=(v:any)=>({select:()=>({lean:()=>({exec:async()=>v})})});
  const persona={_id:'507f1f77bcf86cd799439012',nombre:'Anner Escobar',email:'anner.escobar',role:UserRole.INVESTIGADOR,activo:true};
  const usuarios:any={find:()=>query([persona]),findOne:()=>query(persona),exists:jest.fn().mockResolvedValue({_id:persona._id}),create:jest.fn().mockResolvedValue(persona)};
  jest.spyOn(models.maltrato.db,'model').mockReturnValue(usuarios);
  const guardados:any[]=[];
  jest.spyOn(models.maltrato.prototype,'save').mockImplementation(async function(){guardados.push(this);return this;});
  jest.spyOn(models.maltrato.prototype,'populate').mockImplementation(async function(){return this;});
  const a=fila('VICTIMA A'),b=fila('VICTIMA B');a[8]='Anner Escobar';b[8]='Anner Escobar';b[4]='DEIC51-2026-01-01-2';
  const file=await libro([a,b]),dto={...options};
  const preview:any=await importarMasivo(models.maltrato,'maltrato',file,dto,usuario);
  expect(usuarios.create).not.toHaveBeenCalled();expect(preview.cuentas[0].usuario).toBe('anner.escobar');
  const resultado:any=await importarMasivo(models.maltrato,'maltrato',file,{...dto,accion:'importar',huella:preview.huella},usuario);
  expect(resultado.resumen.importados).toBe(2);expect(usuarios.create).not.toHaveBeenCalled();
  for(const c of guardados){expect(String(c.investigadorOriginal.usuarioId)).toBe(persona._id);expect(c.investigadorAsignado).toBeUndefined();}
});
it('lee sin cargar estilos masivos y conserva números de fila y fechas del calendario 1904',async()=>{
  const wb=new Workbook();wb.properties.date1904=true;
  const sh=wb.addWorksheet('Datos');sh.addRow(maltratoHeaders);sh.addRow([]);
  const datos=fila();datos[6]=new Date('2026-01-01Z');sh.addRow(datos);
  // Las filas vacías con formato no son casos; los estilos no participan en la importación.
  for(let i=4;i<1200;i++)sh.getCell(i,1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFEEEEEE'}};
  let guardado:any;
  jest.spyOn(models.maltrato.prototype,'save').mockImplementation(async function(){guardado=this;return this;});
  jest.spyOn(models.maltrato.prototype,'populate').mockImplementation(async function(){return this;});
  const file=archivo(Buffer.from(await wb.xlsx.writeBuffer()));
  const preview:any=await importarMasivo(models.maltrato,'maltrato',file,options,usuario);
  expect(preview.resumen).toMatchObject({casos:1,listos:1});expect(preview.casos[0].filas).toEqual([3]);
  await importarMasivo(models.maltrato,'maltrato',file,{...options,accion:'importar',huella:preview.huella},usuario);
  expect(guardado.fechaIngreso.toISOString().slice(0,10)).toBe('2026-01-01');
},30000);
it('rechaza filas fuera del límite antes de acumular la hoja completa',async()=>{
  const wb=new Workbook();const sh=wb.addWorksheet('Datos');sh.addRow(maltratoHeaders);sh.getCell(5031,1).value='Fuera de límite';
  await expect(importarMasivo(models.maltrato,'maltrato',archivo(Buffer.from(await wb.xlsx.writeBuffer())),options,usuario)).rejects.toMatchObject({status:400});
},30000);
it('lee columnas reordenadas y rechaza DEIC de otro tipo',async()=>{
  const headers=['CASO INTERNO',maltratoHeaders[12],'EDAD'];
  const r:any=await importarMasivo(models.maltrato,'maltrato',await libro([['DEIC51-2026-01-01-2','PRUEBA',0]],headers),options,usuario);expect(r.resumen.listos).toBe(1);
  const bad:any=await importarMasivo(models.maltrato,'maltrato',await libro([['DEIC52-2026-01-01-2','PRUEBA',0]],headers),options,usuario);expect(bad.resumen.errores).toBe(1);
});
it('cubre todos los campos exportados en la misma columna de referencia',()=>{
  // Los valores señuelo hacen visible cualquier desplazamiento entre el exportador y el mapa.
  const sentinela:any=new Proxy({}, {get:(_,key)=>key==='fechaDesaparicion'||String(key).startsWith('fecha')?undefined:'valor-'+String(key)});
  const persona:any=new Proxy({nombre:'PERSONA',edadReportada:12},{get:(o,k)=>k==='fecha_Nac'?undefined:k in o?o[k]:'persona-'+String(k)});
  const casos:any={numeroDeic:'DEIC51-2026-01-01-1',numeroMp:'MP001-2026-1',nombreDesaparecido:'PRUEBA',fichaAlerta:sentinela,fichaMaltrato:sentinela,fichaConflicto:sentinela,victimas:[persona],infractores:[persona],direccion:{},lugarHechos:{},investigadorOriginal:{nombre:'INVESTIGADOR'}};
  for(const [tipo,headers,values] of [['alerta',alertaHeaders.DESAPARECIDOS,filaDesaparecido(casos,1)],['maltrato',maltratoHeaders,filasMaltrato(casos)[0]],['conflicto',conflictoHeaders,filasConflicto(casos)[0]]] as any[]) {
    const mapa=detectarMapa(tipo,headers)!;
    for(const {columna,campo} of mapa.paths)if(campo.startsWith('ficha') && !campo.split('.').pop().startsWith('fecha'))expect(values[columna]).toBe('valor-'+campo.split('.').pop());
  }
});

const fuentes=[
  ['alerta','F:/SERVIDOR/BASES 2026/1. 52 AKK/2. BASE DE PERSONAS DESAPARECIDAS Y LOCALIZADAS.xlsx'],
  ['maltrato','F:/SERVIDOR/BASES 2026/2. 51 MT/15. MALTRATO 2026.xlsx'],
  ['conflicto','F:/SERVIDOR/BASES 2026/3. BDD CONFLICTO/DEIC53-2026.xlsx'],
] as const;
for(const [tipo,path] of fuentes)(existsSync(path)?it:it.skip)(`revisa el Excel real de ${tipo} sin persistir ni mostrar datos personales`,async()=>{
  const consultaUsuarios={find:()=>({select:()=>({lean:()=>({exec:async()=>[]})})})};
  jest.spyOn(models[tipo].db,'model').mockReturnValue(consultaUsuarios as any);
  const file=archivo(readFileSync(path));
  const listado:any=await importarMasivo(models[tipo],tipo,file,{...options,hoja:undefined},usuario);
  expect(listado.hojas.length).toBeGreaterThan(0);
  for(const hoja of listado.hojas) {
    const r:any=await importarMasivo(models[tipo],tipo,file,{...options,hoja},usuario);
    expect(r.resumen.casos).toBeGreaterThan(0);
    console.log(JSON.stringify({tipo,hoja,...r.resumen,camposConErrores:[...new Set(r.casos.flatMap((c:any)=>c.errores))].slice(0,8)}));
  }
},60000);
