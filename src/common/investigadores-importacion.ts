import { BadRequestException, ConflictException } from '@nestjs/common';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { UserRole } from '../auth/enums/user-role.enum';

export const claveNombre = (v:string) => v.normalize('NFD').replace(/[\u0300-\u036f\u200b-\u200f\ufeff]/g,'').trim().replace(/\s+/g,' ').toUpperCase();
export interface CuentaImportacion {
  nombre:string; usuario:string; usuarioId?:string;
  estado:'nuevo'|'existente'|'creado'|'error'; error?:string;
}
export function usuarioSugerido(nombre:string) {
  const partes=claveNombre(nombre).toLowerCase().split(' ').map(x=>x.replace(/[^a-z]/g,'')).filter(Boolean);
  // Dos apellidos son frecuentes en la base. El analista revisa la propuesta en pantalla.
  const apellido=partes.length>=3?partes[partes.length-2]:partes[1];
  return apellido?`${partes[0]}.${apellido}`:'';
}
export async function planificarInvestigadores(usuarios:Model<any>,nombres:string[],ajustesTexto?:string):Promise<CuentaImportacion[]> {
  let ajustes:Record<string,string>={};
  if(ajustesTexto) {
    try {ajustes=JSON.parse(ajustesTexto);}catch {throw new BadRequestException('Las cuentas propuestas contienen JSON inválido.');}
    if(!ajustes || Array.isArray(ajustes) || typeof ajustes!=='object' || Object.keys(ajustes).length>500)throw new BadRequestException('Las cuentas propuestas son inválidas.');
    for(const [nombre,usuario] of Object.entries(ajustes))if(!nombres.some(n=>claveNombre(n)===nombre) || typeof usuario!=='string')throw new BadRequestException('Cuenta propuesta no reconocida.');
  }
  const existentes=await usuarios.find({}).select('_id nombre email role activo').lean().exec();
  const reservados=new Set<string>(existentes.map(u=>String(u.email||'').toLowerCase()));
  const unicos=[...new Map(nombres.map(n=>[claveNombre(n),n])).values()];
  if(unicos.length>500)throw new BadRequestException('Divide la carga en lotes de hasta 500 investigadores diferentes.');
  const plan:CuentaImportacion[]=[];
  for(const nombre of unicos) {
    const clave=claveNombre(nombre),coincidencias=existentes.filter(u=>claveNombre(u.nombre||'')===clave);
    if(coincidencias.length===1) {
      const u=coincidencias[0];
      plan.push({nombre,usuario:u.email,usuarioId:String(u._id),estado:u.activo!==false && u.role===UserRole.INVESTIGADOR?'existente':'error',...(u.activo===false || u.role!==UserRole.INVESTIGADOR?{error:'La cuenta coincidente está inactiva o no tiene rol Investigador. Revisa el usuario existente.'}:{})});
      continue;
    }
    if(coincidencias.length>1){plan.push({nombre,usuario:'',estado:'error',error:'Hay varias cuentas con el mismo nombre. Resuelve la coincidencia antes de importar.'});continue;}
    let usuario=ajustes[clave]?.trim().toLowerCase()||usuarioSugerido(nombre);
    if(!ajustes[clave]){const base=usuario;let n=2;while(reservados.has(usuario))usuario=base+n++;}
    const error=/^(NO INDICA|NO DETERMINADO|POR ESTABLECER|SIN INDICAR|S\/N|NINGUNO|DESCONOCIDO)$/.test(clave) || !/^[a-z]{2,40}\.[a-z]{2,40}\d{0,5}$/.test(usuario)
      ?'Revisa el nombre y el usuario; usa nombre.apellido, sin tildes ni espacios.'
      :reservados.has(usuario)?'Ese usuario ya está reservado para otra persona. Corrige la propuesta.':undefined;
    plan.push({nombre,usuario,estado:error?'error':'nuevo',...(error?{error}:{})});
    if(!error)reservados.add(usuario);
  }
  return plan;
}
export async function asegurarInvestigador(usuarios:Model<any>,cuenta:CuentaImportacion) {
  if(cuenta.estado==='error')throw new BadRequestException(cuenta.error);
  if(cuenta.usuarioId) {
    const u=await usuarios.findOne({_id:cuenta.usuarioId,role:UserRole.INVESTIGADOR,activo:{$ne:false}}).select('_id nombre').lean<any>().exec();
    if(!u || claveNombre(u.nombre)!==claveNombre(cuenta.nombre))throw new ConflictException('El investigador cambió desde la revisión. Vuelve a revisar el archivo.');
    return String(u._id);
  }
  // Solo se crean cuentas al confirmar casos válidos, jamás al previsualizar.
  const password=await bcrypt.hash(cuenta.usuario.split('.')[0]+'2026',10);
  try {
    const u=await usuarios.create({nombre:cuenta.nombre,email:cuenta.usuario,password,role:UserRole.INVESTIGADOR,activo:true,debeCambiarPassword:true});
    cuenta.usuarioId=String(u._id);cuenta.estado='creado';return cuenta.usuarioId;
  } catch(e) {
    if(e.code!==11000)throw e;
    const u=await usuarios.findOne({email:cuenta.usuario}).select('_id nombre role activo').lean<any>().exec();
    if(!u || claveNombre(u.nombre)!==claveNombre(cuenta.nombre) || u.role!==UserRole.INVESTIGADOR || u.activo===false)throw new ConflictException('El nombre de usuario fue ocupado por otra cuenta. Vuelve a revisar.');
    cuenta.usuarioId=String(u._id);cuenta.estado='existente';return cuenta.usuarioId;
  }
}
