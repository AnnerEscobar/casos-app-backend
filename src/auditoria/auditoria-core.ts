import { AsyncLocalStorage } from 'node:async_hooks';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { ClientSession } from 'mongoose';

export const AUDIT_COLLECTION = 'bitacora_auditoria';
export const MODELOS_AUDITADOS = new Set(['CasosAlerta', 'CasosMaltrato', 'CasosConflicto', 'DocumentacionInicial', 'Caratula', 'Informe', 'SolicitudAcceso', 'Usuario']);
export interface ContextoAuditoria {
  solicitudId: string;
  usuario?: { id: string; nombre: string; rol: string };
  metodo: string;
  ruta: string;
  ip: string;
  agente: string;
  session?: ClientSession;
  eventos: number;
}
export const contextoAuditoria = new AsyncLocalStorage<ContextoAuditoria>();

// No se copia el cuerpo HTTP. Estas propiedades nunca salen a la bitácora.
const reservado = /password|contrase[nñ]a|token|secret|cookie|authorization|_presentacionTextos|^__v$|^updatedAt$/i;
export function datosAuditables(valor: any): any {
  return normalizar(valor, true);
}
function normalizar(valor: any, ocultar: boolean): any {
  if (valor === undefined) return null;
  if (valor === null || typeof valor !== 'object') return valor;
  if (valor instanceof Date) return valor.toISOString();
  if (valor._bsontype) return String(valor);
  if (Buffer.isBuffer(valor)) return '[ARCHIVO BINARIO]';
  if (Array.isArray(valor)) return valor.map(v => normalizar(v, ocultar));
  const resultado: any = Object.create(null);
  for (const key of Object.keys(valor).sort()) {
    if (!ocultar || !reservado.test(key)) resultado[key] = normalizar(valor[key], ocultar);
  }
  return resultado;
}

export function cambiosEntre(anterior: any, nuevo: any, ruta = ''): { campo: string; anterior: any; nuevo: any }[] {
  if (JSON.stringify(anterior) === JSON.stringify(nuevo)) return [];
  if (anterior && nuevo && typeof anterior === 'object' && typeof nuevo === 'object' &&
      Array.isArray(anterior) === Array.isArray(nuevo)) {
    return [...new Set([...Object.keys(anterior), ...Object.keys(nuevo)])].sort().flatMap(key =>
      cambiosEntre(anterior[key] ?? null, nuevo[key] ?? null, ruta ? `${ruta}.${key}` : key));
  }
  // Un objeto incorporado se desglosa para poder buscar también el estado de un seguimiento nuevo.
  if ((anterior == null || nuevo == null) && (typeof anterior === 'object' || typeof nuevo === 'object')) {
    const objeto = anterior ?? nuevo;
    if (objeto && typeof objeto === 'object') return Object.keys(objeto).sort().flatMap(key =>
      cambiosEntre(anterior?.[key] ?? null, nuevo?.[key] ?? null, ruta ? `${ruta}.${key}` : key));
  }
  return [{ campo: ruta, anterior: anterior ?? null, nuevo: nuevo ?? null }];
}

export function firmaEvento(evento: any, clave: string): string {
  const { _id, firma, ...contenido } = evento;
  return createHmac('sha256', clave).update(JSON.stringify(normalizar(contenido, false))).digest('hex');
}
export function verificarFirma(evento: any, clave: string): boolean {
  if (!/^[a-f0-9]{64}$/.test(evento.firma || '')) return false;
  return timingSafeEqual(Buffer.from(evento.firma, 'hex'), Buffer.from(firmaEvento(evento, clave), 'hex'));
}

export function nuevoEvento(contexto: ContextoAuditoria, contenido: Record<string, any>, clave: string) {
  const evento: any = {
    eventoId: randomUUID(), version: 1, fecha: new Date(), solicitudId: contexto.solicitudId,
    usuario: contexto.usuario || { id: '', nombre: 'No autenticado', rol: '' },
    metodo: contexto.metodo, ruta: contexto.ruta, ip: contexto.ip, agente: contexto.agente,
    ...contenido,
  };
  evento.firma = firmaEvento(evento, clave);
  return evento;
}
