import { ConfigService } from '@nestjs/config';

export const getFirebaseConfig = (configService: ConfigService) => ({
  projectId: configService.get<string>('FIREBASE_PROJECT_ID'),
  privateKey: configService.get<string>('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n'),
  clientEmail: configService.get<string>('FIREBASE_CLIENT_EMAIL'),
});
