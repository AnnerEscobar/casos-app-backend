import { Module } from '@nestjs/common';
import { GoogleApiService } from './google-api.service';
import { GoogleApiController } from './google-api.controller';
import { GoogleDriveConfig, GoogleDriveModule } from 'nestjs-googledrive-upload';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

const googleCredentialsRaw = process.env.GOOGLE_CREDENTIALS_JSON;

if (!googleCredentialsRaw) {
  throw new Error('GOOGLE_CREDENTIALS_JSON is not set.');
}

const googleConfig = JSON.parse(googleCredentialsRaw);

@Module({
  controllers: [GoogleApiController],
  providers: [GoogleApiService],
  imports:[
    GoogleDriveModule.register(googleConfig as GoogleDriveConfig, '16uyaU1wkYlYrpBnAZpszhqCf1ndv3kHF'),
    MulterModule.register({
      storage: memoryStorage(), // Configuración para almacenar archivos en la memoria
    }),
  ],
  exports:[
    GoogleApiService
  ]
})
export class GoogleApiModule {}
