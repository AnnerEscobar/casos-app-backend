"""Genera campos y copia solo encabezados de la base; nunca copia expedientes."""
import json
from pathlib import Path
import openpyxl

root = Path(__file__).resolve().parents[2]
back = root / 'casos-app-backend/src/casos-maltrato'
front = root / 'casos-app/src/app/casos/maltrato-gestion'
front.mkdir(exist_ok=True)
w = openpyxl.load_workbook(r'F:/SERVIDOR/BASES 2026/2. 51 MT/15. MALTRATO 2026.xlsx', read_only=True, data_only=True)
headers = list(next(w['MALTRATO 2026'].iter_rows(max_row=1, values_only=True)))
(back / 'maltrato-excel-encabezados.json').write_text(json.dumps(headers, ensure_ascii=False, indent=2), encoding='utf-8')
fields = [
 ('procedencia','Procedencia','text','Recepción'),
 ('tipoDocumento','Tipo de documento','text','Recepción'),
 ('fechaDocumento','Fecha del documento','date','Recepción'),
 ('unidadConoce','Unidad que conoce','text','Recepción'),
 ('zonaHecho','Zona del hecho','text','Hechos'),
 ('fechaHecho','Fecha del hecho','date','Hechos'),
 ('horaHecho','Hora del hecho','time','Hechos'),
 ('movilHecho','Móvil del hecho','text','Hechos'),
 ('modusOperandi','Modus operandi','textarea','Hechos'),
 ('circunstanciaVictima','Circunstancia en que se encontró a la víctima','textarea','Hechos'),
 ('resenaHecho','Reseña del hecho','textarea','Hechos'),
 ('logrosObtenidos','Logros obtenidos','textarea','Informe y entrega'),
 ('fechaInformadoMp','Fecha en que se informó al MP','date','Informe y entrega'),
 ('numeroOficioMp','Número de oficio enviado al MP','text','Informe y entrega'),
 ('tipoAtencion','Turno / FNNA','text','Recepción'),
 ('clasificacionCaso','Clasificación del caso','text','Informe y entrega'),
 ('fechaEntregaAnalisis','Fecha de entrega a análisis','date','Informe y entrega'),
 ('observaciones','Observaciones','textarea','Informe y entrega'),
]
counts = [('camarasUbicadas','Cámaras ubicadas'),('camarasSolicitadas','Cámaras solicitadas'),('camarasExtraidas','Cámaras extraídas'),('fotogramas','Fotogramas'),('allanamientosSolicitados','Allanamientos solicitados'),('allanamientosEjecutados','Allanamientos ejecutados'),('allanamientosAutorizados','Allanamientos autorizados'),('aprehensionesSolicitadas','Órdenes de aprehensión solicitadas'),('aprehensionesEjecutadas','Órdenes de aprehensión ejecutadas'),('aprehensionesAutorizadas','Órdenes de aprehensión autorizadas'),('entrevistas','Entrevistas realizadas')]
fields += [(k,l,'number','Diligencias') for k,l in counts]
dto = "import { IsOptional, IsString, IsDateString, IsInt, Min, Max, MaxLength, Matches } from 'class-validator';\nexport class FichaMaltratoDto {\n"
schema = "import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';\n@Schema({_id:false})\nexport class FichaMaltrato {\n"
for key,label,kind,section in fields:
    typ='number' if kind=='number' else 'string'
    validation='@IsInt() @Min(0) @Max(1000000)' if kind=='number' else '@IsDateString()' if kind=='date' else '@Matches(/^([01]\\d|2[0-3]):[0-5]\\d$/)' if kind=='time' else '@IsString() @MaxLength(10000)'
    dto+=f'  @IsOptional() {validation} {key}?: {typ};\n'
    options='type:Number,min:0,max:1000000,validate:Number.isInteger' if kind=='number' else 'type:Date' if kind=='date' else 'type:String,trim:true'
    schema+=f'  @Prop({{{options}}}) {key}?: {"Date" if kind=="date" else typ};\n'
(back/'dto/ficha-maltrato.dto.ts').write_text(dto+'}\n',encoding='utf-8')
(back/'entities/ficha-maltrato.schema.ts').write_text(schema+'}\nexport const FichaMaltratoSchema=SchemaFactory.createForClass(FichaMaltrato);\n',encoding='utf-8')
(front/'maltrato-campos.ts').write_text("export const CAMPOS_MALTRATO: {key:string;label:string;type:string;section:string}[] = "+json.dumps([dict(key=k,label=l,type=t,section=s) for k,l,t,s in fields],ensure_ascii=False,indent=2)+';\n',encoding='utf-8')
