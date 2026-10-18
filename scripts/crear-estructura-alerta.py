"""Extrae únicamente encabezados del archivo de referencia; no copia expedientes."""
import json
from pathlib import Path
import openpyxl

root = Path(__file__).resolve().parents[2]
backend = root / 'casos-app-backend/src/casos-alerta'
frontend = root / 'casos-app/src/app/casos/alerta-gestion'
frontend.mkdir(exist_ok=True)
w = openpyxl.load_workbook(r'F:/SERVIDOR/BASES 2026/1. 52 AKK/2. BASE DE PERSONAS DESAPARECIDAS Y LOCALIZADAS.xlsx', read_only=True, data_only=True)
headers = {n: [v or '' for v in next(w[n].iter_rows(max_row=1, values_only=True))] for n in ['DESAPARECIDOS', 'LOCALIZADOS']}
for values in headers.values():
    while values and not values[-1]: values.pop()
(backend / 'alerta-excel-encabezados.json').write_text(json.dumps(headers, ensure_ascii=False, indent=2), encoding='utf-8')
# Campo, etiqueta, tipo, sección. Los estados del sistema se mantienen independientes.
fields = [
 ('delegacion','Delegación o departamento','text','Recepción'),
 ('tipoAlerta','Tipo de alerta','text','Recepción'),
 ('edadReportada','Edad al recibir el caso','number','Persona desaparecida'),
 ('sexo','Sexo','text','Persona desaparecida'), ('etnia','Etnia','text','Persona desaparecida'),
 ('comunidadLgbtiq','Pertenencia a comunidad LGBTIQ+ (si consta)','text','Persona desaparecida'),
 ('discapacidad','Discapacidad (si consta)','text','Persona desaparecida'),
 ('nacionalidad','Nacionalidad','text','Persona desaparecida'), ('profesion','Profesión','text','Persona desaparecida'),
 ('caracteristicasFisicas','Características físicas','textarea','Persona desaparecida'),
 ('vestimenta','Vestimenta','textarea','Persona desaparecida'),
 ('presuntoResponsable','Persona presuntamente responsable','text','Desaparición'),
 ('relacionResponsable','Relación con la persona desaparecida','text','Desaparición'),
 ('fechaDesaparicion','Fecha de desaparición','date','Desaparición'), ('horaDesaparicion','Hora de desaparición','time','Desaparición'),
 ('referenciaLugar','Referencia del lugar','text','Desaparición'), ('sector','Colonia, aldea, barrio o sector','text','Desaparición'),
 ('zonaDesaparicion','Zona','text','Desaparición'), ('tipoLugar','Tipo de lugar','text','Desaparición'),
 ('motivoDesaparicion','Motivo de desaparición','text','Desaparición'), ('resenaDesaparicion','Reseña de desaparición','textarea','Desaparición'),
 ('estatusLocalizacion','Estatus de localización según la base','text','Localización'),
 ('unidadLocalizo','Unidad que localizó','text','Localización'), ('institucionLocalizo','Institución que localizó','text','Localización'),
 ('condicionLocalizacion','Condición de la persona localizada','text','Localización'),
 ('causaFallecimiento','Causa de fallecimiento (cuando corresponda)','text','Localización'),
 ('departamentoLocalizacion','Departamento de localización','text','Localización'),
 ('municipioLocalizacion','Municipio de localización','text','Localización'), ('zonaLocalizacion','Zona de localización','text','Localización'),
 ('resenaLocalizacion','Reseña de localización','textarea','Localización'),
 ('fechaInformado','Fecha de informado','date','Informe y entrega'), ('numeroOficio','Número de oficio','text','Informe y entrega'),
 ('institucionDestinataria','Institución destinataria (MP, PGN u otra)','text','Informe y entrega'),
 ('clasificacionCaso','Clasificación del caso (A, B, C, D)','text','Informe y entrega'),
 ('situacionAlerta','Situación de la alerta (activa/desactivada)','text','Informe y entrega'),
 ('fechaDesactivacion','Fecha de desactivación','date','Informe y entrega'),
 ('fechaEntregaAnalisis','Fecha de entrega a análisis','date','Informe y entrega'),
 ('observaciones','Observaciones del investigador','textarea','Informe y entrega'),
 ('observacionesAnalista','Observaciones del analista','textarea','Recepción'),
 ('observacionesAdicionales','Observaciones adicionales','textarea','Informe y entrega'),
]
counts = [('camarasUbicadas','Cámaras ubicadas'),('camarasSolicitadas','Cámaras solicitadas'),('videosExtraidos','Videos extraídos'),('fotogramas','Fotogramas'),('inmueblesUbicados','Inmuebles ubicados'),('allanamientosSolicitados','Allanamientos solicitados'),('allanamientosEjecutados','Allanamientos ejecutados'),('allanamientosNoAutorizados','Allanamientos no autorizados'),('solvenciasPersonas','Solvencias de personas'),('perfilacionesPersonas','Perfilaciones de personas'),('aprehensionesSolicitadas','Órdenes de aprehensión solicitadas'),('aprehensionesEjecutadas','Órdenes de aprehensión ejecutadas'),('aprehensionesNoAutorizadas','Órdenes de aprehensión no autorizadas'),('solvenciasVehiculos','Solvencias de vehículos'),('fichasVehiculos','Fichas técnicas de vehículos'),('incautado','Cantidad incautada'),('entrevistas','Entrevistas realizadas')]
fields += [(key,label,'number','Diligencias') for key,label in counts]
config = [dict(key=k,label=l,type=t,section=s) for k,l,t,s in fields]
(frontend / 'alerta-campos.ts').write_text('export const CAMPOS_ALERTA = '+json.dumps(config,ensure_ascii=False,indent=2)+' as const;\n', encoding='utf-8')
dto = "import { Type } from 'class-transformer';\nimport { IsOptional, IsString, IsInt, Min, Max, IsDateString, Matches, MaxLength } from 'class-validator';\n\nexport class FichaAlertaDto {\n"
schema = "import { Schema } from 'mongoose';\nexport const FichaAlertaSchema = new Schema({\n"
for key,label,typ,section in fields:
    if typ == 'number':
        dto += f'  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max({130 if key == "edadReportada" else 1000000})\n  {key}?: number;\n'
        schema += f'  {key}: {{ type: Number, min: 0, max: {130 if key == "edadReportada" else 1000000} }},\n'
    elif typ == 'date':
        dto += f'  @IsOptional() @IsDateString()\n  {key}?: string;\n'
        schema += f'  {key}: Date,\n'
    else:
        dto += f'  @IsOptional() @IsString() @MaxLength({10000 if typ == "textarea" else 500})'+ (' @Matches(/^([01]\\d|2[0-3]):[0-5]\\d$/)' if typ=='time' else '')+f'\n  {key}?: string;\n'
        schema += f'  {key}: {{ type: String, trim: true }},\n'
(backend/'dto/ficha-alerta.dto.ts').write_text(dto+'}\n',encoding='utf-8')
(backend/'entities/ficha-alerta.schema.ts').write_text(schema+'}, { _id: false });\n',encoding='utf-8')
