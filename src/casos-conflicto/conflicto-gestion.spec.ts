import 'reflect-metadata';
import { ValidationPipe, ForbiddenException, BadRequestException, ConflictException } from '@nestjs/common';
import { model, Types } from 'mongoose';
import { Workbook } from 'exceljs';
import { CasosConflictoSchema } from './entities/casos-conflicto.entity';
import { CasosConflictoService } from './casos-conflicto.service';
import { RegistroInicialConflictoDto, CompletarConflictoDto } from './dto/gestion-conflicto.dto';
import { UserRole } from '../auth/enums/user-role.enum';
import { generarExcelConflictos, filasConflicto } from './conflicto-excel';
import headers = require('./conflicto-excel-encabezados.json');
import { CasosConflictoController } from './casos-conflicto.controller';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';

describe('Excel de conflicto',()=>{
  const caso={numeroDeic:'DEIC53-2026-10-09-001',fechaIngreso:'2026-10-09',infractores:[{nombre:'Primero',edadReportada:0,alias:'Uno',sexo:'HOMBRE'},{nombre:'Segundo',edadReportada:17,alias:'Dos',sexo:'MUJER'},{nombre:'Tercero',edadReportada:18}],victimas:[{nombre:'Denunciante',telefono:'123',direccion:'Dirección'}],fichaConflicto:{fechaAsignacion:'2026-10-01',fechaPrimerInforme:'2026-10-04',fechaEntregaAnalisis:'2026-10-09',folios:0,entrevistas:2,columnaAdicional:'=texto'},fileUrls:['https://ejemplo.test/pdf']};
  it('conserva 74 columnas, todos los adolescentes y el orden especial del segundo bloque',()=>{
    const filas=filasConflicto(caso);expect(filas).toHaveLength(2);filas.forEach(f=>expect(f).toHaveLength(74));
    expect(filas[0].slice(39,43)).toEqual(['Primero',0,'Uno','HOMBRE']);
    expect(filas[0].slice(51,55)).toEqual(['Segundo',17,'MUJER','Dos']);expect(filas[1][39]).toBe('Tercero');
    expect(filas[0][21]).toBe(3);expect(filas[0][71]).toBe(5);expect(filas[0][22]).toBe(0);
    expect(filas[1][21]).toBe('');expect(filas[1][22]).toBe('');expect(filas[1][67]).toBe('');
  });
  it('genera un libro legible con encabezados originales y texto literal',async()=>{
    const wb=new Workbook();await wb.xlsx.load(await generarExcelConflictos([caso]) as any);const hoja=wb.getWorksheet('DEIC53')!;
    expect(hoja.columnCount).toBe(74);expect(hoja.rowCount).toBe(3);expect((hoja.getRow(1).values as any[]).slice(1)).toEqual(headers);
    expect(hoja.getCell('BV2').value).toBe('=texto');expect(hoja.getCell('C2').value).toBeInstanceOf(Date);
    expect(filasConflicto({infractores:[],fichaConflicto:{}})[0][71]).toBe('');
  });
});

const pipe=new ValidationPipe({transform:true,whitelist:true,forbidNonWhitelisted:true});
const validar=(dto:any,body:any)=>pipe.transform(body,{type:'body',metatype:dto});
const Modelo=model<any>('PruebaGestionConflicto',CasosConflictoSchema);
const analista={userId:new Types.ObjectId().toString(),role:UserRole.ANALISTA};
const investigador={userId:new Types.ObjectId().toString(),role:UserRole.INVESTIGADOR};
const inicial={numeroDeic:'DEIC53-2026-10-09-001',fechaIngreso:'2026-10-09',investigadorAsignado:investigador.userId,infractores:[{nombre:'Víctima de prueba',fecha_Nac:null,cui:null,direccion:null}]};
const pdf={originalname:'expediente.pdf',mimetype:'application/pdf',buffer:Buffer.from('%PDF-1.7\n')} as Express.Multer.File;

describe('Conflicto: analista, asignación, expediente y revisión',()=>{
  let almacenado:any,usuarios:any,modelo:any,drive:any,service:CasosConflictoService;
  beforeEach(()=>{
    usuarios={exists:jest.fn().mockResolvedValue(true)};
    modelo=jest.fn((datos:any)=>{const doc=new Modelo(datos);doc.save=jest.fn(async()=>{await doc.validate();almacenado=doc;return doc;});return doc;});
    modelo.db={model:()=>usuarios};modelo.findById=jest.fn(async()=>almacenado);
    drive={uploadFile:jest.fn().mockResolvedValue('https://drive.google.com/file?id=prueba')};
    service=new CasosConflictoService(modelo,drive);
  });
  const abrir=()=>service.registrarInicial(validadoInicial(),analista);
  function validadoInicial(){return inicial as any;}
  async function completar(){return service.completar(String(almacenado._id),await validar(CompletarConflictoDto,{
    numeroMp:'M0004-2026-100',estadoInvestigacion:'Informado',
    infractores:[{nombre:'Víctima de prueba',edadReportada:0},{nombre:'Segunda víctima',fecha_Nac:'2015-01-01'}],
    victimas:[{nombre:'Sindicado de prueba',tipoPersona:'DENUNCIANTE'}],
    lugarHechos:{departamento:'Guatemala',municipio:'Guatemala',direccionDetallada:'Dirección de prueba'},
    fichaConflicto:{entrevistas:0,resenaHecho:'Reseña',fechaEntregaAnalisis:'2026-10-10'},
  }),investigador);}
  it('abre con los null del formulario, sin PDF ni datos personales inventados',async()=>{
    const dto=await validar(RegistroInicialConflictoDto,{...inicial,numeroMp:null,estadoInvestigacion:null,lugarHechos:{departamento:null,municipio:null,direccionDetallada:null}});
    const c=await service.registrarInicial(dto,analista);
    expect(c.procesoConflicto).toBe(true);expect(c.expedienteEnPreparacion).toBe(true);expect(c.estadoRegistro).toBe('Pendiente');
    expect(String(c.registradoPor)).toBe(analista.userId);expect(String(c.investigadorAsignado)).toBe(investigador.userId);
    expect(c.fileUrls).toHaveLength(0);expect(c.victimas).toHaveLength(0);expect(drive.uploadFile).not.toHaveBeenCalled();
  });
  it.each(['numeroDeic','fechaIngreso','investigadorAsignado','infractores'])('exige %s al analista',async campo=>{
    const datos={...inicial};delete datos[campo];await expect(validar(RegistroInicialConflictoDto,datos)).rejects.toBeInstanceOf(BadRequestException);
  });
  it('requiere una víctima con nombre y rechaza auditoría inyectada',async()=>{
    for(const extra of [{infractores:[]},{infractores:[{}]},{fileUrls:['url']},{estadoRegistro:'Aprobado'},{procesoConflicto:false}])await expect(validar(RegistroInicialConflictoDto,{...inicial,...extra})).rejects.toBeInstanceOf(BadRequestException);
  });
  it('solo el analista abre y el responsable debe estar activo',async()=>{
    await expect(service.registrarInicial(inicial as any,investigador)).rejects.toBeInstanceOf(ForbiddenException);
    usuarios.exists.mockResolvedValue(false);await expect(abrir()).rejects.toBeInstanceOf(BadRequestException);
  });
  it('solo el investigador asignado puede consultar y completar',async()=>{
    await abrir();
    await expect(service.completar(String(almacenado._id),{},analista)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.detalleGestion(String(almacenado._id),{...investigador,userId:new Types.ObjectId().toString()})).rejects.toBeInstanceOf(ForbiddenException);
    for(const extra of [{numeroDeic:'otro'},{investigadorAsignado:analista.userId},{estadoRegistro:'Aprobado'}])await expect(validar(CompletarConflictoDto,extra)).rejects.toBeInstanceOf(BadRequestException);
  });
  it('guarda un avance parcial y mantiene la ficha al completarla',async()=>{
    await abrir();await service.completar(String(almacenado._id),{fichaConflicto:{resenaHecho:'Inicial'}},investigador);
    await service.completar(String(almacenado._id),{fichaConflicto:{entrevistas:0}},investigador);
    expect(almacenado.fichaConflicto.resenaHecho).toBe('Inicial');expect(almacenado.fichaConflicto.entrevistas).toBe(0);expect(drive.uploadFile).not.toHaveBeenCalled();
  });
  it('rechaza cantidades negativas y edades imposibles',async()=>{
    for(const body of [{fichaConflicto:{entrevistas:-1}},{fichaConflicto:{folios:1.5}},{infractores:[{nombre:'Prueba',edadReportada:131}]}])await expect(validar(CompletarConflictoDto,body)).rejects.toBeInstanceOf(BadRequestException);
  });
  it('no permite revisión ni entrega incompleta',async()=>{
    await abrir();const id=String(almacenado._id);
    await expect(service.aprobarRegistro(id,analista.userId)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.rechazarRegistro(id,analista.userId,'Falta documento')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.entregar(id,investigador,pdf)).rejects.toBeInstanceOf(BadRequestException);expect(drive.uploadFile).not.toHaveBeenCalled();
  });
  it.each(['numeroMp','estadoInvestigacion','lugarHechos','infractores'])('impide entregar sin %s',async campo=>{
    await abrir();await completar();almacenado.set(campo,null);
    await expect(service.entregar(String(almacenado._id),investigador,pdf)).rejects.toBeInstanceOf(BadRequestException);expect(drive.uploadFile).not.toHaveBeenCalled();
  });
  it('exige nacimiento o edad de cada adolescente infractor y permite víctimas desconocidas',async()=>{
    await abrir();await completar();almacenado.infractores[1].fecha_Nac=null;
    await expect(service.entregar(String(almacenado._id),investigador,pdf)).rejects.toBeInstanceOf(BadRequestException);
    almacenado.infractores[1].edadReportada=10;almacenado.victimas=[];
    await expect(service.entregar(String(almacenado._id),investigador,pdf)).resolves.toBeDefined();
  });
  it('entrega, rechaza, corrige y aprueba el mismo caso conservando PDFs',async()=>{
    await abrir();await completar();const id=String(almacenado._id);
    await service.entregar(id,investigador,pdf);expect(almacenado.expedienteEnPreparacion).toBe(false);
    await expect(service.completar(id,{},investigador)).rejects.toBeInstanceOf(ConflictException);
    await service.rechazarRegistro(id,analista.userId,'Completar informe');
    await service.completar(id,{fichaConflicto:{observaciones:'Corregido'}},investigador);
    await service.reenviarRegistro(id,investigador.userId,pdf);
    await service.aprobarRegistro(id,analista.userId);
    expect(String(almacenado._id)).toBe(id);expect(almacenado.fileUrls).toHaveLength(2);expect(almacenado.estadoRegistro).toBe('Aprobado');
  });
  it('traduce duplicados y modificaciones concurrentes a 409',async()=>{
    await abrir();almacenado.save.mockRejectedValue({name:'VersionError'});
    await expect(service.completar(String(almacenado._id),{},investigador)).rejects.toBeInstanceOf(ConflictException);
    almacenado.save.mockRejectedValue({code:11000});await expect(service.completar(String(almacenado._id),{},investigador)).rejects.toBeInstanceOf(ConflictException);
  });
  it('protege endpoints por rol y no acepta PDF en apertura',()=>{
    for(const method of ['registrarInicial','crearInicial','exportarExcel'])expect(Reflect.getMetadata(ROLES_KEY,CasosConflictoController.prototype[method])).toEqual([UserRole.ANALISTA]);
    const controller=new CasosConflictoController(service);
    expect(()=>controller.crearInicial(inicial as any,{user:analista},pdf)).toThrow(BadRequestException);
  });
  it('filtra Mis registros por responsable y oculta borradores de revisión',async()=>{
    const query={populate:jest.fn().mockReturnThis(),sort:jest.fn().mockReturnThis(),exec:jest.fn().mockResolvedValue([])};
    modelo.find=jest.fn().mockReturnValue(query);
    await service.findPendientes();expect(modelo.find.mock.calls[0][0].expedienteEnPreparacion).toEqual({$ne:true});
    await service.findMisRegistros(investigador.userId);
    expect(String(modelo.find.mock.calls[1][0].$or[0].investigadorAsignado)).toBe(investigador.userId);
    expect(modelo.find.mock.calls[1][0].$or[1].procesoConflicto).toEqual({$ne:true});
  });
});

