import { ConflictException } from '@nestjs/common';
import { Document } from 'mongoose';

interface EstadoSeguimiento { estado?: string; nuevoEstado?: string }
type TipoCaso = 'alerta' | 'maltrato' | 'conflicto';
export function esEstadoTerminal(tipo: TipoCaso, estado?: string): boolean {
  return tipo === 'alerta' ? estado === 'Remitido' || estado === 'Concluido' : estado === 'Desestimado';
}

// Los tres services agregan con push: el orden persistido del arreglo es el
// orden de registro, incluso con fechas iguales o datos antiguos sin fecha.
export function validarSeguimientoAbierto(tipo: TipoCaso, caso: { seguimientos?: EstadoSeguimiento[] | null }): void {
  const ultimo = caso.seguimientos?.[caso.seguimientos.length - 1];
  if (esEstadoTerminal(tipo, tipo === 'alerta' ? ultimo?.nuevoEstado : ultimo?.estado)) {
    const message = tipo === 'alerta'
      ? `La alerta se encuentra ${ultimo?.nuevoEstado === 'Remitido' ? 'remitida' : 'concluida'} y no admite nuevos seguimientos.`
      : 'El caso se encuentra desestimado y no admite nuevos seguimientos.';
    throw new ConflictException({ message, code: 'SEGUIMIENTO_TERMINAL' });
  }
}

export async function guardarSeguimiento(caso: Document, cantidadAnterior: number): Promise<void> {
  // La condición se evalúa en la misma escritura: otra petición no puede
  // agregar una actuación usando el historial anterior a un cierre concurrente.
  caso.$where = { $expr: { $eq: [{ $size: { $ifNull: ['$seguimientos', []] } }, cantidadAnterior] } };
  try {
    await caso.save();
  } catch (error) {
    if (error?.name === 'DocumentNotFoundError' || error?.name === 'VersionError') {
      throw new ConflictException({ message: 'El historial cambió mientras se guardaba. Consulte el expediente antes de continuar.', code: 'HISTORIAL_ACTUALIZADO' });
    }
    throw error;
  }
}

export async function poblarUsuariosSeguimientos(caso: Document): Promise<void> {
  await caso.populate([
    { path: 'seguimientos.investigadorAsignado', model: 'Usuario', select: 'nombre', strictPopulate: false },
    { path: 'seguimientos.registradoPor', model: 'Usuario', select: 'nombre', strictPopulate: false },
  ]);
}
