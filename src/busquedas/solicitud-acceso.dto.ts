import { Transform } from 'class-transformer';
import { IsIn, IsMongoId, IsString, Length } from 'class-validator';
export class CrearSolicitudAccesoDto {
    @IsIn(['alerta', 'maltrato', 'conflicto'])
    tipo: string;
    @IsMongoId()
    casoId: string;
    @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
    @IsString()
    @Length(10, 1000)
    motivo: string;
}
export class ResolverSolicitudAccesoDto {
    @IsIn(['AUTORIZADA', 'RECHAZADA'])
    estado: 'AUTORIZADA' | 'RECHAZADA';
}
