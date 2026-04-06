import { Body, Controller, Post, Delete, UseGuards, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('register')
  async register(@Body() signupData: any) {
    return this.authService.register(signupData.name, signupData.email, signupData.password);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@Body() loginData: any) {
    return this.authService.login(loginData.email, loginData.password);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: any) {
    return this.authService.logout(req.user.userId);
  }

  @Delete('account')
  @HttpCode(HttpStatus.OK)
  async deleteAccount(@Req() req: any) {
    return this.authService.deleteAccount(req.user.userId, req.user.email);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refresh(@Body() refreshData: any) {
    return this.authService.refreshTokens(refreshData.userId, refreshData.refreshToken);
  }
}
