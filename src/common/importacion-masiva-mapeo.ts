import alerta = require('../casos-alerta/alerta-excel-encabezados.json');
import maltrato = require('../casos-maltrato/maltrato-excel-encabezados.json');
import conflicto = require('../casos-conflicto/conflicto-excel-encabezados.json');
import { TipoCasoNumero } from './case-number.validator';

export const normalizarCabecera = (v: string) => v.normalize('NFD').replace(/[\u0300-\u036f\u200b-\u200f\ufeff]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
// Las posiciones se refieren a los encabezados de referencia, nunca a la ubicación física
// de la columna cargada. Así se admiten columnas reordenadas y vacías intermedias.
const a = 'fichaAlerta.', m = 'fichaMaltrato.', c = 'fichaConflicto.';
const lista = (prefix: string, keys: string) => keys.split(' ').map(k => k === '-' ? '' : prefix + k);
const mapas: Record<string, string[]> = {
  alerta: ['',a+'delegacion','numeroDeic','numeroMp','fechaIngreso','','','numeroAlerta',a+'tipoAlerta','nombreDesaparecido','fecha_Nac',a+'edadReportada','',...lista(a,'sexo etnia comunidadLgbtiq discapacidad nacionalidad profesion caracteristicasFisicas vestimenta presuntoResponsable relacionResponsable fechaDesaparicion - - - horaDesaparicion referenciaLugar'),'direccion.direccionDetallada',a+'sector',a+'zonaDesaparicion','direccion.departamento','direccion.municipio',...lista(a,'tipoLugar motivoDesaparicion estatusLocalizacion - unidadLocalizo institucionLocalizo condicionLocalizacion causaFallecimiento resenaDesaparicion fechaInformado numeroOficio'),'estadoInvestigacion',...lista(a,'clasificacionCaso situacionAlerta observaciones'),'investigadorOriginal.nombre',a+'observacionesAnalista','',...lista(a,'camarasUbicadas camarasSolicitadas videosExtraidos fotogramas inmueblesUbicados allanamientosSolicitados allanamientosEjecutados allanamientosNoAutorizados solvenciasPersonas perfilacionesPersonas aprehensionesSolicitadas aprehensionesEjecutadas aprehensionesNoAutorizadas solvenciasVehiculos fichasVehiculos incautado entrevistas fechaDesactivacion fechaEntregaAnalisis - observacionesAdicionales')],
  localizados: ['',a+'delegacion','numeroDeic','numeroAlerta',a+'tipoAlerta','nombreDesaparecido',a+'edadReportada','',a+'etnia',a+'sexo',a+'condicionLocalizacion',a+'causaFallecimiento','',a+'fechaDesaparicion','','fechaLocalizacion','','','horaLocalizacion','direccionLocalizacion',a+'zonaLocalizacion',a+'departamentoLocalizacion',a+'municipioLocalizacion',a+'motivoDesaparicion',a+'resenaLocalizacion','estadoInvestigacion',a+'observacionesAnalista','investigadorOriginal.nombre'],
  maltrato: ['',m+'procedencia',m+'tipoDocumento','numeroMp','numeroDeic',m+'fechaDocumento','fechaIngreso',m+'unidadConoce','investigadorOriginal.nombre','victimas.0.denuncianteNombre','victimas.0.denuncianteTelefono','victimas.0.denuncianteParentesco','victimas.0.nombre','victimas.0.etnia','victimas.0.edadReportada','','victimas.0.sexo','victimas.0.nacionalidad','victimas.0.ocupacion','victimas.0.direccion','victimas.0.zona','victimas.0.municipio','victimas.0.departamento','infractores.0.nombre','infractores.0.direccion','infractores.0.parentesco','lugarHechos.direccionDetallada',m+'zonaHecho','lugarHechos.municipio','lugarHechos.departamento',m+'fechaHecho',m+'horaHecho',m+'movilHecho',m+'modusOperandi',m+'circunstanciaVictima','estadoInvestigacion',...lista(m,'logrosObtenidos fechaInformadoMp numeroOficioMp resenaHecho tipoAtencion camarasUbicadas camarasSolicitadas camarasExtraidas fotogramas allanamientosSolicitados allanamientosEjecutados allanamientosAutorizados aprehensionesSolicitadas aprehensionesEjecutadas aprehensionesAutorizadas entrevistas clasificacionCaso fechaEntregaAnalisis - observaciones')],
  conflicto: ['','numeroDeic','fechaIngreso','',...lista(c,'seccionConoce hechoInvestigar'),'investigadorOriginal.nombre',...lista(c,'fechaAsignacion institucionRemitente procedencia tipoDocumento'),'numeroMp',...lista(c,'fechaDocumento emplazamiento firmanteNombre firmanteCargo'),'victimas.0.nombre','victimas.0.telefono','victimas.0.direccion',...lista(c,'fechaPrimerInforme lineamientosMp - folios'),'estadoInvestigacion',...lista(c,'resenaHecho movilHecho modusOperandi hipotesisHecho fechaHecho horaHecho lugarHecho'),'lugarHechos.direccionDetallada',c+'lugarDetencion','lugarHechos.departamento','lugarHechos.municipio',...lista(c,'aldeaColoniaBarrio zonaHecho demarcacionComisaria'),' ',...lista('infractores.0.','nombre edadReportada alias sexo cui direccion fecha_Nac - ocupacion nombrePadre nombreMadre estadoFisico'),...lista('infractores.1.','nombre edadReportada sexo alias cui direccion fecha_Nac - ocupacion nombrePadre nombreMadre estadoFisico'),...lista(c,'tipoVehiculo tipoPlacas numeroPlacas tipoAtencion entrevistas vistoBueno clasificacionCaso fechaEntregaAnalisis - observaciones columnaAdicional')],
};
export function detectarMapa(tipo: TipoCasoNumero, headers: string[]) {
  const normas = headers.map(normalizarCabecera);
  const local = tipo === 'alerta' && normas.includes(normalizarCabecera('FECHA DE LOCALIZADO'));
  const referencia: string[] = tipo === 'alerta' ? alerta[local ? 'LOCALIZADOS' : 'DESAPARECIDOS'] : tipo === 'maltrato' ? maltrato : conflicto;
  const campos = mapas[local ? 'localizados' : tipo];
  const ocurrencias = new Map<string, number>();
  const usados = new Set<number>();
  const paths = referencia.map((h, i) => {
    const key = normalizarCabecera(h), ocurrencia = ocurrencias.get(key) || 0;
    ocurrencias.set(key, ocurrencia + 1);
    let indices = normas.flatMap((x,j)=>x === key ? [j] : []);
    // Excel agrega "2" al segundo encabezado repetido de una tabla.
    if (!indices[ocurrencia] && ocurrencia > 0) indices = [...indices, ...normas.flatMap((x,j)=>x === key + (ocurrencia+1) ? [j] : [])];
    const col = indices[ocurrencia];
    if (col === undefined || !campos[i]?.trim()) return null;
    usados.add(col);
    return { columna: col, campo: campos[i] };
  }).filter((x): x is {columna:number;campo:string} => !!x);
  if (!paths.some(p => p.campo === 'numeroDeic')) return null;
  return { paths, noMapeadas: headers.filter((h,i)=>h && !usados.has(i)), local };
}
