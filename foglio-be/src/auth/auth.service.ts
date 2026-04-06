import { Injectable, UnauthorizedException, ConflictException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { FilesService } from '../files/files.service';
import { UserDocument } from '../users/user.schema';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private filesService: FilesService,
  ) {}

  async register(name: string, email: string, password: string) {
    const existingUser = await this.usersService.findOneByEmail(email);
    if (existingUser) {
      throw new ConflictException('Email already in use');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await this.usersService.create({
      name,
      email,
      password: hashedPassword,
    });

    try {
      await this.filesService.createUserFolders(user._id.toString());
    } catch (error) {
      this.logger.error(
        `Failed to create MinIO folders for user ${user._id}: ${error.message}`,
        error.stack,
      );
    }

    const tokens = await this.getTokens(user._id.toString(), user.email);
    await this.updateRefreshToken(user._id.toString(), tokens.refreshToken);
    return {
      ...tokens,
      userId: user._id.toString(),
      name: user.name,
      email: user.email,
    };
  }

  async login(email: string, pass: string) {
    const user = await this.usersService.findOneByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(pass, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.getTokens(user._id.toString(), user.email);
    await this.updateRefreshToken(user._id.toString(), tokens.refreshToken);
    return {
      ...tokens,
      userId: user._id.toString(),
      name: user.name,
      email: user.email,
    };
  }

  async logout(userId: string) {
    return this.usersService.updateRefreshToken(userId, null);
  }

  async deleteAccount(userId: string, email: string) {
    try {
      await this.filesService.deleteUserFolder(userId);
    } catch (error) {
      this.logger.error(`Failed to delete MinIO folders for user ${userId}: ${error.message}`);
    }

    await this.usersService.deleteUserData(userId, email);

    return {
      success: true,
      message: 'Account and all associated data deleted successfully',
    };
  }

  async refreshTokens(userId: string, refreshToken: string) {
    const user = await this.usersService.findOneById(userId);
    if (!user || !user.refreshToken) {
      throw new UnauthorizedException('Access Denied');
    }

    const refreshTokenMatches = await bcrypt.compare(refreshToken, user.refreshToken);
    if (!refreshTokenMatches) {
      throw new UnauthorizedException('Access Denied');
    }

    const tokens = await this.getTokens(user._id.toString(), user.email);
    await this.updateRefreshToken(user._id.toString(), tokens.refreshToken);
    return {
      ...tokens,
      userId: user._id.toString(),
      name: user.name,
      email: user.email,
    };
  }

  async updateRefreshToken(userId: string, refreshToken: string | null) {
    const hashedRefreshToken = refreshToken ? await bcrypt.hash(refreshToken, 10) : null;
    await this.usersService.updateRefreshToken(userId, hashedRefreshToken);
  }

  async getTokens(userId: string, email: string) {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { sub: userId, email },
        { 
          secret: this.configService.get<string>('JWT_ACCESS_SECRET') || 'at-secret',
          expiresIn: '15m' 
        },
      ),
      this.jwtService.signAsync(
        { sub: userId, email },
        { 
          secret: this.configService.get<string>('JWT_REFRESH_SECRET') || 'rt-secret',
          expiresIn: '7d' 
        },
      ),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }
}
