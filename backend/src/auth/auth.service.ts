import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import * as nodemailer from 'nodemailer';
import * as path from 'path';
import { UsersService } from '../users/users.service';
import { CreateUserDto } from '../users/dto/create-user.dto';

const LOGO_PATH = path.join(process.cwd(), '..', 'src', 'assets', 'logo', 'logo_dany1st.png');

@Injectable()
export class AuthService {
  private transporter: nodemailer.Transporter;

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async validateUser(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user || !user.password) return null;

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return null;

    const { password: _, ...result } = user.toObject();
    return result;
  }

  async login(user: any) {
    const payload = {
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
    };
    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        loyaltyPoints: user.loyaltyPoints,
        loyaltyTier: user.loyaltyTier,
        visitCount: user.visitCount,
        referralCode: user.referralCode,
      },
    };
  }

  async forgotPassword(email: string) {
    const user = await this.usersService.findByEmail(email);
    // Réponse générique même si l'email n'existe pas (sécurité)
    if (!user) return;

    const token = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 heure
    await this.usersService.setResetToken(user._id.toString(), token, expiry);

    const resetUrl = `${process.env.FRONTEND_URL ?? 'http://localhost:4200'}/reset-password?token=${token}`;

    await this.transporter.sendMail({
      from: `"Dany1st Barber" <${process.env.SMTP_USER}>`,
      to: user.email,
      subject: 'Réinitialisation de votre mot de passe — Dany1st Barber',
      html: `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:560px;margin:32px auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">
    <div style="background:#1a1a1a;padding:24px 32px;text-align:center">
      <img src="cid:logo" alt="Dany1st Barber" width="120" style="display:block;margin:0 auto 10px;width:120px;height:auto" />
      <div style="font-size:11px;letter-spacing:2px;color:#888;text-transform:uppercase">Barber Shop · Tournan-en-Brie</div>
    </div>
    <div style="height:3px;background:linear-gradient(90deg,#C9A44A,#e8c96e,#C9A44A)"></div>
    <div style="padding:32px">
      <p style="margin:0 0 8px;font-size:16px;color:#1a1a1a">Bonjour <strong>${user.firstName}</strong>,</p>
      <p style="margin:0 0 24px;font-size:14px;color:#555;line-height:1.6">
        Vous avez demandé la réinitialisation de votre mot de passe. Cliquez sur le bouton ci-dessous pour en choisir un nouveau.
      </p>
      <div style="text-align:center;margin:28px 0">
        <a href="${resetUrl}" style="display:inline-block;background:#C9A44A;color:#000;font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;text-decoration:none;padding:14px 32px;border-radius:4px">
          Réinitialiser mon mot de passe
        </a>
      </div>
      <p style="margin:0 0 8px;font-size:12px;color:#888;line-height:1.6">
        Ce lien est valable <strong>1 heure</strong>. Si vous n'avez pas fait cette demande, ignorez simplement cet email.
      </p>
    </div>
    <div style="background:#f9f9f9;padding:16px 32px;text-align:center;border-top:1px solid #eee">
      <p style="margin:0;font-size:11px;color:#aaa">© ${new Date().getFullYear()} Dany1st Barber — Tournan-en-Brie</p>
    </div>
  </div>
</body>
</html>`,
      attachments: [{ filename: 'logo.png', path: LOGO_PATH, cid: 'logo' }],
    });
  }

  async resetPassword(token: string, newPassword: string) {
    const user = await this.usersService.findByResetToken(token);
    if (!user || !user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
      throw new BadRequestException('Lien invalide ou expiré.');
    }
    const hashed = await bcrypt.hash(newPassword, 10);
    await this.usersService.updatePassword(user._id.toString(), hashed);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.usersService.findByEmail(
      (await this.usersService.findById(userId)).email,
    );
    if (!user) throw new UnauthorizedException();
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) throw new UnauthorizedException('Mot de passe actuel incorrect.');
    const hashed = await bcrypt.hash(newPassword, 12);
    await this.usersService.updatePassword(userId, hashed);
  }

  async googleLogin(user: any) {
    const payload = {
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
    };
    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        loyaltyPoints: user.loyaltyPoints,
        loyaltyTier: user.loyaltyTier,
        visitCount: user.visitCount,
        referralCode: user.referralCode,
      },
    };
  }

  async register(dto: CreateUserDto) {
    const user = await this.usersService.create(dto);
    const userObj = user.toObject();
    const { password: _, ...userWithoutPassword } = userObj;

    const payload = {
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
    };
    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        loyaltyPoints: user.loyaltyPoints,
        loyaltyTier: user.loyaltyTier,
        visitCount: user.visitCount,
        referralCode: user.referralCode,
      },
    };
  }
}
