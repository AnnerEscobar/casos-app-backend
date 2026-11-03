import { BadRequestException, ConflictException, ForbiddenException, HttpException } from '@nestjs/common';
import { Workbook } from 'exceljs';
import { createHash } from 'crypto';
import { Model } from 'mongoose';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { TextDecoder } from 'util';
import { TipoCasoNumero, assertValidCaseNumber, assertValidAlertaMpNumber, assertValidMaltratoMpNumber, assertValidConflictoMpNumber, normalizeCaseNumber } from './case-number.validator';
import { incorporarHistorico, UsuarioSesion } from './historicos/caso-historico.service';
import { EstadoExpedienteHistorico, FuenteInformacionHistorica, OrigenCaso } from './historicos/caso-historico.schema';
import { UserRole } from '../auth/enums/user-role.enum';
import { detectarMapa } from './importacion-masiva-mapeo';
import { FichaAlertaDto } from '../casos-alerta/dto/ficha-alerta.dto';
import { FichaMaltratoDto } from '../casos-maltrato/dto/ficha-maltrato.dto';
import { FichaConflictoDto } from '../casos-conflicto/dto/ficha-conflicto.dto';

export class ImportacionMasivaDto {
  @IsIn(['vista-previa','importar']) accion: string;
  @IsOptional() @IsString() @MaxLength(100) hoja?: string;
  @IsOptional() @Matches(/^[a-f0-9]{64}$/) huella?: string;
  // Un registro en Excel no acredita la existencia del expediente físico.
  @IsIn(['PARCIAL','NO_LOCALIZADO']) estadoExpedienteHistorico: EstadoExpedienteHistorico;
}
type Tabla = { nombre: string; filas: any[][]; date1904?: boolean };
type Grupo = { datos: any; filas: number[]; errores: string[]; originales: any[]; estado: string };
export const LIMITE_ARCHIVO_IMPORTACION = 5 * 1024 * 1024;
const MAX_FILAS = 5000, MAX_COLUMNAS = 250;
const presente = (v: any) => v !== undefined && v !== null && v !== '';
function valorCelda(v: any): any {
  if (v === null || v === undefined) return '';
  if (v instanceof Date || typeof v !== 'object') return v;
  if (v.error) return { error: String(v.error) };
  if ('formula' in v || 'sharedFormula' in v) return valorCelda(v.result); // Nunca ejecutar fórmulas.
  if (v.richText) return v.richText.map((t: any)=>t.text).join('');
  return v.text || '';
}

export function leerTexto(texto: string): any[][] {
  texto = texto.replace(/^\uFEFF/,'');
  const linea = texto.split(/\r?\n/)[0];
  const separador = ['\t',';',','].sort((a,b)=>linea.split(b).length-linea.split(a).length)[0];
  const filas: string[][] = []; let fila: string[] = [], celda = '', comillas = false;
  for (let i=0;i<texto.length;i++) {
    const ch=texto[i];
    if (ch === '"') {
      if (comillas && texto[i+1] === '"') { celda+='"'; i++; }
      else if (comillas || !celda) comillas=!comillas;
      else throw new BadRequestException('Comillas inválidas en el texto. Exporta nuevamente como CSV UTF-8.');
    } else if (ch===separador && !comillas) {fila.push(celda);celda='';}
    else if ((ch==='\n' || ch==='\r') && !comillas) {
      if(ch==='\r' && texto[i+1]==='\n')i++;
      fila.push(celda);filas.push(fila);fila=[];celda='';
    } else celda+=ch;
    if(filas.length>MAX_FILAS+30 || fila.length>MAX_COLUMNAS || celda.length>10000)throw new BadRequestException('El archivo supera 5,000 filas, 250 columnas o 10,000 caracteres por celda.');
  }
  if(comillas)throw new BadRequestException('El texto tiene comillas sin cerrar.');
  if(celda || fila.length){fila.push(celda);filas.push(fila);}
  return filas;
}
// Comprueba el tamaño descomprimido declarado antes de entregar el ZIP a ExcelJS.
function validarZip(buffer: Buffer) {
  let fin=-1;
  for(let i=buffer.length-22;i>=Math.max(0,buffer.length-65557);i--)if(buffer.readUInt32LE(i)===0x06054b50){fin=i;break;}
  if(fin<0)throw new BadRequestException('El archivo no es un XLSX válido.');
  const entradas=buffer.readUInt16LE(fin+10);let posicion=buffer.readUInt32LE(fin+16),total=0;
  if(entradas>2000)throw new BadRequestException('El Excel contiene demasiados elementos.');
  for(let i=0;i<entradas;i++) {
    if(posicion+46>buffer.length || buffer.readUInt32LE(posicion)!==0x02014b50)throw new BadRequestException('Estructura XLSX inválida.');
    total+=buffer.readUInt32LE(posicion+24);
    if(total>40*1024*1024)throw new BadRequestException('El contenido descomprimido del Excel supera 40 MB.');
    posicion+=46+buffer.readUInt16LE(posicion+28)+buffer.readUInt16LE(posicion+30)+buffer.readUInt16LE(posicion+32);
  }
}
async function tablasArchivo(file: Express.Multer.File): Promise<Tabla[]> {
  if(!file?.buffer?.length)throw new BadRequestException('Selecciona un archivo.');
  if(file.size>LIMITE_ARCHIVO_IMPORTACION || file.buffer.length>LIMITE_ARCHIVO_IMPORTACION)throw new BadRequestException('El archivo supera 5 MB.');
  const extension=file.originalname.toLowerCase().split('.').pop();
  if(['csv','tsv','txt'].includes(extension)) {
    let texto:string;
    try {texto=new TextDecoder('utf-8',{fatal:true}).decode(file.buffer);}catch {throw new BadRequestException('Guarda el texto como UTF-8 para conservar tildes y nombres.');}
    return [{nombre:'Texto',filas:leerTexto(texto)}];
  }
  if(extension!=='xlsx')throw new BadRequestException('Usa XLSX, CSV, TSV o TXT tabulado; convierte los XLS antiguos a XLSX.');
  validarZip(file.buffer);
  const wb=new Workbook();
  try {await wb.xlsx.load(file.buffer as any);}catch {throw new BadRequestException('No se pudo leer el Excel. Verifica que sea XLSX y no esté protegido.');}
  return wb.worksheets.map(s=>{
    if(s.rowCount>MAX_FILAS+30 || s.columnCount>MAX_COLUMNAS) return {nombre:s.name,filas:[]};
    const filas:any[][]=[];
    s.eachRow({includeEmpty:true},row=>filas.push(Array.from({length:s.columnCount},(_,i)=>valorCelda(row.getCell(i+1).value))));
    return {nombre:s.name,filas,date1904:!!wb.properties.date1904};
  });
}
export function fechaImportada(value: any, date1904=false): string {
  let d: Date;
  if(value instanceof Date)d=value;
  else if(typeof value==='number') {
    if(value<1 || value>2958465 || !Number.isInteger(value))throw new Error('Fecha serial de Excel inválida');
    d=new Date(Date.UTC(date1904?1904:1899,date1904?0:11,date1904?1:30)+value*86400000);
  } else {
    const s=String(value).trim();let y:number,m:number,dia:number;
    let match=/^(\d{4})-(\d{2})-(\d{2})(?:T00:00:00(?:\.000)?Z)?$/.exec(s);
    if(match){y=+match[1];m=+match[2];dia=+match[3];}
    else {match=/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(s);if(!match)throw new Error('Usa fecha dd/mm/aaaa o aaaa-mm-dd');dia=+match[1];m=+match[2];y=+match[3];}
    d=new Date(Date.UTC(y,m-1,dia));
    if(d.getUTCFullYear()!==y || d.getUTCMonth()!==m-1 || d.getUTCDate()!==dia)throw new Error('Fecha inexistente');
  }
  if(!Number.isFinite(d.getTime()) || d.getUTCFullYear()<1900 || d.getUTCFullYear()>2100)throw new Error('Fecha fuera del rango 1900–2100');
  return d.toISOString().slice(0,10);
}
function convertir(value:any,path:string,date1904:boolean) {
  if(value?.error)throw new Error('La celda contiene un error de Excel: '+value.error);
  const key=path.split('.').pop();
  if(key.startsWith('fecha'))return fechaImportada(value,date1904);
  if(key.startsWith('hora')) {
    if(value instanceof Date)return value.toISOString().slice(11,16);
    if(typeof value==='number' && value>=0 && value<1){const n=Math.round(value*1440)%1440;return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;}
    const t=String(value).trim();if(!/^([01]?\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(t))throw new Error('Hora inválida; usa HH:mm');
    return t.split(':').slice(0,2).map(x=>x.padStart(2,'0')).join(':');
  }
  if(/^(edadReportada|camaras|videos|fotogramas|inmuebles|allanamientos|solvencias|perfilaciones|aprehensiones|fichas|incautado|entrevistas|folios)/.test(key)) {
    const n=Number(value);if(!Number.isInteger(n)||n<0||n>(key==='edadReportada'?130:1000000))throw new Error('Cantidad inválida; debe ser un entero no negativo');return n;
  }
  const s=String(value).trim();if(s.length>10000)throw new Error('El texto supera 10,000 caracteres');return s;
}
function asignar(obj:any,path:string,value:any) {
  const keys=path.split('.');let o=obj;
  keys.forEach((k,i)=>{if(i===keys.length-1)o[k]=value;else o=o[k]??=(/^\d+$/.test(keys[i+1])?[]:{});});
}
function mezclar(dest:any,src:any,path='',errores:string[]=[]) {
  for(const [key,value] of Object.entries(src)) {
    const p=path?`${path}.${key}`:key;
    if(Array.isArray(value)) {
      const arr=dest[key]??=[];
      for(const persona of value.filter(Boolean))if(!arr.some((x:any)=>JSON.stringify(x)===JSON.stringify(persona)))arr.push(persona);
      if(arr.length>100)errores.push(`${p}: más de 100 personas por caso.`);
    } else if(value && typeof value==='object')mezclar(dest[key]??={},value,p,errores);
    else if(!presente(dest[key]))dest[key]=value;
    else if(dest[key]!==value)errores.push(`Las filas del mismo DEIC difieren en ${p}; unifica ese dato en el archivo.`);
  }
}
const mensaje=(e:any)=>e instanceof HttpException ? (e.getResponse() as any)?.message || e.message : e?.name==='ValidationError' ? 'Datos inválidos: '+Object.keys(e.errors).join(', ') : 'No se pudo guardar. Revisa la conexión y vuelve a previsualizar el archivo.';
const bloqueos = new Set<string>();

export async function importarMasivo(model:Model<any>,tipo:TipoCasoNumero,file:Express.Multer.File,dto:ImportacionMasivaDto,usuario:UsuarioSesion) {
  if(usuario.role!==UserRole.ANALISTA)throw new ForbiddenException('Solo el analista puede realizar cargas masivas.');
  if(!['vista-previa','importar'].includes(dto.accion) || !['PARCIAL','NO_LOCALIZADO'].includes(dto.estadoExpedienteHistorico))throw new BadRequestException('Acción o estado documental inválidos.');
  const tablas=await tablasArchivo(file);
  const candidatas=tablas.map(t=>{
    const inicio=t.filas.slice(0,30).findIndex(row=>detectarMapa(tipo,row.map(String))!==null);
    return {...t,inicio};
  }).filter(t=>t.inicio>=0);
  const hojas=candidatas.map(t=>t.nombre);
  if(!hojas.length)throw new BadRequestException('No se encontró una hoja compatible. Conserva los encabezados de la base y usa archivos de hasta 5,000 filas y 250 columnas.');
  if(!dto.hoja)return {hojas};
  const tabla=candidatas.find(t=>t.nombre===dto.hoja);
  if(!tabla)throw new BadRequestException('Selecciona una hoja de datos compatible. Los catálogos y resúmenes no se importan.');
  const huella=createHash('sha256').update(file.buffer).update(JSON.stringify([tipo,dto.hoja,dto.estadoExpedienteHistorico])).digest('hex');
  if(dto.accion==='importar' && dto.huella!==huella)throw new ConflictException('El archivo o las opciones cambiaron. Genera otra vista previa.');
  const cabeceras=tabla.filas[tabla.inicio].map(String),mapa=detectarMapa(tipo,cabeceras)!;
  const grupos=new Map<string,Grupo>();
  for(let i=tabla.inicio+1;i<tabla.filas.length;i++) {
    const row=tabla.filas[i];
    if(!row.some(presente))continue;
    const datos:any={},errores:string[]=[];
    for(const p of mapa.paths) {
      const value=row[p.columna];if(!presente(value) || String(value).trim()==='')continue;
      try {asignar(datos,p.campo,convertir(value,p.campo,!!tabla.date1904));}
      catch(e){errores.push(`${cabeceras[p.columna]}: ${e.message}`);}
    }
    try {datos.numeroDeic=assertValidCaseNumber(tipo,datos.numeroDeic);}catch(e){errores.push(String(mensaje(e)));}
    if(datos.numeroMp)try {datos.numeroMp={alerta:assertValidAlertaMpNumber,maltrato:assertValidMaltratoMpNumber,conflicto:assertValidConflictoMpNumber}[tipo](datos.numeroMp);}catch(e){errores.push(String(mensaje(e)));}
    if(datos.numeroAlerta){datos.numeroAlerta=normalizeCaseNumber(datos.numeroAlerta);if(!/^\d+-\d{4}$/.test(datos.numeroAlerta))errores.push('Número de alerta inválido. Usa NNN-AAAA.');}
    const key=datos.numeroDeic || `FILA ${i+1}`;
    const grupo=grupos.get(key) || {datos:{},filas:[],errores:[],originales:[],estado:'listo'};
    if(tipo==='alerta' && grupo.filas.length)errores.push('DEIC repetido en la hoja de alertas. Revisa las filas antes de importar.');
    mezclar(grupo.datos,datos,'',errores);
    grupo.filas.push(i+1);grupo.errores.push(...errores);
    grupo.originales.push({fila:i+1,celdas:row.map((v,j)=>presente(v)?{columna:j+1,encabezado:cabeceras[j]||'',valor:v}:null).filter(Boolean)});
    grupos.set(key,grupo);
  }
  if(tabla.filas.length-tabla.inicio-1>MAX_FILAS)throw new BadRequestException('Divide el archivo en lotes de hasta 5,000 filas.');
  const lock=tipo; // Serializa confirmaciones dentro de este proceso; los índices cubren otros procesos.
  if(dto.accion==='importar' && bloqueos.has(lock))throw new ConflictException('Hay otra carga en curso. Espera a que termine y vuelve a previsualizar.');
  if(dto.accion==='importar')bloqueos.add(lock);
  try {
    const vistosMp=new Set<string>(),vistosAlerta=new Set<string>();
    for(const g of grupos.values()) {
      const d=g.datos;
      d.origenCaso=OrigenCaso.HISTORICO;d.estadoExpedienteHistorico=dto.estadoExpedienteHistorico;d.fuenteInformacionHistorica=FuenteInformacionHistorica.REGISTRO_EXCEL;
      d.anioCaso=/^DEIC\d+-(\d{4})/.exec(d.numeroDeic||'')?.[1];
      // Guarda los datos de origen, incluso las columnas calculadas/no mapeadas, sin ejecutarlos.
      d.importacionOrigen={archivo:file.originalname,hoja:dto.hoja,huella,filas:g.originales};
      d.observacionHistorica=`Carga masiva desde ${file.originalname}; hoja ${dto.hoja}; filas ${g.filas.join(', ')}. Sin PDF adjunto.`;
      if(Buffer.byteLength(JSON.stringify(d.importacionOrigen))>500000)g.errores.push('El caso supera 500 KB de datos de origen. Divide o revisa sus filas.');
      const fichaKey={alerta:'fichaAlerta',maltrato:'fichaMaltrato',conflicto:'fichaConflicto'}[tipo];
      const cls:any={alerta:FichaAlertaDto,maltrato:FichaMaltratoDto,conflicto:FichaConflictoDto}[tipo];
      const validacion=await validate(plainToInstance(cls,d[fichaKey]||{}),{whitelist:true,forbidNonWhitelisted:true});
      if(validacion.length)g.errores.push('Revisa los campos: '+validacion.map(e=>e.property).join(', '));
      try {await new model(d).validate();}catch(e){g.errores.push(String(mensaje(e)));}
      if(tipo==='alerta')for(const [campo,vistos] of [['numeroMp',vistosMp],['numeroAlerta',vistosAlerta]] as const) {
        if(d[campo] && vistos.has(d[campo]))g.errores.push(`${campo} repetido en otro caso del archivo.`);
        if(d[campo])vistos.add(d[campo]);
      }
      if(g.errores.length){g.estado='error';continue;}
      const ids:any[]=[{numeroDeic:d.numeroDeic}];
      if(tipo==='alerta'){if(d.numeroMp)ids.push({numeroMp:d.numeroMp});if(d.numeroAlerta)ids.push({numeroAlerta:d.numeroAlerta});}
      if(await model.exists({$or:ids})){g.estado='existente';continue;}
      if(dto.accion==='importar') {
        try {await incorporarHistorico(model,tipo,d,d,usuario);g.estado='importado';}
        catch(e){if(e instanceof ConflictException)g.estado='existente';else {g.estado='error';g.errores.push(String(mensaje(e)));}}
      }
    }
    const casos=[...grupos.values()].map(g=>({numeroDeic:g.datos.numeroDeic||'',filas:g.filas,estado:g.estado,errores:[...new Set(g.errores)],victimas:g.datos.victimas?.length||0,infractores:g.datos.infractores?.length||0,nombre:g.datos.nombreDesaparecido||g.datos.victimas?.map((v:any)=>v.nombre).filter(Boolean).join(' / ')||g.datos.infractores?.map((v:any)=>v.nombre).filter(Boolean).join(' / ')||'',investigador:g.datos.investigadorOriginal?.nombre||''}));
    return {hojas,hoja:dto.hoja,huella,casos,columnasSinMapear:mapa.noMapeadas,resumen:{filas:casos.reduce((n,c)=>n+c.filas.length,0),casos:casos.length,listos:casos.filter(c=>c.estado==='listo').length,importados:casos.filter(c=>c.estado==='importado').length,existentes:casos.filter(c=>c.estado==='existente').length,errores:casos.filter(c=>c.estado==='error').length}};
  } finally {if(dto.accion==='importar')bloqueos.delete(lock);}
}
