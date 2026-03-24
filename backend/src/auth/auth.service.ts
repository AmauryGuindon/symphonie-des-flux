import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { UsersService } from '../users/users.service';
import { CreateUserDto } from '../users/dto/create-user.dto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) return null;

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

    // Sans service email configuré : le lien est loggé en console
    const resetUrl = `http://localhost:4200/reset-password?token=${token}`;
    console.log(`[RESET PASSWORD] ${user.email} → ${resetUrl}`);
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
