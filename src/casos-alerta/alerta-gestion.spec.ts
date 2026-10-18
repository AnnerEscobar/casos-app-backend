import 'reflect-metadata';
import { ValidationPipe, ForbiddenException, BadRequestException, ConflictException } from '@nestjs/common';
import { model, Types } from 'mongoose';
import { Workbook } from 'exceljs';
import { CasosAlertaSchema } from './entities/casos-alerta.entity';
import { CasosAlertaService } from './casos-alerta.service';
import { RegistroInicialAlertaDto, CompletarAlertaDto } from './dto/gestion-alerta.dto';
import { UserRole } from '../auth/enums/user-role.enum';
import { EstadoRegistro } from '../common/enums/estado-registro.enum';
import { filaDesaparecido, generarExcelAlertas } from './alerta-excel';
import headers = require('./alerta-excel-encabezados.json');
import { CasosAlertaController } from './casos-alerta.controller';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';

const pipe=new ValidationPipe({transform:true,whitelist:true,forbidNonWhitelisted:true});
const validar=(dto:any,body:any)=>pipe.transform(body,{type:'body',metatype:dto});
const Modelo=model<any>('PruebaGestionAlerta',CasosAlertaSchema);
const analista={userId:new Types.ObjectId().toString(),role:UserRole.ANALISTA};
const investigador={userId:new Types.ObjectId().toString(),role:UserRole.INVESTIGADOR};
const inicial={numeroDeic:'DEIC52-2026-10-08-001',nombreDesaparecido:'Persona de prueba',fechaIngreso:'2026-10-08',investigadorAsignado:investigador.userId};
const pdf={originalname:'expediente.pdf',mimetype:'application/pdf',buffer:Buffer.from('%PDF-1.7\n')} as Express.Multer.File;

describe('Alerta: apertura, asignación, entrega y revisión',()=>{
  let almacenado:any;
  let usuarios:any;
  let modelo:any;
  let drive:any;
  let service:CasosAlertaService;
  beforeEach(()=>{
    usuarios={exists:jest.fn().mockResolvedValue(true)};
    modelo=jest.fn((datos:any)=>{
      const doc=new Modelo(datos);
      doc.save=jest.fn(async()=>{await doc.validate();almacenado=doc;return doc;});
      return doc;
    });
    modelo.db={model:()=>usuarios};
    modelo.findById=jest.fn(async()=>almacenado);
    drive={uploadFile:jest.fn().mockResolvedValue('https://drive.google.com/file?id=archivo-prueba')};
    service=new CasosAlertaService(modelo,drive);
  });
  async function abrir(){return service.registrarInicial(await validar(RegistroInicialAlertaDto,inicial),analista);}
  async function completar(){await service.completar(String(almacenado._id),await validar(CompletarAlertaDto,{
    numeroMp:'M0030-2026-100',numeroAlerta:'123-2026',estadoInvestigacion:'Informado',fecha_Nac:'2014-01-01',
    direccion:{departamento:'Guatemala',municipio:'Guatemala',direccionDetallada:'Dirección de prueba'},
    fichaAlerta:{edadReportada:12,sexo:'MUJER',entrevistas:0},
  }),investigador);}

  it('abre sin PDF ni nacimiento, conserva analista y responsable distintos',async()=>{
    const c=await abrir();
    expect(c.estadoRegistro).toBe('Pendiente');expect(c.expedienteEnPreparacion).toBe(true);
    expect(String(c.registradoPor)).toBe(analista.userId);expect(String(c.investigadorAsignado)).toBe(investigador.userId);
    expect(c.fileUrls).toHaveLength(0);expect(drive.uploadFile).not.toHaveBeenCalled();
    expect(c.origenCaso).toBe('SISTEMA');expect(c.fecha_Nac).toBeUndefined();
  });
  it('permite los datos desconocidos enviados como null por el formulario',async()=>{
    const datos=await validar(RegistroInicialAlertaDto,{...inicial,fecha_Nac:null,estadoInvestigacion:null,numeroMp:null,numeroAlerta:null});
    const c=await service.registrarInicial(datos,analista);
    expect(c.fecha_Nac).toBeNull();
    expect(c.estadoInvestigacion).toBeNull();
    expect(c.expedienteEnPreparacion).toBe(true);
  });
  it.each(['nombreDesaparecido','numeroDeic','fechaIngreso','investigadorAsignado'])('exige %s para abrir',async campo=>{
    const datos={...inicial};delete datos[campo];await expect(validar(RegistroInicialAlertaDto,datos)).rejects.toBeInstanceOf(BadRequestException);
  });
  it('rechaza asignación a un investigador inactivo',async()=>{
    usuarios.exists.mockResolvedValue(false);await expect(abrir()).rejects.toBeInstanceOf(BadRequestException);expect(drive.uploadFile).not.toHaveBeenCalled();
  });
  it('no permite apertura por investigador',async()=>{
    await expect(service.registrarInicial(inicial,investigador)).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('no acepta auditoría, estados de revisión o archivo inyectados',async()=>{
    for(const extra of [{registradoPor:investigador.userId},{estadoRegistro:'Aprobado'},{expedienteEnPreparacion:false},{fileUrls:['url']},{file:'archivo'}]){
      await expect(validar(RegistroInicialAlertaDto,{...inicial,...extra})).rejects.toBeInstanceOf(BadRequestException);
    }
  });
  it('solo el asignado edita; no se puede cambiar DEIC o responsable en completar',async()=>{
    await abrir();await expect(service.completar(String(almacenado._id),{}, {...investigador,userId:new Types.ObjectId().toString()})).rejects.toBeInstanceOf(ForbiddenException);
    for(const datos of [{numeroDeic:'otro'},{investigadorAsignado:analista.userId}])await expect(validar(CompletarAlertaDto,datos)).rejects.toBeInstanceOf(BadRequestException);
  });
  it('guarda datos parciales y preserva observaciones del analista',async()=>{
    await abrir();almacenado.fichaAlerta={observacionesAnalista:'Control inicial',edadReportada:12,entrevistas:0};
    const c=await service.completar(String(almacenado._id),{fichaAlerta:{sexo:'MUJER',observacionesAnalista:'Intento de cambio'}},investigador);
    expect(c.fichaAlerta.sexo).toBe('MUJER');expect(c.fichaAlerta.observacionesAnalista).toBe('Control inicial');expect(c.expedienteEnPreparacion).toBe(true);
    expect(c.fichaAlerta.edadReportada).toBe(12);expect(c.fichaAlerta.entrevistas).toBe(0);
  });
  it('no admite diligencias negativas, fracciones ni una edad imposible',async()=>{
    for(const fichaAlerta of [{entrevistas:-1},{entrevistas:1.5},{edadReportada:150}])await expect(validar(CompletarAlertaDto,{fichaAlerta})).rejects.toBeInstanceOf(BadRequestException);
  });
  it('impide aprobar y rechazar antes de entregar; no sube expedientes incompletos',async()=>{
    await abrir();await expect(service.aprobarRegistro(String(almacenado._id),analista.userId)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.rechazarRegistro(String(almacenado._id),analista.userId,'Corregir')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.entregar(String(almacenado._id),investigador,pdf)).rejects.toBeInstanceOf(BadRequestException);expect(drive.uploadFile).not.toHaveBeenCalled();
  });
  it.each(['fecha_Nac','estadoInvestigacion'])('impide entregar sin %s aunque el analista pudo abrir el caso',async campo=>{
    await abrir();await completar();almacenado.set(campo,null);
    await expect(service.entregar(String(almacenado._id),investigador,pdf)).rejects.toBeInstanceOf(BadRequestException);
    expect(drive.uploadFile).not.toHaveBeenCalled();
  });
  it('entrega con nacimiento registrado, rechaza, corrige, reenvía y aprueba conservando documentos',async()=>{
    await abrir();await completar();
    await service.entregar(String(almacenado._id),investigador,pdf);
    expect(almacenado.expedienteEnPreparacion).toBe(false);expect(almacenado.fileUrls).toHaveLength(1);
    await expect(service.completar(String(almacenado._id),{},investigador)).rejects.toBeInstanceOf(ConflictException);
    await service.rechazarRegistro(String(almacenado._id),analista.userId,'Completar reseña');
    await service.completar(String(almacenado._id),{fichaAlerta:{resenaDesaparicion:'Reseña corregida'}},investigador);
    await service.entregar(String(almacenado._id),investigador,pdf);
    await service.aprobarRegistro(String(almacenado._id),analista.userId);
    expect(almacenado.estadoRegistro).toBe(EstadoRegistro.APROBADO);expect(almacenado.fileUrls).toHaveLength(2);
    expect(almacenado.historialRevisiones.map(r=>r.tipo)).toEqual(['Reenvío','Rechazo','Reenvío','Aprobación']);
    expect(String(almacenado.registradoPor)).toBe(analista.userId);expect(String(almacenado.investigadorAsignado)).toBe(investigador.userId);
  });
  it('traduce duplicados y escrituras concurrentes a 409',async()=>{
    await abrir();almacenado.save.mockRejectedValueOnce({name:'VersionError'});
    await expect(service.completar(String(almacenado._id),{},investigador)).rejects.toBeInstanceOf(ConflictException);
    almacenado.save.mockRejectedValueOnce({code:11000});await expect(service.completar(String(almacenado._id),{},investigador)).rejects.toBeInstanceOf(ConflictException);
    expect(CasosAlertaSchema.get('optimisticConcurrency')).toBe(true);
  });
  it('declara exportación solo para analista y edición solo para investigador',()=>{
    expect(Reflect.getMetadata(ROLES_KEY,CasosAlertaController.prototype.exportarExcel)).toEqual([UserRole.ANALISTA]);
    expect(Reflect.getMetadata(ROLES_KEY,CasosAlertaController.prototype.completar)).toEqual([UserRole.INVESTIGADOR]);
    expect(Reflect.getMetadata(ROLES_KEY,CasosAlertaController.prototype.registrarInicial)).toEqual([UserRole.ANALISTA]);
  });
});

describe('Excel de alertas según base de referencia',()=>{
  it('conserva las 73 y 28 columnas, fechas, ceros y registros con MP compartido',async()=>{
    const casos=[{...inicial,numeroMp:'M0030-2026-100',numeroAlerta:'123-2026',estadoInvestigacion:'Informado',investigadorAsignado:{nombre:'Investigador de prueba'},fichaAlerta:{edadReportada:12,entrevistas:0,fechaDesaparicion:'2026-10-07',horaDesaparicion:'10:00'},fechaLocalizacion:'2026-10-08',horaLocalizacion:'10:00'}, {...inicial,numeroDeic:'DEIC52-2026-10-08-002',numeroMp:'M0030-2026-100'}];
    const book=new Workbook();await book.xlsx.load(await generarExcelAlertas(casos) as any);
    const d=book.getWorksheet('DESAPARECIDOS'),l=book.getWorksheet('LOCALIZADOS');
    expect((d.getRow(1).values as any[]).slice(1)).toEqual(headers.DESAPARECIDOS);expect((l.getRow(1).values as any[]).slice(1)).toEqual(headers.LOCALIZADOS);
    expect(headers.DESAPARECIDOS).toHaveLength(73);expect(headers.LOCALIZADOS).toHaveLength(28);
    expect(d.rowCount).toBe(3);expect(l.rowCount).toBe(2);
    expect(d.getCell('E2').value).toBeInstanceOf(Date);expect(d.getCell('BQ2').value).toBe(0);
    expect(d.getCell('AX2').value).toBe('Investigador de prueba');expect([null,'']).toContain(d.getCell('K2').value);
    expect(d.getCell('L2').value).toBe(12);expect(d.getCell('AL2').value).toBe('7 A 24 HORAS');
    expect(d.getCell('D2').value).toBe(d.getCell('D3').value);expect(d.autoFilter).toBeTruthy();
  });
  it('no inventa recepción, responsable, edad o cantidades para los casos anteriores',()=>{
    const row=filaDesaparecido({numeroDeic:'AK000001',createdAt:new Date(),registradoPor:{nombre:'Analista'}},1);
    expect(row[4]).toBe('');expect(row[11]).toBe('');expect(row[49]).toBe('');expect(row[68]).toBe('');
  });
  it('mantiene texto que empieza con = como texto, y no como fórmula',async()=>{
    const book=new Workbook();await book.xlsx.load(await generarExcelAlertas([{nombreDesaparecido:'=1+1'}]) as any);
    expect(book.getWorksheet('DESAPARECIDOS').getCell('J2').value).toBe('=1+1');
  });
  it('MP no es único; DEIC y alerta conservan la unicidad',()=>{
    const indices=CasosAlertaSchema.indexes();
    expect(indices.find(([key])=>key.numeroMp)?.[1].unique).not.toBe(true);
    expect(indices.find(([key])=>key.numeroAlerta)?.[1].unique).toBe(true);
    expect(indices.find(([key])=>key.numeroDeic)?.[1].unique).toBe(true);
  });
  it('incluye una localización registrada en seguimiento sin modificar el caso',async()=>{
    const caso={numeroDeic:'AK000002',seguimientos:[{fechaLocalizacion:'2026-10-08',horaLocalizacion:'13:20',direccionLocalizacion:'Dirección de prueba'}]};
    const book=new Workbook();await book.xlsx.load(await generarExcelAlertas([caso]) as any);
    expect(book.getWorksheet('LOCALIZADOS').rowCount).toBe(2);
    expect(book.getWorksheet('LOCALIZADOS').getCell('S2').value).toBe('13:20');
    expect((caso as any).fechaLocalizacion).toBeUndefined();
  });
});
