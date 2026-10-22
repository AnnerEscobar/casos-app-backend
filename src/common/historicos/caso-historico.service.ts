import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { UserRole } from '../../auth/enums/user-role.enum';
import { EstadoRegistro } from '../enums/estado-registro.enum';
import { assertValidCaseNumber, assertValidAlertaMpNumber, assertValidMaltratoMpNumber, assertValidConflictoMpNumber, normalizeCaseNumber, TipoCasoNumero } from '../case-number.validator';
import { CasoHistoricoDto } from './caso-historico.dto';
import { EstadoExpedienteHistorico, OrigenCaso } from './caso-historico.schema';

export interface UsuarioSesion { userId: string; role: UserRole }

// Valida rol, identificadores, estado documental e investigador original antes de incorporar
// el caso histórico y su PDF opcional sin duplicar el DEIC.
export async function incorporarHistorico(
  model: Model<any>, tipo: TipoCasoNumero, dto: CasoHistoricoDto,
  datos: Record<string, any>, usuario: UsuarioSesion,
  documento?: { file: Express.Multer.File; subir: (file: Express.Multer.File, numeroDeic: string) => Promise<string> },
) {
  if (![UserRole.ANALISTA, UserRole.INVESTIGADOR].includes(usuario.role)) {
    throw new ForbiddenException('Tu rol no tiene permitido registrar casos');
  }
  if (documento && ![EstadoExpedienteHistorico.COMPLETO, EstadoExpedienteHistorico.PARCIAL].includes(dto.estadoExpedienteHistorico)) {
    throw new BadRequestException('No se puede adjuntar el expediente de un caso NO_LOCALIZADO.');
  }
  const numeroDeic = assertValidCaseNumber(tipo, dto.numeroDeic);
  const validarMp = { alerta: assertValidAlertaMpNumber, maltrato: assertValidMaltratoMpNumber, conflicto: assertValidConflictoMpNumber };
  const numeroMp = dto.numeroMp == null ? undefined : validarMp[tipo](dto.numeroMp);
  const numeroAlerta = datos.numeroAlerta == null ? undefined : normalizeCaseNumber(datos.numeroAlerta);
  if (numeroAlerta !== undefined && !/^\d+-\d{4}$/.test(numeroAlerta)) {
    throw new BadRequestException('El numero de alerta debe seguir el formato XXXX-AAAA');
  }
  const identificadores: Record<string, string>[] = [{ numeroDeic }];
  if (tipo === 'alerta') {
    if (numeroMp) identificadores.push({ numeroMp });
    if (numeroAlerta) identificadores.push({ numeroAlerta });
  }
  if (await model.exists({ $or: identificadores })) {
    throw new ConflictException('Ya existe un caso con estos identificadores. Utiliza el caso existente.');
  }
  if (dto.investigadorOriginal?.usuarioId && !await model.db.model('Usuario').exists({ _id: dto.investigadorOriginal.usuarioId })) {
    throw new BadRequestException('El usuario del investigador original no existe; puede registrar solamente su nombre.');
  }
  const caso = new model({
    ...datos, numeroDeic, numeroMp,
    ...(tipo === 'alerta' ? { numeroAlerta } : {}),
    origenCaso: OrigenCaso.HISTORICO,
    estadoExpedienteHistorico: dto.estadoExpedienteHistorico,
    fuenteInformacionHistorica: dto.fuenteInformacionHistorica,
    observacionHistorica: dto.observacionHistorica,
    investigadorOriginal: dto.investigadorOriginal,
    anioCaso: dto.anioCaso,
    fechaIncorporacionSistema: new Date(),
    registradoPor: new Types.ObjectId(usuario.userId),
    estadoRegistro: usuario.role === UserRole.ANALISTA ? EstadoRegistro.APROBADO : EstadoRegistro.PENDIENTE,
    fileUrls: [], seguimientos: [], historialRevisiones: [],
  });
  try {
    await caso.validate();
    if (documento) caso.fileUrls = [await documento.subir(documento.file, numeroDeic)];
    await caso.save();
    return caso.populate([
      { path: 'registradoPor', select: 'nombre' },
      { path: 'investigadorOriginal.usuarioId', select: 'nombre' },
    ]);
  } catch (error) {
    if (error.code === 11000) throw new ConflictException('Ya existe un caso con estos identificadores.');
    if (error.name === 'ValidationError') throw new BadRequestException(error.message);
    throw error;
  }
}

// No se infiere el responsable a partir del analista que registra el seguimiento.
// Valida que el responsable seleccionado sea un investigador activo y construye las
// referencias del usuario registrador y del investigador asignado.
export async function auditoriaSeguimiento(model: Model<any>, usuario: UsuarioSesion, asignado?: string) {
  const investigadorId = asignado ?? (usuario.role === UserRole.INVESTIGADOR ? String(usuario.userId) : undefined);
  if (investigadorId) {
    if (!Types.ObjectId.isValid(investigadorId) || !await model.db.model('Usuario').exists({
      _id: investigadorId, role: UserRole.INVESTIGADOR, activo: { $ne: false },
    })) throw new BadRequestException('El investigador asignado debe ser un investigador activo.');
  }
  return {
    registradoPor: new Types.ObjectId(usuario.userId),
    ...(investigadorId ? { investigadorAsignado: new Types.ObjectId(investigadorId) } : {}),
  };
}

// Exige un investigador asignado explícitamente cuando se registra un seguimiento de un
// expediente histórico.
export function validarResponsableHistorico(caso: { origenCaso?: string }, auditoria: { investigadorAsignado?: Types.ObjectId }) {
  if (caso.origenCaso === OrigenCaso.HISTORICO && !auditoria.investigadorAsignado) {
    throw new BadRequestException('Seleccione el investigadorAsignado responsable del seguimiento del caso histórico.');
  }
}
