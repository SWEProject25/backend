import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import { getFirebaseConfig } from './firebase.config';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private firebaseApp: admin.app.App;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const firebaseConfig = getFirebaseConfig(this.configService);

    if (!firebaseConfig.projectId || !firebaseConfig.privateKey || !firebaseConfig.clientEmail) {
      this.logger.error('Firebase configuration is incomplete. Please check environment variables.');
      throw new Error('Firebase configuration is incomplete');
    }

    try {
      this.firebaseApp = admin.initializeApp({
        credential: admin.credential.cert({
          projectId: firebaseConfig.projectId,
          privateKey: firebaseConfig.privateKey,
          clientEmail: firebaseConfig.clientEmail,
        }),
        databaseURL: this.configService.get<string>('FIREBASE_DATABASE_URL'),
      });

      this.logger.log('Firebase Admin SDK initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Firebase Admin SDK', error);
      throw error;
    }
  }

  getFirestore(): admin.firestore.Firestore {
    return admin.firestore(this.firebaseApp);
  }

  getMessaging(): admin.messaging.Messaging {
    return admin.messaging(this.firebaseApp);
  }

  getAuth(): admin.auth.Auth {
    return admin.auth(this.firebaseApp);
  }
}
