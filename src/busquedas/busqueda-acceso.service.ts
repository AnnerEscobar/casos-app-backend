import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { SolicitudAcceso } from './solicitud-acceso.schema';
import { UserRole } from '../auth/enums/user-role.enum';
import { UsuarioSesion } from '../common/historicos/caso-historico.service';
import { CrearSolicitudAccesoDto } from './solicitud-acceso.dto';
import { CasosAlerta } from '../casos-alerta/entities/casos-alerta.entity';
import { CasosMaltrato } from '../casos-maltrato/entities/casos-maltrato.entity';
import { CasosConflicto } from '../casos-conflicto/entities/casos-conflicto.entity';
const id = (v: any): string => String(v?._id ?? v ?? '');
export const tipoBusqueda = (v: string): string => v?.toLowerCase().includes('alerta') ? 'alerta' : v?.toLowerCase();
export const institucional = (u: UsuarioSesion): boolean => [UserRole.ADMIN, UserRole.ANALISTA, UserRole.JEFE].includes(u?.role);
@Injectable()
export class BusquedaAccesoService {
    constructor(
    @InjectModel(SolicitudAcceso.name)
    private readonly solicitudes: Model<SolicitudAcceso>) {
    }
    private validarSesion(u: UsuarioSesion) {
        if (!u || ![UserRole.ADMIN, UserRole.ANALISTA, UserRole.JEFE, UserRole.INVESTIGADOR].includes(u.role))
            throw new ForbiddenException();
    }
    private async usuarios(casos: any[]) {
        const ids = new Set<string>();
        for (const c of casos)
            for (const v of [c.registradoPor, c.revisadoPor, c.investigadorOriginal?.usuarioId, ...(c.historialRevisiones || []).map(r => r.usuario), ...(c.seguimientos || []).flatMap(s => [s.investigadorAsignado, s.registradoPor])]) {
                if (Types.ObjectId.isValid(id(v)))
                    ids.add(id(v));
            }
        const users = ids.size ? await this.solicitudes.db.model('Usuario').find({ _id: { $in: [...ids] } }).select('_id nombre role').lean().exec() : [];
        return new Map<string, any>(users.map(u => [id(u), u]));
    }
    private responsable(c: any, users: Map<string, any>) {
        const original = c.origenCaso === 'HISTORICO' ? users.get(id(c.investigadorOriginal?.usuarioId)) : undefined;
        const registrado = users.get(id(c.registradoPor));
        const user = original?.role === UserRole.INVESTIGADOR ? original : registrado?.role === UserRole.INVESTIGADOR ? registrado : undefined;
        return user ? { _id: id(user), nombre: user.nombre } : null;
    }
    async presentar(casos: any[], usuario: UsuarioSesion, exacta = false): Promise<any[]> {
        this.validarSesion(usuario);
        const users = await this.usuarios(casos);
        const solicitudes = usuario.role === UserRole.INVESTIGADOR && casos.length
            // Los permisos existentes guardaron casoId como texto en el campo Mixed.
            // Mongo no considera iguales ese texto y el ObjectId del expediente.
            ? await this.solicitudes.find({ solicitante: usuario.userId, casoId: { $in: casos.flatMap(c => {
                const valor = id(c);
                return Types.ObjectId.isValid(valor) ? [valor, new Types.ObjectId(valor)] : [valor];
            }) } }).lean().exec() : [];
        const resultado = [];
        for (const caso of casos) {
            const responsable = this.responsable(caso, users);
            const tipo = tipoBusqueda(caso.tipo);
            const solicitud: any = solicitudes.find(s => id(s.casoId) === id(caso) && s.tipo === tipo);
            // JwtStrategy entrega un ObjectId en ejecución; comparar por su valor.
            const propio = responsable?._id === id(usuario.userId);
            const asignado = (caso.seguimientos || []).some(s => id(s.investigadorAsignado) === id(usuario.userId));
            const autorizado = solicitud?.estado === 'AUTORIZADA';
            const permitido = institucional(usuario) || propio || asignado || autorizado;
            const acceso = permitido ? institucional(usuario) ? 'INSTITUCIONAL' : propio ? 'PROPIO' : asignado ? 'SEGUIMIENTO_ASIGNADO' : 'AUTORIZADO' : 'RESTRINGIDO';
            const metadata = {
                acceso, investigador: responsable, solicitud: solicitud ? {
                    _id: id(solicitud), estado: solicitud.estado, fechaSolicitud: solicitud.fechaSolicitud
                } : null
            };
            if (!permitido) {
                if (exacta)
                    resultado.push({
                        _id: id(caso), tipo: caso.tipo, numeroDeic: caso.numeroDeic, ...metadata
                    });
                continue;
            }
            const seguimientos = caso.seguimientos || [];
            const ultimo = seguimientos[seguimientos.length - 1];
            resultado.push({
                ...caso, ...metadata, cantidadSeguimientos: seguimientos.length,
                ultimoMovimiento: ultimo?.fecha || caso.updatedAt || caso.createdAt || caso.fechaIncorporacionSistema,
                estadoInvestigacion: ultimo?.nuevoEstado || ultimo?.estado || caso.estadoInvestigacion
            });
        }
        return resultado;
    }
    private async cargar(tipo: string, casoId: string) {
        const nombres = {
            alerta: CasosAlerta.name, maltrato: CasosMaltrato.name, conflicto: CasosConflicto.name
        };
        if (!nombres[tipo] || !Types.ObjectId.isValid(casoId))
            throw new BadRequestException('Expediente inválido.');
        const caso = await this.solicitudes.db.model(nombres[tipo]).findById(casoId).lean().exec();
        if (!caso)
            throw new NotFoundException('No se encontró el expediente.');
        return { ...caso, tipo: tipo === 'alerta' ? 'Alerta' : tipo === 'maltrato' ? 'Maltrato' : 'Conflicto' };
    }
    async detalle(tipo: string, casoId: string, usuario: UsuarioSesion) {
        const [caso] = await this.presentar([await this.cargar(tipo, casoId)], usuario, true);
        if (caso.acceso === 'RESTRINGIDO')
            throw new ForbiddenException('Se requiere autorización para consultar este expediente.');
        const users = await this.usuarios([caso]);
        const nombre = (v: any) => users.get(id(v))?.nombre || null;
        return {
            ...caso, registradoPorNombre: nombre(caso.registradoPor), revisadoPorNombre: nombre(caso.revisadoPor),
            seguimientos: (caso.seguimientos || []).map(s => ({ ...s, registradoPorNombre: nombre(s.registradoPor), investigadorAsignadoNombre: nombre(s.investigadorAsignado) })),
            historialRevisiones: (caso.historialRevisiones || []).map(r => ({ ...r, usuarioNombre: nombre(r.usuario) })),
        };
    }
    async solicitar(dto: CrearSolicitudAccesoDto, usuario: UsuarioSesion) {
        this.validarSesion(usuario);
        if (usuario.role !== UserRole.INVESTIGADOR)
            throw new ForbiddenException('Solo los investigadores solicitan acceso.');
        const [caso] = await this.presentar([await this.cargar(dto.tipo, dto.casoId)], usuario, true);
        if (caso.acceso !== 'RESTRINGIDO')
            throw new ConflictException('Ya tienes acceso al expediente.');
        if (caso.solicitud?.estado === 'PENDIENTE')
            throw new ConflictException('Ya existe una solicitud pendiente.');
        try {
            return await this.solicitudes.findOneAndUpdate({
                tipo: dto.tipo, casoId: dto.casoId, solicitante: usuario.userId, estado: { $in: ['RECHAZADA', 'REVOCADA'] }
            }, { $set: {
                    numeroDeic: caso.numeroDeic, motivo: dto.motivo, responsable: caso.investigador?._id ?? null, estado: 'PENDIENTE', fechaSolicitud: new Date()
                }, $unset: { resueltoPor: '', fechaResolucion: '' } }, {
                upsert: true, new: true, runValidators: true
            }).lean().exec();
        }
        catch (error) {
            if (error.code === 11000)
                throw new ConflictException('La solicitud ya fue registrada. Actualiza la búsqueda.');
            throw error;
        }
    }
    async investigadores(usuario: UsuarioSesion) {
        if (!institucional(usuario))
            throw new ForbiddenException();
        return this.solicitudes.db.model('Usuario').find({ role: UserRole.INVESTIGADOR }).select('_id nombre').sort({ nombre: 1 }).lean().exec();
    }
    async compartidos(usuario: UsuarioSesion) {
        this.validarSesion(usuario);
        if (usuario.role !== UserRole.INVESTIGADOR) return [];
        const permisos = await this.solicitudes.find({ solicitante: usuario.userId, estado: 'AUTORIZADA' }).lean().exec();
        const modelos = { alerta: CasosAlerta.name, maltrato: CasosMaltrato.name, conflicto: CasosConflicto.name };
        const grupos = await Promise.all(Object.entries(modelos).map(async ([tipo, nombre]) => {
            const casos = await this.solicitudes.db.model(nombre).find({ $or: [
                { _id: { $in: permisos.filter(p => p.tipo === tipo).map(p => p.casoId) } },
                { 'seguimientos.investigadorAsignado': usuario.userId },
            ] }).lean().exec();
            return casos.map(c => ({ ...c, tipo }));
        }));
        const visibles = await this.presentar(grupos.flat(), usuario);
        return visibles.filter(c => c.acceso !== 'PROPIO');
    }
    async revocar(solicitudId: string, usuario: UsuarioSesion) {
        this.validarSesion(usuario);
        if (!Types.ObjectId.isValid(solicitudId)) throw new BadRequestException('Solicitud inválida.');
        const solicitud = await this.solicitudes.findById(solicitudId).lean().exec();
        if (!solicitud) throw new NotFoundException('Solicitud no encontrada.');
        const caso = await this.cargar(solicitud.tipo, id(solicitud.casoId));
        const responsable = this.responsable(caso, await this.usuarios([caso]));
        if (!institucional(usuario) && id(solicitud.solicitante) !== id(usuario.userId) && responsable?._id !== id(usuario.userId))
            throw new ForbiddenException('No puedes revocar este permiso.');
        const updated = await this.solicitudes.findOneAndUpdate({ _id: solicitudId, estado: 'AUTORIZADA' }, {
            $set: { estado: 'REVOCADA', revocadoPor: usuario.userId, fechaRevocacion: new Date() },
        }, { new: true, runValidators: true }).lean().exec();
        if (!updated) throw new ConflictException('El permiso ya no está autorizado.');
        return updated;
    }
    async listar(usuario: UsuarioSesion) {
        this.validarSesion(usuario);
        const filtro = institucional(usuario) ? {} : { $or: [{ solicitante: usuario.userId }, { responsable: usuario.userId }] };
        return this.solicitudes.find(filtro).sort({ fechaSolicitud: -1 }).populate('solicitante responsable resueltoPor', 'nombre').lean().exec();
    }
    async bandeja(usuario: UsuarioSesion) {
        this.validarSesion(usuario);
        const modelos = { alerta: CasosAlerta.name, maltrato: CasosMaltrato.name, conflicto: CasosConflicto.name };
        const variantes = (valor: any) => Types.ObjectId.isValid(id(valor)) ? [id(valor), new Types.ObjectId(id(valor))] : [id(valor)];
        let filtro: any = {};
        if (!institucional(usuario)) {
            // Incluye al responsable actual aunque el caso haya cambiado de investigador.
            const propios = await Promise.all(Object.values(modelos).map(nombre => this.solicitudes.db.model(nombre).find({ $or: [
                { registradoPor: { $in: variantes(usuario.userId) } },
                { 'investigadorOriginal.usuarioId': { $in: variantes(usuario.userId) } },
            ] }).select('_id').lean().exec()));
            filtro = { $or: [
                { solicitante: { $in: variantes(usuario.userId) } },
                { responsable: { $in: variantes(usuario.userId) } },
                { casoId: { $in: propios.flat().flatMap(c => variantes(c)) } },
            ] };
        }
        const solicitudes: any[] = await this.solicitudes.find(filtro).sort({ fechaSolicitud: -1 }).populate('solicitante responsable resueltoPor', 'nombre').lean().exec();
        if (!solicitudes.length) return [];
        const grupos = await Promise.all(Object.entries(modelos).map(async ([tipo, nombre]) => {
            const ids = solicitudes.filter(s => s.tipo === tipo).map(s => s.casoId);
            if (!ids.length) return [];
            const casos = await this.solicitudes.db.model(nombre).find({ _id: { $in: ids } })
                .select('_id registradoPor origenCaso investigadorOriginal nombreDesaparecido victimas.nombre infractores.nombre seguimientos.investigadorAsignado').lean().exec();
            return casos.map(c => ({ ...c, tipo }));
        }));
        const casos = await this.presentar(grupos.flat(), usuario, true);
        const porCaso = new Map(casos.map(c => [`${tipoBusqueda(c.tipo)}:${id(c)}`, c]));
        return solicitudes.flatMap(s => {
            const c = porCaso.get(`${s.tipo}:${id(s.casoId)}`);
            const propia = id(s.solicitante) === id(usuario.userId);
            const responsable = c?.investigador || null;
            const gestor = institucional(usuario) || responsable?._id === id(usuario.userId);
            if (!propia && !gestor) return [];
            const puedeVer = !!c && c.acceso !== 'RESTRINGIDO';
            const personas = !puedeVer ? [] : c.nombreDesaparecido ? [c.nombreDesaparecido] :
                ((s.tipo === 'conflicto' ? c.infractores : c.victimas) || []).map(p => p.nombre).filter(Boolean);
            return [{ ...s, _id: id(s), casoId: id(s.casoId), responsable,
                persona: personas.join(', '), propia, puedeVer,
                puedeResolver: !!c && gestor && !propia && s.estado === 'PENDIENTE',
                puedeRevocar: !!c && (gestor || propia) && s.estado === 'AUTORIZADA',
            }];
        });
    }
    async resolver(solicitudId: string, estado: string, usuario: UsuarioSesion) {
        this.validarSesion(usuario);
        if (!Types.ObjectId.isValid(solicitudId))
            throw new BadRequestException('Solicitud inválida.');
        const solicitud = await this.solicitudes.findById(solicitudId).lean().exec();
        if (!solicitud)
            throw new NotFoundException('Solicitud no encontrada.');
        if (id(solicitud.solicitante) === id(usuario.userId))
            throw new ForbiddenException('No puedes autorizar tu propia solicitud.');
        const caso = await this.cargar(solicitud.tipo, id(solicitud.casoId));
        const responsable = this.responsable(caso, await this.usuarios([caso]));
        if (!institucional(usuario) && responsable?._id !== id(usuario.userId))
            throw new ForbiddenException('No puedes resolver esta solicitud.');
        const updated = await this.solicitudes.findOneAndUpdate({ _id: solicitudId, estado: 'PENDIENTE' }, { $set: {
                estado, resueltoPor: usuario.userId, fechaResolucion: new Date()
            } }, { new: true, runValidators: true }).lean().exec();
        if (!updated)
            throw new ConflictException('La solicitud ya fue resuelta.');
        return updated;
    }
}
