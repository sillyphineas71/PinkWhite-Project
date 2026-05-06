import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type NotificationPayload = {
  body: string;
  title: string;
};

@Injectable()
export class NotificationsService {
  constructor(private readonly configService: ConfigService) {}

  get provider() {
    return 'firebase-cloud-messaging' as const;
  }

  get isConfigured() {
    return Boolean(this.configService.get<string>('FIREBASE_PROJECT_ID'));
  }

  sendToDevice(
    deviceToken: string,
    payload: NotificationPayload,
  ): Promise<never> {
    void deviceToken;
    void payload;

    return Promise.reject(
      new Error('Firebase notification adapter is not implemented yet.'),
    );
  }
}
