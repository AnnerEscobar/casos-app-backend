import 'reflect-metadata';
import * as bcrypt from 'bcrypt';
import { planificarInvestigadores, asegurarInvestigador, usuarioSugerido } from './investigadores-importacion';
import { UserRole } from '../auth/enums/user-role.enum';
import { AuthService } from '../auth/auth.service';
import { JwtStrategy } from '../auth/jwt.strategy';

const query=(value:any)=>({select:jest.fn().mockReturnThis(),lean:jest.fn().mockReturnThis(),exec:jest.fn().mockResolvedValue(value)});
const existente={_id:'507f1f77bcf86cd799439011',nombre:'Anner Escobar',email:'anner@institucion.gt',role:UserRole.INVESTIGADOR,activo:true};
describe('Investigadores de carga masiva',()=>{
  it('propone nombre.apellido, elimina tildes y reúne nombres repetidos sin crear usuarios',async()=>{
    const usuarios:any={find:jest.fn(()=>query([])),create:jest.fn()};
    const plan=await planificarInvestigadores(usuarios,['Ánner Escobar','ANNER ESCOBAR']);
    expect(plan).toHaveLength(1);expect(plan[0]).toMatchObject({usuario:'anner.escobar',estado:'nuevo'});expect(usuarios.create).not.toHaveBeenCalled();
    expect(usuarioSugerido('Anner José Escobar Pérez')).toBe('anner.escobar');
  });
  it('reutiliza solo coincidencias completas y activas sin cambiar sus credenciales',async()=>{
    const usuarios:any={find:()=>query([existente]),findOne:()=>query(existente),create:jest.fn()};
    const [plan]=await planificarInvestigadores(usuarios,['ANNER ESCOBAR']);
    expect(plan.estado).toBe('existente');expect(await asegurarInvestigador(usuarios,plan)).toBe(existente._id);expect(usuarios.create).not.toHaveBeenCalled();
  });
  it('no reactiva usuarios, no convierte otros roles ni elige entre homónimos',async()=>{
    for(const datos of [[{...existente,activo:false}],[{...existente,role:UserRole.ADMIN}],[existente,{...existente,_id:'otro'}]]) {
      const [plan]=await planificarInvestigadores({find:()=>query(datos)} as any,['Anner Escobar']);expect(plan.estado).toBe('error');
    }
  });
  it('resuelve colisiones con consecutivos y permite corregir la propuesta',async()=>{
    const usuarios:any={find:()=>query([{...existente,nombre:'Otra persona',email:'anner.escobar'}])};
    expect((await planificarInvestigadores(usuarios,['Anner Escobar']))[0].usuario).toBe('anner.escobar2');
    expect((await planificarInvestigadores(usuarios,['Anner Escobar'],JSON.stringify({'ANNER ESCOBAR':'anner.perez'})))[0].usuario).toBe('anner.perez');
    expect((await planificarInvestigadores(usuarios,['Anner Escobar'],JSON.stringify({'ANNER ESCOBAR':'anner.escobar'})))[0].estado).toBe('error');
    await expect(planificarInvestigadores(usuarios,['Anner Escobar'],'{"OTRA PERSONA":"x.y"}')).rejects.toMatchObject({status:400});
  });
  it('crea una sola cuenta Investigador y guarda únicamente el hash de nombre2026',async()=>{
    let datos:any;
    const usuarios:any={create:jest.fn(async d=>{datos=d;return {_id:existente._id};}),findOne:()=>query(existente)};
    const cuenta:any={nombre:'Anner Escobar',usuario:'anner.escobar',estado:'nuevo'};
    await asegurarInvestigador(usuarios,cuenta);await asegurarInvestigador(usuarios,cuenta);
    expect(usuarios.create).toHaveBeenCalledTimes(1);expect(datos).toMatchObject({email:'anner.escobar',role:UserRole.INVESTIGADOR,debeCambiarPassword:true,activo:true});
    expect(datos.password).not.toBe('anner2026');expect(await bcrypt.compare('anner2026',datos.password)).toBe(true);expect(cuenta.estado).toBe('creado');
  });
  it('no vincula una cuenta ocupada concurrentemente por otra persona',async()=>{
    const usuarios:any={create:jest.fn().mockRejectedValue({code:11000}),findOne:()=>query({...existente,nombre:'Otra persona'})};
    await expect(asegurarInvestigador(usuarios,{nombre:'Anner Escobar',usuario:'anner.escobar',estado:'nuevo'})).rejects.toMatchObject({status:409});
  });
});
describe('Contraseña temporal',()=>{
  it('acepta nombre.apellido y desactiva la obligación solo con una contraseña distinta',async()=>{
    const hash=await bcrypt.hash('anner2026',4),user:any={password:hash,debeCambiarPassword:true,save:jest.fn()};
    const usuarios:any={findOne:jest.fn().mockResolvedValue(user),findById:jest.fn().mockResolvedValue(user)};
    const service=new AuthService(usuarios,{} as any,{} as any);
    expect(await service.validateUser(' Anner.Escobar ','anner2026')).toBe(user);expect(usuarios.findOne).toHaveBeenCalledWith({email:'anner.escobar'});
    await expect(service.changePassword('id',{currentPassword:'anner2026',newPassword:'anner2026'})).rejects.toMatchObject({status:400});expect(user.debeCambiarPassword).toBe(true);
    await expect(service.changePassword('id',{currentPassword:'incorrecta',newPassword:'NuevaClave2026'})).rejects.toMatchObject({status:400});
    await service.changePassword('id',{currentPassword:'anner2026',newPassword:'NuevaClave2026'});expect(user.debeCambiarPassword).toBe(false);expect(await bcrypt.compare('NuevaClave2026',user.password)).toBe(true);
  });
  it('bloquea la API antes del cambio incluso con un JWT válido y permite cambiarla o cerrar sesión',async()=>{
    const user:any={...existente,token:'token-prueba',debeCambiarPassword:true,sesionExpira:new Date(Date.now()+60000)};
    const strategy=new JwtStrategy({findById:jest.fn().mockResolvedValue(user)} as any,{validar:jest.fn()} as any);
    const req=(method:string,url:string)=>({method,url,originalUrl:url,headers:{authorization:'Bearer token-prueba'}} as any);
    await expect(strategy.validate(req('GET','/maltratos'),{sub:'id'})).rejects.toMatchObject({status:403});
    for(const [method,path] of [['GET','/auth/session'],['PATCH','/auth/change-password'],['POST','/auth/logout'],['POST','/auth/actividad']])expect((await strategy.validate(req(method,path),{sub:'id'})).debeCambiarPassword).toBe(true);
    await expect(strategy.validate(req('POST','/auth/change-password'),{sub:'id'})).rejects.toMatchObject({status:403});
    user.debeCambiarPassword=false;expect((await strategy.validate(req('GET','/maltratos'),{sub:'id'})).debeCambiarPassword).toBe(false);
  });
});
