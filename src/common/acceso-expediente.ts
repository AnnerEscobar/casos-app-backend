import { ConflictException, ForbiddenException } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { UserRole } from '../auth/enums/user-role.enum';
import { UsuarioSesion } from './historicos/caso-historico.service';

export const referenciaId = (valor: any): string => String(valor?._id ?? valor ?? '');
export const accesoInstitucional = (usuario: UsuarioSesion): boolean =>
  [UserRole.ADMIN, UserRole.ANALISTA, UserRole.JEFE].includes(usuario?.role);

// Una asignación explícita prevalece sobre el origen histórico y el registrador anterior.
export const responsableExpediente = (caso: any): any => caso.investigadorAsignado ||
  (caso.origenCaso === 'HISTORICO' && caso.investigadorOriginal?.usuarioId) || caso.registradoPor;

// La asignación de un seguimiento es independiente de un permiso de consulta revocable.
export const accesoPersonal = (caso: any, usuario: UsuarioSesion): boolean =>
  usuario?.role === UserRole.INVESTIGADOR && !!referenciaId(usuario.userId) &&
  (referenciaId(responsableExpediente(caso)) === referenciaId(usuario.userId) ||
    (caso.seguimientos || []).some(s => referenciaId(s.investigadorAsignado) === referenciaId(usuario.userId)));

function validarUsuario(usuario: UsuarioSesion): void {
  if (!usuario?.userId || (!accesoInstitucional(usuario) && usuario.role !== UserRole.INVESTIGADOR))
    throw new ForbiddenException('Se requiere una sesión autorizada.');
}

// Consulta permisos vigentes para el lote, admitiendo referencias antiguas guardadas como texto.
async function permisos(modelo: Model<any>, casos: any[], tipo: string, usuario: UsuarioSesion): Promise<Set<string>> {
  const ids = casos.flatMap(c => {
    const valor = referenciaId(c);
    return Types.ObjectId.isValid(valor) ? [valor, new Types.ObjectId(valor)] : [valor];
  });
  const autorizadas = await modelo.db.model('SolicitudAcceso').find({
    tipo, solicitante: usuario.userId, estado: 'AUTORIZADA', casoId: { $in: ids },
  }).lean().exec();
  return new Set(autorizadas.map(s => referenciaId(s.casoId)));
}

// Filtra también los listados antiguos; nunca devuelve datos completos de expedientes ajenos.
export async function filtrarAccesoExpedientes<T>(modelo: Model<any>, casos: T[], tipo: string, usuario: UsuarioSesion): Promise<T[]> {
  validarUsuario(usuario);
  if (accesoInstitucional(usuario) || !casos.length) return casos;
  const ajenos = casos.filter(c => !accesoPersonal(c, usuario));
  const autorizados = ajenos.length ? await permisos(modelo, ajenos, tipo, usuario) : new Set<string>();
  return casos.filter(c => accesoPersonal(c, usuario) || autorizados.has(referenciaId(c)));
}

// Aplica la misma regla de consulta a las rutas directas de cada módulo.
export async function exigirConsultaExpediente(modelo: Model<any>, caso: any, tipo: string, usuario: UsuarioSesion): Promise<void> {
  if (!(await filtrarAccesoExpedientes(modelo, [caso], tipo, usuario)).length)
    throw new ForbiddenException('Se requiere autorización para consultar este expediente.');
}

// Un permiso de consulta no concede escritura ni permite asignarse un seguimiento a sí mismo.
export function exigirSeguimientoExpediente(caso: any, usuario: UsuarioSesion): void {
  validarUsuario(usuario);
  if (usuario.role !== UserRole.ANALISTA && !accesoPersonal(caso, usuario))
    throw new ForbiddenException('No puedes agregar seguimientos a un expediente ajeno.');
  if (caso.expedienteEnPreparacion || (caso.estadoRegistro && caso.estadoRegistro !== 'Aprobado'))
    throw new ConflictException('El expediente debe estar aprobado antes de agregar seguimientos.');
}
