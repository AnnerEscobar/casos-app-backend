import { Workbook } from 'exceljs';
import headers = require('./maltrato-excel-encabezados.json');

const fecha=(v:any):Date|null=>{
  if(!v)return null;
  const d=new Date(v);return Number.isNaN(d.getTime())?null:new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()));
};
const valor=(v:any)=>v==null?'':v;
export function edadMaltrato(v:any,ingreso:any):number|null {
  const nacimiento=fecha(v.fecha_Nac),recepcion=fecha(ingreso);
  if(nacimiento && recepcion){
    const edad=recepcion.getUTCFullYear()-nacimiento.getUTCFullYear()-Number(recepcion.getUTCMonth()<nacimiento.getUTCMonth() || (recepcion.getUTCMonth()===nacimiento.getUTCMonth() && recepcion.getUTCDate()<nacimiento.getUTCDate()));
    return edad>=0?edad:null;
  }
  return v.edadReportada??null;
}
export function filasMaltrato(c:any,ordenInicial=1):any[][] {
  const f=c.fichaMaltrato||{},sindicados=c.infractores||c.sindicados||[],lugar=c.lugarHechos||{};
  const unir=(key:string)=>sindicados.map((s:any)=>s[key]||'Sin indicar').join('\n');
  const ingreso=fecha(c.fechaIngreso),entrega=fecha(f.fechaEntregaAnalisis);
  const dias=ingreso && entrega && entrega>=ingreso?Math.round((entrega.getTime()-ingreso.getTime())/86400000):null;
  const investigador=c.investigadorAsignado?.nombre||c.investigadorOriginal?.nombre||c.investigadorOriginal?.usuarioId?.nombre||c.registradoPor?.nombre;
  return (c.victimas?.length?c.victimas:[{}]).map((v:any,i:number)=>{
    const edad=edadMaltrato(v,c.fechaIngreso);
    // Diligencias y plazo son del caso: solo la primera fila lleva estas cantidades.
    const counts=['camarasUbicadas','camarasSolicitadas','camarasExtraidas','fotogramas','allanamientosSolicitados','allanamientosEjecutados','allanamientosAutorizados','aprehensionesSolicitadas','aprehensionesEjecutadas','aprehensionesAutorizadas','entrevistas'].map(k=>i===0?f[k]:null);
    return [ordenInicial+i,f.procedencia,f.tipoDocumento,c.numeroMp,c.numeroDeic,fecha(f.fechaDocumento),ingreso,f.unidadConoce,investigador,v.denuncianteNombre,v.denuncianteTelefono,v.denuncianteParentesco,v.nombre,v.etnia,edad,edad==null?'':edad<18?'MENOR':'MAYOR',v.sexo,v.nacionalidad,v.ocupacion,v.direccion,v.zona,v.municipio,v.departamento,unir('nombre'),unir('direccion'),unir('parentesco'),lugar.direccionDetallada,f.zonaHecho,lugar.municipio,lugar.departamento,fecha(f.fechaHecho),f.horaHecho,f.movilHecho,f.modusOperandi,f.circunstanciaVictima,c.estadoInvestigacion,f.logrosObtenidos,fecha(f.fechaInformadoMp),f.numeroOficioMp,f.resenaHecho,f.tipoAtencion,...counts,f.clasificacionCaso,entrega,i===0?dias:null,f.observaciones].map(valor);
  });
}
export async function generarExcelMaltratos(casos:any[]):Promise<Buffer> {
  const wb=new Workbook();wb.creator='SGIC';
  const sheet=wb.addWorksheet('MALTRATO 2026',{views:[{state:'frozen',ySplit:1}]});
  sheet.addRow(headers);
  sheet.getRow(1).height=100;
  sheet.getRow(1).eachCell(cell=>{
    cell.font={bold:true,color:{argb:'FFFFFFFF'},size:10};
    cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF1E3A5F'}};
    cell.alignment={wrapText:true,vertical:'middle',horizontal:'center'};
  });
  sheet.columns.forEach((col,i)=>col.width=headers[i].length>70?44:headers[i].length>30?32:24);
  let orden=1;
  for(const c of casos){const filas=filasMaltrato(c,orden);filas.forEach(f=>sheet.addRow(f));orden+=filas.length;}
  sheet.autoFilter={from:{row:1,column:1},to:{row:sheet.rowCount,column:headers.length}};
  sheet.eachRow((row,n)=>{if(n===1)return;row.alignment={wrapText:true,vertical:'top'};row.eachCell(cell=>{if(cell.value instanceof Date)cell.numFmt='dd/mm/yyyy';});});
  return Buffer.from(await wb.xlsx.writeBuffer());
}
