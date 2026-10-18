import 'reflect-metadata';
import { ValidationPipe, ForbiddenException, BadRequestException, ConflictException } from '@nestjs/common';
import { model, Types } from 'mongoose';
import { Workbook } from 'exceljs';
import { CasosMaltratoSchema } from './entities/casos-maltrato.entity';
import { CasosMaltratoService } from './casos-maltrato.service';
import { RegistroInicialMaltratoDto, CompletarMaltratoDto } from './dto/gestion-maltrato.dto';
import { UserRole } from '../auth/enums/user-role.enum';
import { generarExcelMaltratos, filasMaltrato } from './maltrato-excel';
import headers = require('./maltrato-excel-encabezados.json');
import { CasosMaltratoController } from './casos-maltrato.controller';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';

const pipe=new ValidationPipe({transform:true,whitelist:true,forbidNonWhitelisted:true});
const validar=(dto:any,body:any)=>pipe.transform(body,{type:'body',metatype:dto});
const Modelo=model<any>('PruebaGestionMaltrato',CasosMaltratoSchema);
const analista={userId:new Types.ObjectId().toString(),role:UserRole.ANALISTA};
const investigador={userId:new Types.ObjectId().toString(),role:UserRole.INVESTIGADOR};
const inicial={numeroDeic:'DEIC51-2026-10-09-001',fechaIngreso:'2026-10-09',investigadorAsignado:investigador.userId,victimas:[{nombre:'Víctima de prueba',fecha_Nac:null,cui:null,direccion:null}]};
const pdf={originalname:'expediente.pdf',mimetype:'application/pdf',buffer:Buffer.from('%PDF-1.7\n')} as Express.Multer.File;

describe('Maltrato: analista, asignación, expediente y revisión',()=>{
  let almacenado:any,usuarios:any,modelo:any,drive:any,service:CasosMaltratoService;
  beforeEach(()=>{
    usuarios={exists:jest.fn().mockResolvedValue(true)};
    modelo=jest.fn((datos:any)=>{const doc=new Modelo(datos);doc.save=jest.fn(async()=>{await doc.validate();almacenado=doc;return doc;});return doc;});
    modelo.db={model:()=>usuarios};modelo.findById=jest.fn(async()=>almacenado);
    drive={uploadFile:jest.fn().mockResolvedValue('https://drive.google.com/file?id=prueba')};
    service=new CasosMaltratoService(modelo,drive);
  });
  const abrir=()=>service.registrarInicial(validadoInicial(),analista);
  function validadoInicial(){return inicial as any;}
  async function completar(){return service.completar(String(almacenado._id),await validar(CompletarMaltratoDto,{
    numeroMp:'M0030-2026-100',estadoInvestigacion:'Informado',
    victimas:[{nombre:'Víctima de prueba',edadReportada:0},{nombre:'Segunda víctima',fecha_Nac:'2015-01-01'}],
    sindicados:[{nombre:'Sindicado de prueba',parentesco:'POR ESTABLECER'}],
    lugarHechos:{departamento:'Guatemala',municipio:'Guatemala',direccionDetallada:'Dirección de prueba'},
    fichaMaltrato:{entrevistas:0,resenaHecho:'Reseña',fechaEntregaAnalisis:'2026-10-10'},
  }),investigador);}
  it('abre con los null del formulario, sin PDF ni datos personales inventados',async()=>{
    const dto=await validar(RegistroInicialMaltratoDto,{...inicial,numeroMp:null,estadoInvestigacion:null,lugarHechos:{departamento:null,municipio:null,direccionDetallada:null}});
    const c=await service.registrarInicial(dto,analista);
    expect(c.procesoMaltrato).toBe(true);expect(c.expedienteEnPreparacion).toBe(true);expect(c.estadoRegistro).toBe('Pendiente');
    expect(String(c.registradoPor)).toBe(analista.userId);expect(String(c.investigadorAsignado)).toBe(investigador.userId);
    expect(c.fileUrls).toHaveLength(0);expect(c.infractores).toHaveLength(0);expect(drive.uploadFile).not.toHaveBeenCalled();
  });
  it.each(['numeroDeic','fechaIngreso','investigadorAsignado','victimas'])('exige %s al analista',async campo=>{
    const datos={...inicial};delete datos[campo];await expect(validar(RegistroInicialMaltratoDto,datos)).rejects.toBeInstanceOf(BadRequestException);
  });
  it('requiere una víctima con nombre y rechaza auditoría inyectada',async()=>{
    for(const extra of [{victimas:[]},{victimas:[{}]},{fileUrls:['url']},{estadoRegistro:'Aprobado'},{procesoMaltrato:false}])await expect(validar(RegistroInicialMaltratoDto,{...inicial,...extra})).rejects.toBeInstanceOf(BadRequestException);
  });
  it('solo el analista abre y el responsable debe estar activo',async()=>{
    await expect(service.registrarInicial(inicial as any,investigador)).rejects.toBeInstanceOf(ForbiddenException);
    usuarios.exists.mockResolvedValue(false);await expect(abrir()).rejects.toBeInstanceOf(BadRequestException);
  });
  it('solo el investigador asignado puede consultar y completar',async()=>{
    await abrir();
    await expect(service.completar(String(almacenado._id),{},analista)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.detalleGestion(String(almacenado._id),{...investigador,userId:new Types.ObjectId().toString()})).rejects.toBeInstanceOf(ForbiddenException);
    for(const extra of [{numeroDeic:'otro'},{investigadorAsignado:analista.userId},{estadoRegistro:'Aprobado'}])await expect(validar(CompletarMaltratoDto,extra)).rejects.toBeInstanceOf(BadRequestException);
  });
  it('guarda un avance parcial y mantiene la ficha al completarla',async()=>{
    await abrir();await service.completar(String(almacenado._id),{fichaMaltrato:{resenaHecho:'Inicial'}},investigador);
    await service.completar(String(almacenado._id),{fichaMaltrato:{entrevistas:0}},investigador);
    expect(almacenado.fichaMaltrato.resenaHecho).toBe('Inicial');expect(almacenado.fichaMaltrato.entrevistas).toBe(0);expect(drive.uploadFile).not.toHaveBeenCalled();
  });
  it('rechaza cantidades negativas y edades imposibles',async()=>{
    for(const body of [{fichaMaltrato:{entrevistas:-1}},{fichaMaltrato:{fotogramas:1.5}},{victimas:[{nombre:'Prueba',edadReportada:131}]}])await expect(validar(CompletarMaltratoDto,body)).rejects.toBeInstanceOf(BadRequestException);
  });
  it('no permite revisión ni entrega incompleta',async()=>{
    await abrir();const id=String(almacenado._id);
    await expect(service.aprobarRegistro(id,analista.userId)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.rechazarRegistro(id,analista.userId,'Falta documento')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.entregar(id,investigador,pdf)).rejects.toBeInstanceOf(BadRequestException);expect(drive.uploadFile).not.toHaveBeenCalled();
  });
  it.each(['numeroMp','estadoInvestigacion','lugarHechos','victimas'])('impide entregar sin %s',async campo=>{
    await abrir();await completar();almacenado.set(campo,null);
    await expect(service.entregar(String(almacenado._id),investigador,pdf)).rejects.toBeInstanceOf(BadRequestException);expect(drive.uploadFile).not.toHaveBeenCalled();
  });
  it('exige nacimiento o edad de cada víctima y permite sindicados desconocidos',async()=>{
    await abrir();await completar();almacenado.victimas[1].fecha_Nac=null;
    await expect(service.entregar(String(almacenado._id),investigador,pdf)).rejects.toBeInstanceOf(BadRequestException);
    almacenado.victimas[1].edadReportada=10;almacenado.infractores=[];
    await expect(service.entregar(String(almacenado._id),investigador,pdf)).resolves.toBeDefined();
  });
  it('entrega, rechaza, corrige y aprueba el mismo caso conservando PDFs',async()=>{
    await abrir();await completar();const id=String(almacenado._id);
    await service.entregar(id,investigador,pdf);expect(almacenado.expedienteEnPreparacion).toBe(false);
    await expect(service.completar(id,{},investigador)).rejects.toBeInstanceOf(ConflictException);
    await service.rechazarRegistro(id,analista.userId,'Completar informe');
    await service.completar(id,{fichaMaltrato:{observaciones:'Corregido'}},investigador);
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
    for(const method of ['registrarInicial','crearInicial','exportarExcel'])expect(Reflect.getMetadata(ROLES_KEY,CasosMaltratoController.prototype[method])).toEqual([UserRole.ANALISTA]);
    const controller=new CasosMaltratoController(service);
    expect(()=>controller.crearInicial(inicial as any,{user:analista},pdf)).toThrow(BadRequestException);
  });
  it('filtra Mis registros por responsable y oculta borradores de revisión',async()=>{
    const query={populate:jest.fn().mockReturnThis(),sort:jest.fn().mockReturnThis(),exec:jest.fn().mockResolvedValue([])};
    modelo.find=jest.fn().mockReturnValue(query);
    await service.findPendientes();expect(modelo.find.mock.calls[0][0].expedienteEnPreparacion).toEqual({$ne:true});
    await service.findMisRegistros(investigador.userId);
    expect(String(modelo.find.mock.calls[1][0].$or[0].investigadorAsignado)).toBe(investigador.userId);
    expect(modelo.find.mock.calls[1][0].$or[1].procesoMaltrato).toEqual({$ne:true});
  });
});

describe('Maltrato: Excel de 56 columnas',()=>{
  it('genera una fila por víctima, conserva ceros y no repite diligencias',async()=>{
    const c={...inicial,numeroMp:'M0030-2026-100',estadoInvestigacion:'Informado',investigadorAsignado:{nombre:'Investigador de prueba'},victimas:[{nombre:'Uno',edadReportada:0,denuncianteNombre:'Denunciante uno'},{nombre:'Dos',edadReportada:12,denuncianteNombre:'Denunciante dos'}],infractores:[{nombre:'Sindicado uno',parentesco:'POR ESTABLECER'},{nombre:'Sindicado dos',direccion:'Dirección'}],fichaMaltrato:{entrevistas:0,camarasUbicadas:2,fechaEntregaAnalisis:'2026-10-11',observaciones:'=texto'}};
    const wb=new Workbook();await wb.xlsx.load(await generarExcelMaltratos([c]) as any);const s=wb.getWorksheet('MALTRATO 2026')!;
    expect((s.getRow(1).values as any[]).slice(1)).toEqual(headers);expect(s.columnCount).toBe(56);expect(s.rowCount).toBe(3);
    expect(s.getCell('O2').value).toBe(0);expect(s.getCell('P2').value).toBe('MENOR');
    expect(s.getCell('J3').value).toBe('Denunciante dos');expect(s.getCell('X2').value).toBe('Sindicado uno\nSindicado dos');
    expect(s.getCell('AP2').value).toBe(2);expect(s.getCell('AP3').value).toBe('');expect(s.getCell('AZ2').value).toBe(0);
    expect(s.getCell('BC2').value).toBe(2);expect(s.getCell('BC3').value).toBe('');expect(s.getCell('BD2').value).toBe('=texto');
    expect(s.getCell('G2').value).toBeInstanceOf(Date);expect(s.views[0].state).toBe('frozen');expect(s.autoFilter).toBeDefined();
  });
  it('no produce edades o plazos falsos cuando faltan fechas',()=>{
    const fila=filasMaltrato({numeroDeic:'MT000001',victimas:[{nombre:'Anterior'}],fichaMaltrato:{fechaEntregaAnalisis:null}})[0];
    expect(fila).toHaveLength(56);expect(fila[14]).toBe('');expect(fila[15]).toBe('');expect(fila[54]).toBe('');
  });
  it('calcula edad a la recepción y no duplica casos con un MP compartido',async()=>{
    const casos=[{...inicial,victimas:[{nombre:'Prueba',fecha_Nac:'2010-10-10'}],numeroMp:'M0030-2026-100'},{...inicial,numeroDeic:'DEIC51-2026-10-09-002',numeroMp:'M0030-2026-100'}];
    expect(filasMaltrato(casos[0])[0][14]).toBe(15);
    const wb=new Workbook();await wb.xlsx.load(await generarExcelMaltratos(casos) as any);expect(wb.worksheets[0].rowCount).toBe(3);
  });
});
