import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('SMTP_HOST');
    const user = this.configService.get<string>('SMTP_USER');

    if (host && user) {
      this.transporter = nodemailer.createTransport({
        host,
        port: this.configService.get<number>('SMTP_PORT', 587),
        secure: false,
        auth: {
          user,
          pass: this.configService.get<string>('SMTP_PASSWORD'),
        },
      });
    } else {
      // Mock mode: log to console instead of sending email
      this.logger.warn(
        'SMTP not configured. Emails will be logged to console.',
      );
      this.transporter = nodemailer.createTransport({
        jsonTransport: true,
      });
    }
  }

  /**
   * Gửi email xác thực — UC005
   */
  async sendVerificationEmail(email: string, token: string): Promise<void> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    const link = `${frontendUrl}/verify-email?email=${encodeURIComponent(email)}&token=${token}`;

    const info = await this.transporter.sendMail({
      from: this.configService.get<string>('SMTP_FROM'),
      to: email,
      subject: 'Xác thực email - Tinder Clone',
      html: `
        <h2>Xác thực email của bạn</h2>
        <p>Click vào link bên dưới để xác thực email (hết hạn sau 15 phút):</p>
        <a href="${link}">${link}</a>
        <p>Hoặc nhập mã: <strong>${token}</strong></p>
      `,
    });

    this.logger.log(`Verification email sent to: ${email}`);
    if (info.message) {
      // jsonTransport mode — log the email content
      this.logger.debug(`[MOCK EMAIL] ${info.message}`);
    }
  }

  /**
   * Gửi email reset password — UC006
   */
  async sendResetPasswordEmail(email: string, token: string): Promise<void> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    const link = `${frontendUrl}/reset-password?token=${token}`;

    const info = await this.transporter.sendMail({
      from: this.configService.get<string>('SMTP_FROM'),
      to: email,
      subject: 'Đặt lại mật khẩu - Tinder Clone',
      html: `
        <h2>Đặt lại mật khẩu</h2>
        <p>Click vào link bên dưới để đặt lại mật khẩu (hết hạn sau 15 phút):</p>
        <a href="${link}">${link}</a>
      `,
    });

    this.logger.log(`Reset password email sent to: ${email}`);
    if (info.message) {
      this.logger.debug(`[MOCK EMAIL] ${info.message}`);
    }
  }
}
