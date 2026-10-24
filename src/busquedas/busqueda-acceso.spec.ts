import { BadRequestException, ConflictException, ForbiddenException, ValidationPipe } from '@nestjs/common';
import { Types } from 'mongoose';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { BusquedaAccesoService } from './busqueda-acceso.service';
import { BusquedasService } from './busquedas.service';
import { BusquedasController } from './busquedas.controller';
import { CrearSolicitudAccesoDto } from './solicitud-acceso.dto';
import { JwtAuthGuard } from '../auth/Guards/jwt-auth.guard';
import { UserRole } from '../auth/enums/user-role.enum';
const owner = new Types.ObjectId().toString(), other = new Types.ObjectId().toString(), analyst = new Types.ObjectId().toString(), caseId = new Types.ObjectId().toString();
const cadena = (value: any) => ({
    select: jest.fn().mockReturnThis(), sort: jest.fn().mockReturnThis(), populate: jest.fn().mockReturnThis(), lean: jest.fn().mockReturnThis(), exec: jest.fn().mockResolvedValue(value)
});
const sesion = (userId = other, role = UserRole.INVESTIGADOR) => ({ userId, role });
function entorno(tipo = 'Maltrato') {
    const caso: any = {
        _id: caseId, tipo, numeroDeic: 'DEIC51-2026-01-01-1', numeroMp: 'MP-secreto', registradoPor: owner, victimas: [{ nombre: 'Nombre sensible', cui: '1234567890123' }], fileUrls: ['https://drive.test/secreto'], estadoInvestigacion: 'Informado', seguimientos: [], origenCaso: 'SISTEMA'
    };
    const users = [{
            _id: owner, nombre: 'Propietario', role: UserRole.INVESTIGADOR
        }, {
            _id: analyst, nombre: 'Analista', role: UserRole.ANALISTA
        }];
    const usuarioModel = { find: jest.fn(() => cadena(users)) };
    const casoModel = { findById: jest.fn(() => cadena(caso)) };
    const model: any = {
        create: jest.fn(async (dato: any) => ({ toObject: () => ({ ...dato }) })),
        find: jest.fn(() => cadena([])), findById: jest.fn(() => cadena(null)), findOneAndUpdate: jest.fn(() => cadena({ estado: 'PENDIENTE' })), db: { model: jest.fn(name => name === 'Usuario' ? usuarioModel : casoModel) }
    };
    return {
        caso, model, users, usuarioModel, casoModel, service: new BusquedaAccesoService(model)
    };
}
describe('Búsquedas: permisos y solicitudes', () => {
    it('reconoce al asignado del caso aunque el registrador sea analista (QA-004)', async () => {
        const { service, caso } = entorno();
        caso.registradoPor = analyst; caso.investigadorAsignado = new Types.ObjectId(owner);
        const [r] = await service.presentar([caso], sesion(owner), true);
        expect(r.acceso).toBe('PROPIO');
        expect(r.investigador._id).toBe(owner);
    });
    it('una reasignación principal deja de tratar al registrador como responsable', async () => {
        const { service, caso, users } = entorno();
        caso.investigadorAsignado = new Types.ObjectId(other);
        users.push({ _id: other, nombre: 'Asignado actual', role: UserRole.INVESTIGADOR });
        const [r] = await service.presentar([caso], sesion(owner), true);
        expect(r.acceso).toBe('RESTRINGIDO');
        expect(r.investigador._id).toBe(other);
        expect(r.victimas).toBeUndefined();
    });
    describe('bandeja de accesos', () => {
        const solicitud = () => ({ _id: new Types.ObjectId(), tipo: 'maltrato', casoId: caseId,
            numeroDeic: 'DEIC-1', solicitante: { _id: other, nombre: 'Solicitante' },
            responsable: { _id: owner, nombre: 'Propietario' }, estado: 'PENDIENTE', motivo: 'Consultar antecedentes' });
        function bandejaEntorno() {
            const e = entorno();
            (e.casoModel as any).find = jest.fn(() => cadena([e.caso]));
            const s = solicitud(); e.model.find.mockImplementation(() => cadena([s]));
            return { ...e, s };
        }
        it('el propietario ve solicitudes por autorizar y nombres, sin archivos ni datos completos', async () => {
            const { service } = bandejaEntorno();
            const [s] = await service.bandeja(sesion(owner));
            expect(s).toMatchObject({ puedeResolver: true, propia: false, puedeVer: true, persona: 'Nombre sensible' });
            expect(s).not.toHaveProperty('fileUrls');
            expect(s).not.toHaveProperty('victimas');
        });
        it('el solicitante ve el estado pero no el nombre de una persona restringida', async () => {
            const { service } = bandejaEntorno();
            const [s] = await service.bandeja(sesion());
            expect(s).toMatchObject({ puedeResolver: false, propia: true, puedeVer: false, persona: '' });
        });
        it.each([UserRole.ANALISTA, UserRole.JEFE, UserRole.ADMIN])('%s puede atender solicitudes ajenas', async role => {
            const { service } = bandejaEntorno();
            expect((await service.bandeja(sesion(analyst, role)))[0].puedeResolver).toBe(true);
        });
        it('ni un analista puede autorizar su propia solicitud', async () => {
            const { service, s } = bandejaEntorno(); s.solicitante._id = analyst;
            expect((await service.bandeja(sesion(analyst, UserRole.ANALISTA)))[0].puedeResolver).toBe(false);
        });
        it('el responsable anterior deja de ver solicitudes ajenas', async () => {
            const { service, caso } = bandejaEntorno(); caso.registradoPor = analyst;
            expect(await service.bandeja(sesion(owner))).toEqual([]);
        });
        it('el responsable actual puede resolver aunque la solicitud guarde otro responsable', async () => {
            const { service, s, model } = bandejaEntorno(); s.responsable._id = analyst;
            expect((await service.bandeja(sesion(owner)))[0].puedeResolver).toBe(true);
            expect(model.find.mock.calls[0][0].$or[2].casoId.$in.map(String)).toContain(caseId);
        });
        it('un permiso autorizado permite consultar y renunciar, sin volver a autorizar', async () => {
            const { service, s } = bandejaEntorno(); s.estado = 'AUTORIZADA';
            expect((await service.bandeja(sesion()))[0]).toMatchObject({ puedeResolver: false, puedeRevocar: true, puedeVer: true });
        });
        it('rechaza sesiones sin rol autorizado', async () => {
            const { service } = bandejaEntorno();
            await expect(service.bandeja(sesion(other, 'Otro' as any))).rejects.toBeInstanceOf(ForbiddenException);
        });
    });
    it.each(['Alerta', 'Maltrato', 'Conflicto'])('%s: exacta ajena devuelve exclusivamente metadatos permitidos', async (tipo) => {
        const { service, caso } = entorno(tipo);
        const [r] = await service.presentar([caso], sesion(), true);
        expect(Object.keys(r).sort()).toEqual([
            '_id', 'tipo', 'numeroDeic', 'acceso', 'investigador', 'solicitud'
        ].sort());
        expect(r.acceso).toBe('RESTRINGIDO');
        expect(JSON.stringify(r)).not.toMatch(/secreto|sensible|1234567890123/);
    });
    it('nombre, CUI y filtros no revelan expedientes ajenos', async () => {
        const { service, caso } = entorno();
        expect(await service.presentar([caso], sesion())).toEqual([]);
    });
    it('el propietario conserva acceso y documentos', async () => {
        const { service, caso } = entorno();
        const [r] = await service.presentar([caso], sesion(owner));
        expect(r.acceso).toBe('PROPIO');
        expect(r.fileUrls).toEqual(caso.fileUrls);
    });
    it.each([UserRole.ADMIN, UserRole.ANALISTA, UserRole.JEFE])('%s consulta institucional', async (role) => {
        const { service, caso } = entorno();
        const [r] = await service.presentar([caso], sesion(analyst, role));
        expect(r.acceso).toBe('INSTITUCIONAL');
    });
    it('un seguimiento asignado concede acceso sin cambiar propietario', async () => {
        const { service, caso } = entorno();
        caso.seguimientos = [{
                investigadorAsignado: other, fecha: '2026-01-01', estado: 'Desestimado'
            }];
        const [r] = await service.presentar([caso], sesion());
        expect(r.acceso).toBe('SEGUIMIENTO_ASIGNADO');
        expect(r.investigador._id).toBe(owner);
        expect(r.estadoInvestigacion).toBe('Desestimado');
        expect(r.cantidadSeguimientos).toBe(1);
    });
    it('histórico identifica al investigador original y no al analista incorporador', async () => {
        const { service, caso } = entorno();
        caso.origenCaso = 'HISTORICO';
        caso.registradoPor = analyst;
        caso.investigadorOriginal = { usuarioId: owner };
        const [r] = await service.presentar([caso], sesion(owner));
        expect(r.acceso).toBe('PROPIO');
    });
    it('una solicitud pendiente persiste en la card restringida', async () => {
        const { service, caso, model } = entorno();
        model.find.mockReturnValue(cadena([{
                tipo: 'maltrato', casoId: caseId, estado: 'PENDIENTE', fechaSolicitud: '2026-01-01'
            }]));
        const [r] = await service.presentar([caso], sesion(), true);
        expect(r.acceso).toBe('RESTRINGIDO');
        expect(r.solicitud.estado).toBe('PENDIENTE');
    });
    it('una autorización concede consulta y conserva el propietario real', async () => {
        const { service, caso, model } = entorno();
        model.find.mockReturnValue(cadena([{
                tipo: 'maltrato', casoId: caseId, estado: 'AUTORIZADA'
            }]));
        const r = await service.detalle('maltrato', caseId, sesion());
        expect(r.acceso).toBe('AUTORIZADO');
        expect(r.investigador._id).toBe(owner);
    });
    it('una autorización de otro tipo no se reutiliza', async () => {
        const { service, caso, model } = entorno();
        model.find.mockReturnValue(cadena([{
                tipo: 'alerta', casoId: caseId, estado: 'AUTORIZADA'
            }]));
        expect(await service.presentar([caso], sesion())).toEqual([]);
    });
    it('el detalle vuelve a verificar permisos', async () => {
        const { service } = entorno();
        await expect(service.detalle('maltrato', caseId, sesion())).rejects.toBeInstanceOf(ForbiddenException);
    });
    it('registra motivo y solicitante desde JWT, sin modificar el caso', async () => {
        const { service, model, caso } = entorno();
        await service.solicitar({
            tipo: 'maltrato', casoId: caseId, motivo: 'Nuevo lineamiento recibido'
        }, sesion());
        expect(model.create).toHaveBeenCalledWith(expect.objectContaining({ solicitante: other, casoId: caseId,
            estado: 'PENDIENTE', responsable: owner, motivo: 'Nuevo lineamiento recibido' }));
        expect(model.findOneAndUpdate).not.toHaveBeenCalled();
        expect(caso.registradoPor).toBe(owner);
    });
    it('evita solicitudes duplicadas antes de escribir', async () => {
        const { service, model } = entorno();
        model.find.mockReturnValue(cadena([{
                tipo: 'maltrato', casoId: caseId, estado: 'PENDIENTE'
            }]));
        await expect(service.solicitar({
            tipo: 'maltrato', casoId: caseId, motivo: 'Nuevo lineamiento'
        }, sesion())).rejects.toBeInstanceOf(ConflictException);
        expect(model.findOneAndUpdate).not.toHaveBeenCalled();
    });
    it('convierte carrera de duplicados a 409', async () => {
        const { service, model } = entorno();
        model.create.mockRejectedValue({ code: 11000 });
        await expect(service.solicitar({
            tipo: 'maltrato', casoId: caseId, motivo: 'Nuevo lineamiento'
        }, sesion())).rejects.toBeInstanceOf(ConflictException);
    });
    it('rechaza autoautorización y resolución ajena', async () => {
        const { service, model } = entorno();
        model.findById.mockReturnValue(cadena({
            _id: caseId, tipo: 'maltrato', casoId: caseId, solicitante: other, estado: 'PENDIENTE'
        }));
        await expect(service.resolver(caseId, 'AUTORIZADA', sesion())).rejects.toBeInstanceOf(ForbiddenException);
        await expect(service.resolver(caseId, 'AUTORIZADA', sesion(new Types.ObjectId().toString()))).rejects.toBeInstanceOf(ForbiddenException);
        expect(model.findOneAndUpdate).not.toHaveBeenCalled();
    });
    it.each([sesion(owner), sesion(analyst, UserRole.ANALISTA), sesion(analyst, UserRole.JEFE), sesion(analyst, UserRole.ADMIN)])('propietario/institución resuelven de forma atómica: %j', async (u) => {
        const { service, model } = entorno();
        model.findById.mockReturnValue(cadena({
            _id: caseId, tipo: 'maltrato', casoId: caseId, solicitante: other, estado: 'PENDIENTE'
        }));
        await service.resolver(caseId, 'AUTORIZADA', u);
        expect(model.findOneAndUpdate).toHaveBeenCalledWith({ _id: caseId, estado: 'PENDIENTE' }, { $set: expect.objectContaining({ estado: 'AUTORIZADA', resueltoPor: u.userId }) }, expect.anything());
    });
    it('no resuelve dos veces una solicitud', async () => {
        const { service, model } = entorno();
        model.findById.mockReturnValue(cadena({
            _id: caseId, tipo: 'maltrato', casoId: caseId, solicitante: other
        }));
        model.findOneAndUpdate.mockReturnValue(cadena(null));
        await expect(service.resolver(caseId, 'RECHAZADA', sesion(owner))).rejects.toBeInstanceOf(ConflictException);
    });
    it('bandeja investigador limitada al solicitante/responsable', async () => {
        const { service, model } = entorno();
        await service.listar(sesion());
        expect(model.find).toHaveBeenCalledWith({ $or: [{ solicitante: other }, { responsable: other }] });
    });
    it('rechaza auditoría o identidad enviada en el cuerpo', async () => {
        const pipe = new ValidationPipe({
            transform: true, whitelist: true, forbidNonWhitelisted: true
        });
        await expect(pipe.transform({
            tipo: 'maltrato', casoId: caseId, motivo: 'Nuevo lineamiento', solicitante: owner
        }, { type: 'body', metatype: CrearSolicitudAccesoDto })).rejects.toBeInstanceOf(BadRequestException);
    });
});
describe('HTTP de búsquedas', () => {
    let app: any;
    let usuario: any;
    const env = entorno();
    beforeEach(() => { usuario = { userId: new Types.ObjectId(other), role: UserRole.INVESTIGADOR }; });
    beforeAll(async () => {
        const mod = await Test.createTestingModule({ controllers: [BusquedasController], providers: [{ provide: BusquedasService, useValue: { buscarPorNumeroDeic: async () => [env.caso], buscarPorNombre: async () => [env.caso], buscarCasosFiltrados: async () => [env.caso] } }, { provide: BusquedaAccesoService, useValue: env.service }] }).overrideGuard(JwtAuthGuard).useValue({ canActivate: ctx => {
                ctx.switchToHttp().getRequest().user = usuario;
                return true;
            } }).compile();
        app = mod.createNestApplication();
        app.useGlobalPipes(new ValidationPipe({
            transform: true, whitelist: true, forbidNonWhitelisted: true
        }));
        await app.init();
    });
    afterAll(async () => app?.close());
    it.each([
        ['/busquedas/por-nombre', { nombre: 'Nombre' }],
        ['/busquedas/buscar', { tipoCaso: 'Maltrato', estado: 'Informado' }],
        ['/busquedas/por-numero-deic', { numeroDeic: env.caso.numeroDeic }],
    ])('%s reconoce al propietario con el ObjectId real de la sesión', async (ruta, query) => {
        usuario.userId = new Types.ObjectId(owner);
        const r = await request(app.getHttpServer()).get(ruta).query(query).expect(200);
        expect(r.body).toHaveLength(1);
        expect(r.body[0].acceso).toBe('PROPIO');
        expect(r.body[0].investigador._id).toBe(owner);
        await request(app.getHttpServer()).get('/busquedas/expediente/maltrato/' + caseId).expect(200);
    });
    it('exacta retorna card restringida sin PDF/personas', async () => {
        const r = await request(app.getHttpServer()).get('/busquedas/por-numero-deic').query({ numeroDeic: env.caso.numeroDeic }).expect(200);
        expect(r.body[0].acceso).toBe('RESTRINGIDO');
        expect(r.body[0].fileUrls).toBeUndefined();
        expect(r.body[0].victimas).toBeUndefined();
    });
    it('consulta amplia y detalle no eluden restricciones', async () => {
        const r = await request(app.getHttpServer()).get('/busquedas/por-nombre').query({ nombre: 'Nombre' }).expect(200);
        expect(r.body).toEqual([]);
        await request(app.getHttpServer()).get('/busquedas/expediente/maltrato/' + caseId).expect(403);
    });
    it('motivo inválido no se almacena', async () => {
        await request(app.getHttpServer()).post('/busquedas/solicitudes').send({
            tipo: 'maltrato', casoId: caseId, motivo: 'a'
        }).expect(400);
    });
});
describe('Identidad ObjectId en permisos de búsquedas', () => {
    const real = (value: string, role = UserRole.INVESTIGADOR): any => ({ userId: new Types.ObjectId(value), role });
    it.each(['Alerta', 'Maltrato', 'Conflicto'])('%s reconoce propietario y seguimiento con referencias Mongo', async tipo => {
        const { service, caso } = entorno(tipo);
        caso.registradoPor = new Types.ObjectId(owner);
        expect((await service.presentar([caso], real(owner)))[0].acceso).toBe('PROPIO');
        caso.seguimientos = [{ investigadorAsignado: new Types.ObjectId(other) }];
        expect((await service.presentar([caso], real(other)))[0].acceso).toBe('SEGUIMIENTO_ASIGNADO');
    });
    it('el propietario histórico puede consultar sin solicitar acceso', async () => {
        const { service, caso } = entorno();
        caso.origenCaso = 'HISTORICO';
        caso.registradoPor = new Types.ObjectId(analyst);
        caso.investigadorOriginal = { usuarioId: new Types.ObjectId(owner) };
        expect((await service.presentar([caso], real(owner)))[0].acceso).toBe('PROPIO');
    });
    it('el propietario resuelve solicitudes de otros investigadores', async () => {
        const { service, model } = entorno();
        model.findById.mockReturnValue(cadena({ tipo: 'maltrato', casoId: caseId, solicitante: new Types.ObjectId(other) }));
        await service.resolver(caseId, 'AUTORIZADA', real(owner));
        expect(model.findOneAndUpdate).toHaveBeenCalled();
    });
    it('impide autoautorización institucional con dos instancias ObjectId del mismo valor', async () => {
        const { service, model } = entorno();
        model.findById.mockReturnValue(cadena({ tipo: 'maltrato', casoId: caseId, solicitante: new Types.ObjectId(analyst) }));
        await expect(service.resolver(caseId, 'AUTORIZADA', real(analyst, UserRole.ANALISTA))).rejects.toBeInstanceOf(ForbiddenException);
        expect(model.findOneAndUpdate).not.toHaveBeenCalled();
    });
});
describe('Revocación y expedientes compartidos', () => {
    it.each(['texto', 'ObjectId'])('recupera permisos con casoId almacenado como %s usando comparación BSON', async formato => {
        const { service, model, caso, casoModel } = entorno();
        caso._id = new Types.ObjectId(caseId);
        const permiso = { tipo: 'maltrato', casoId: formato === 'texto' ? caseId : new Types.ObjectId(caseId), estado: 'AUTORIZADA' };
        model.find.mockImplementation(query => {
            const coincide = !query.casoId || query.casoId.$in.some(valor =>
                typeof valor === typeof permiso.casoId && String(valor) === String(permiso.casoId));
            return cadena(coincide ? [permiso] : []);
        });
        (casoModel as any).find = jest.fn(() => cadena([caso]));
        const compartidos = await service.compartidos(sesion());
        expect(compartidos).toHaveLength(1);
        expect(compartidos[0].acceso).toBe('AUTORIZADO');
        const detalle = await service.detalle('maltrato', caseId, sesion());
        expect(detalle.fileUrls).toEqual(caso.fileUrls);
        expect(detalle.victimas).toEqual(caso.victimas);
    });
    it.each([sesion(other), sesion(owner), sesion(analyst, UserRole.JEFE)])('beneficiario, propietario y jefe revocan: %j', async usuario => {
        const { service, model } = entorno();
        model.findById.mockReturnValue(cadena({ tipo: 'maltrato', casoId: caseId, solicitante: new Types.ObjectId(other), estado: 'AUTORIZADA' }));
        await service.revocar(caseId, usuario);
        expect(model.findOneAndUpdate).toHaveBeenCalledWith({ _id: caseId, estado: 'AUTORIZADA' }, { $set: expect.objectContaining({ estado: 'REVOCADA', revocadoPor: usuario.userId, fechaRevocacion: expect.any(Date) }) }, expect.objectContaining({ runValidators: true }));
    });
    it('un investigador ajeno no revoca y una revocación repetida devuelve conflicto', async () => {
        const { service, model } = entorno();
        model.findById.mockReturnValue(cadena({ tipo: 'maltrato', casoId: caseId, solicitante: other }));
        await expect(service.revocar(caseId, sesion(new Types.ObjectId().toString()))).rejects.toBeInstanceOf(ForbiddenException);
        expect(model.findOneAndUpdate).not.toHaveBeenCalled();
        model.findOneAndUpdate.mockReturnValue(cadena(null));
        await expect(service.revocar(caseId, sesion(owner))).rejects.toBeInstanceOf(ConflictException);
    });
    it('revocar oculta el caso en búsquedas y bloquea el detalle, conservando la asignación formal', async () => {
        const { service, model, caso } = entorno();
        model.find.mockReturnValue(cadena([{ tipo: 'maltrato', casoId: caseId, estado: 'REVOCADA' }]));
        expect(await service.presentar([caso], sesion())).toEqual([]);
        await expect(service.detalle('maltrato', caseId, sesion())).rejects.toBeInstanceOf(ForbiddenException);
        caso.seguimientos = [{ investigadorAsignado: new Types.ObjectId(other) }];
        expect((await service.presentar([caso], sesion()))[0].acceso).toBe('SEGUIMIENTO_ASIGNADO');
    });
    it('permite solicitar de nuevo después de la revocación', async () => {
        const { service, model } = entorno();
        model.find.mockReturnValue(cadena([{ tipo: 'maltrato', casoId: caseId, estado: 'REVOCADA' }]));
        await service.solicitar({ tipo: 'maltrato', casoId: caseId, motivo: 'Nueva necesidad de consulta' }, sesion());
        expect(model.findOneAndUpdate).toHaveBeenCalledWith(expect.objectContaining({ estado: { $in: ['RECHAZADA', 'REVOCADA'] } }), expect.anything(), expect.anything());
    });
    it('compartidos consulta permisos de la sesión, conserva autorizados y excluye propios', async () => {
        const { service, model, caso, casoModel } = entorno();
        model.find.mockReturnValue(cadena([{ tipo: 'maltrato', casoId: caseId, estado: 'AUTORIZADA' }]));
        (casoModel as any).find = jest.fn(() => cadena([caso]));
        const resultados = await service.compartidos(sesion());
        expect(resultados).toHaveLength(1);
        expect(resultados[0].acceso).toBe('AUTORIZADO');
        expect(model.find).toHaveBeenCalledWith({ solicitante: other, estado: 'AUTORIZADA' });
        expect(await service.compartidos(sesion(owner))).toEqual([]);
    });
});
describe('Filtros de búsqueda', () => {
    const model = () => ({ find: jest.fn(() => ({ ...cadena([]), exec: jest.fn().mockResolvedValue([{ toObject: () => ({ numeroDeic: 'caso' }) }]) })) });
    it('todos los tipos consultan las tres colecciones', async () => {
        const a = model(), m = model(), c = model();
        const s = new BusquedasService(a as any, m as any, c as any);
        expect(await s.buscarCasosFiltrados({})).toHaveLength(3);
    });
    it('Conflicto filtra Desestimado y acepta un extremo de fecha', async () => {
        const a = model(), m = model(), c = model();
        const s = new BusquedasService(a as any, m as any, c as any);
        await s.buscarCasosFiltrados({
            tipoCaso: 'Conflicto', estado: 'Desestimado', fechaInicio: '2026-01-01'
        });
        expect(c.find).toHaveBeenCalledWith({ estadoInvestigacion: 'Desestimado', createdAt: { $gte: new Date('2026-01-01') } });
        expect(a.find).not.toHaveBeenCalled();
    });
    it('rechaza fechas inválidas e invertidas', async () => {
        const s = new BusquedasService(model() as any, model() as any, model() as any);
        await expect(s.buscarCasosFiltrados({ fechaInicio: 'incorrecta' })).rejects.toBeInstanceOf(BadRequestException);
        await expect(s.buscarCasosFiltrados({ fechaInicio: '2026-02-01', fechaFin: '2026-01-01' })).rejects.toBeInstanceOf(BadRequestException);
    });
});
