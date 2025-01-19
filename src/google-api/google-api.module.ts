import { Module } from '@nestjs/common';
import { GoogleApiService } from './google-api.service';
import { GoogleApiController } from './google-api.controller';
import { GoogleDriveConfig, GoogleDriveModule } from 'nestjs-googledrive-upload';
import * as googleConfig from '../config/google-credentials.json';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

@Module({
  controllers: [GoogleApiController],
  providers: [GoogleApiService],
  imports:[
    GoogleDriveModule.register(googleConfig as GoogleDriveConfig, '16uyaU1wkYlYrpBnAZpszhqCf1ndv3kHF'),
    MulterModule.register({
      storage: memoryStorage(), // Configuración para almacenar archivos en la memoria
    }),
  ],
})
export class GoogleApiModule {}
