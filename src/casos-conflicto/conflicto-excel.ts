import { Workbook } from 'exceljs';
import headers = require('./conflicto-excel-encabezados.json');

const fecha=(v:any):Date|null=>{
  if(!v)return null;const d=new Date(v);
  return Number.isNaN(d.getTime())?null:new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()));
};
const diferencia=(a:any,b:any)=>{const desde=fecha(a),hasta=fecha(b);return desde && hasta && hasta>=desde?Math.round((hasta.getTime()-desde.getTime())/86400000):null;};
const valor=(v:any)=>v==null?'':v;
export function edadConflicto(v:any,ingreso:any):number|null {
  const nacimiento=fecha(v.fecha_Nac),recepcion=fecha(ingreso);
  if(nacimiento && recepcion){
    const edad=recepcion.getUTCFullYear()-nacimiento.getUTCFullYear()-Number(recepcion.getUTCMonth()<nacimiento.getUTCMonth() || (recepcion.getUTCMonth()===nacimiento.getUTCMonth() && recepcion.getUTCDate()<nacimiento.getUTCDate()));
    return edad>=0?edad:null;
  }
  return v.edadReportada??null;
}
function datosInfractor(p:any,ingreso:any,segundo=false):any[] {
  if(!p)return Array(12).fill('');
  const edad=edadConflicto(p,ingreso);
  // La referencia invierte el orden de alias y sexo en el segundo bloque.
  return [p.nombre,edad,...(segundo?[p.sexo,p.alias]:[p.alias,p.sexo]),p.cui,p.direccion,fecha(p.fecha_Nac),edad==null?'':edad<18?'MENOR':'MAYOR',p.ocupacion,p.nombrePadre,p.nombreMadre,p.estadoFisico].map(valor);
}
export function filasConflicto(c:any,ordenInicial=1):any[][] {
  const f=c.fichaConflicto||{},infractores=c.infractores||[],victimas=c.victimas||[],lugar=c.lugarHechos||{};
  const unir=(key:string)=>victimas.map((p:any)=>p[key]||'Sin indicar').join('\n');
  const ingreso=fecha(c.fechaIngreso);
  const mes=ingreso?['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'][ingreso.getUTCMonth()]:'';
  const investigador=c.investigadorAsignado?.nombre||c.investigadorOriginal?.nombre||c.investigadorOriginal?.usuarioId?.nombre;
  const filas:any[][]=[];
  for(let i=0;i<Math.max(infractores.length,1);i+=2){
    const principal=i===0;
    filas.push([ordenInicial+i/2,c.numeroDeic,ingreso,mes,f.seccionConoce,f.hechoInvestigar,investigador,fecha(f.fechaAsignacion),f.institucionRemitente,f.procedencia,f.tipoDocumento,c.numeroMp,fecha(f.fechaDocumento),f.emplazamiento,f.firmanteNombre,f.firmanteCargo,unir('nombre'),unir('telefono'),unir('direccion'),fecha(f.fechaPrimerInforme),f.lineamientosMp,principal?diferencia(f.fechaAsignacion,f.fechaPrimerInforme):null,principal?f.folios:null,c.estadoInvestigacion,f.resenaHecho,f.movilHecho,f.modusOperandi,f.hipotesisHecho,fecha(f.fechaHecho),f.horaHecho,f.lugarHecho,lugar.direccionDetallada,f.lugarDetencion,lugar.departamento,lugar.municipio,f.aldeaColoniaBarrio,f.zonaHecho,f.demarcacionComisaria,(c.fileUrls||[]).join('\n'),...datosInfractor(infractores[i],c.fechaIngreso),...datosInfractor(infractores[i+1],c.fechaIngreso,true),f.tipoVehiculo,f.tipoPlacas,f.numeroPlacas,f.tipoAtencion,principal?f.entrevistas:null,f.vistoBueno,f.clasificacionCaso,fecha(f.fechaEntregaAnalisis),principal?diferencia(f.fechaPrimerInforme,f.fechaEntregaAnalisis):null,f.observaciones,f.columnaAdicional].map(valor));
  }
  return filas;
}
export async function generarExcelConflictos(casos:any[]):Promise<Buffer> {
  const wb=new Workbook();wb.creator='SGIC';
  const sheet=wb.addWorksheet('DEIC53',{views:[{state:'frozen',ySplit:1}]});sheet.addRow(headers);
  sheet.getRow(1).height=100;
  sheet.getRow(1).eachCell(cell=>{cell.font={bold:true,color:{argb:'FFFFFFFF'},size:10};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF1E3A5F'}};cell.alignment={wrapText:true,vertical:'middle',horizontal:'center'};});
  sheet.columns.forEach((col,i)=>col.width=headers[i].length>50?42:headers[i].length>25?32:24);
  let orden=1;
  for(const c of casos){const filas=filasConflicto(c,orden);filas.forEach(row=>sheet.addRow(row));orden+=filas.length;}
  sheet.autoFilter={from:{row:1,column:1},to:{row:sheet.rowCount,column:headers.length}};
  sheet.eachRow((row,n)=>{if(n===1)return;row.alignment={wrapText:true,vertical:'top'};row.eachCell(cell=>{if(cell.value instanceof Date)cell.numFmt='dd/mm/yyyy';});});
  return Buffer.from(await wb.xlsx.writeBuffer());
}
