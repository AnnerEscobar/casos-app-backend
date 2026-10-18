import { Workbook, Worksheet } from 'exceljs';
import encabezados = require('./alerta-excel-encabezados.json');

const dias = ['DOMINGO','LUNES','MARTES','MIÉRCOLES','JUEVES','VIERNES','SÁBADO'];
const meses = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
const fecha = (value: any): Date | undefined => {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()));
};
const nombre = (value: any) => value?.nombre || '';
const diferencia = (a: any,b: any) => a && b ? Math.floor((new Date(b).getTime()-new Date(a).getTime())/86400000) : undefined;
const valor = (v: any) => v === undefined || v === null ? '' : v;
function conLocalizacionActual(caso:any) {
  const c={...caso};
  for(const seguimiento of caso.seguimientos || []) {
    for(const campo of ['fechaLocalizacion','horaLocalizacion','direccionLocalizacion','nombreAcompanante','telefono']) {
      if(seguimiento[campo]!=null && seguimiento[campo]!=='') c[campo]=seguimiento[campo];
    }
  }
  return c;
}

export function filaDesaparecido(c: any, orden: number): any[] {
  const f = c.fichaAlerta || {};
  const ingreso = fecha(c.fechaIngreso); // No se sustituye por createdAt: no representa la recepción.
  const desaparicion = fecha(f.fechaDesaparicion);
  const nacimiento = fecha(c.fecha_Nac);
  let edad = f.edadReportada;
  if (edad == null && nacimiento && ingreso) {
    edad = ingreso.getUTCFullYear()-nacimiento.getUTCFullYear();
    if (ingreso.getUTCMonth()<nacimiento.getUTCMonth() || (ingreso.getUTCMonth()===nacimiento.getUTCMonth() && ingreso.getUTCDate()<nacimiento.getUTCDate())) edad--;
    if (edad<0) edad=undefined;
  }
  const horas = f.fechaDesaparicion && c.fechaLocalizacion
    ? (new Date(`${new Date(c.fechaLocalizacion).toISOString().slice(0,10)}T${c.horaLocalizacion || '00:00'}:00Z`).getTime()-new Date(`${new Date(f.fechaDesaparicion).toISOString().slice(0,10)}T${f.horaDesaparicion || '00:00'}:00Z`).getTime())/3600000 : undefined;
  // Sin las dos horas no se inventa un plazo de localización.
  const plazo = horas == null || !c.horaLocalizacion || !f.horaDesaparicion || horas<0 ? '' : horas<=6 ? '0 A 6 HORAS' : horas<=24 ? '7 A 24 HORAS' : horas<=48 ? '25 A 48 HORAS' : horas<=72 ? '49 A 72 HORAS' : 'MÁS DE 72 HORAS';
  const rango = edad == null ? '' : edad<=12 ? '0-12' : edad<=17 ? '13-17' : '18 O MÁS';
  const investigador = nombre(c.investigadorAsignado) || nombre(c.investigadorOriginal?.usuarioId) || c.investigadorOriginal?.nombre || '';
  const counts = ['camarasUbicadas','camarasSolicitadas','videosExtraidos','fotogramas','inmueblesUbicados','allanamientosSolicitados','allanamientosEjecutados','allanamientosNoAutorizados','solvenciasPersonas','perfilacionesPersonas','aprehensionesSolicitadas','aprehensionesEjecutadas','aprehensionesNoAutorizadas','solvenciasVehiculos','fichasVehiculos','incautado','entrevistas'].map(k=>f[k]);
  return [orden,f.delegacion,c.numeroDeic,c.numeroMp,ingreso,ingreso && dias[ingreso.getUTCDay()],ingreso && meses[ingreso.getUTCMonth()],c.numeroAlerta,f.tipoAlerta,c.nombreDesaparecido,nacimiento,edad,edad==null?'':edad<18?'MENOR':'MAYOR',f.sexo,f.etnia,f.comunidadLgbtiq,f.discapacidad,f.nacionalidad,f.profesion,f.caracteristicasFisicas,f.vestimenta,f.presuntoResponsable,f.relacionResponsable,desaparicion,desaparicion && dias[desaparicion.getUTCDay()],desaparicion && meses[desaparicion.getUTCMonth()],desaparicion?.getUTCFullYear(),f.horaDesaparicion,f.referenciaLugar,c.direccion?.direccionDetallada,f.sector,f.zonaDesaparicion,c.direccion?.departamento,c.direccion?.municipio,f.tipoLugar,f.motivoDesaparicion,f.estatusLocalizacion,plazo,f.unidadLocalizo,f.institucionLocalizo,f.condicionLocalizacion,f.causaFallecimiento,f.resenaDesaparicion,fecha(f.fechaInformado),f.numeroOficio,c.estadoInvestigacion,f.clasificacionCaso,f.situacionAlerta,f.observaciones,investigador,f.observacionesAnalista,rango,...counts,fecha(f.fechaDesactivacion),fecha(f.fechaEntregaAnalisis),diferencia(c.fechaIngreso,f.fechaEntregaAnalisis),f.observacionesAdicionales].map(valor);
}

function configurar(sheet: Worksheet, headers: string[]) {
  sheet.addRow(headers);
  sheet.views = [{state:'frozen',ySplit:1,xSplit:3}];
  sheet.autoFilter = {from:{row:1,column:1},to:{row:Math.max(1,sheet.rowCount),column:headers.length}};
  sheet.getRow(1).height=88;
  sheet.getRow(1).eachCell(cell=>{
    cell.font={bold:true,color:{argb:'FFFFFFFF'},size:10};
    cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF1E3A5F'}};
    cell.alignment={wrapText:true,vertical:'middle',horizontal:'center'};
  });
  sheet.columns.forEach((col,i)=>{col.width=headers[i].length>140?58:headers[i].length>70?40:i===9?53:24;});
}

export async function generarExcelAlertas(casos: any[]): Promise<Buffer> {
  const workbook = new Workbook();
  workbook.creator='SGIC';
  const desaparecidos=workbook.addWorksheet('DESAPARECIDOS');
  const localizados=workbook.addWorksheet('LOCALIZADOS');
  configurar(desaparecidos,encabezados.DESAPARECIDOS);
  configurar(localizados,encabezados.LOCALIZADOS);
  let local=0;
  casos.forEach((caso,i)=>{
    const c=conLocalizacionActual(caso);
    const d=filaDesaparecido(c,i+1), f=c.fichaAlerta || {};
    desaparecidos.addRow(d);
    // La fecha de localización confirma el hecho; el estado de investigación no lo sustituye.
    if(c.fechaLocalizacion){
      const loc=fecha(c.fechaLocalizacion);
      localizados.addRow([++local,d[1],c.numeroDeic,c.numeroAlerta,f.tipoAlerta,c.nombreDesaparecido,d[11],d[12],f.etnia,f.sexo,f.condicionLocalizacion,f.causaFallecimiento,d[37],fecha(f.fechaDesaparicion),fecha(f.fechaDesaparicion)?.getUTCFullYear(),loc,dias[loc.getUTCDay()],meses[loc.getUTCMonth()],c.horaLocalizacion,c.direccionLocalizacion,f.zonaLocalizacion,f.departamentoLocalizacion,f.municipioLocalizacion,f.motivoDesaparicion,f.resenaLocalizacion,c.estadoInvestigacion,f.observacionesAnalista,d[49]].map(valor));
    }
  });
  for (const sheet of [desaparecidos,localizados]) {
    sheet.autoFilter={from:{row:1,column:1},to:{row:sheet.rowCount,column:sheet.getRow(1).cellCount}};
    sheet.eachRow((row,n)=>{
      if(n===1)return;
      row.alignment={wrapText:true,vertical:'top'};
      row.eachCell(cell=>{ if(cell.value instanceof Date)cell.numFmt='dd/mm/yyyy'; });
    });
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
