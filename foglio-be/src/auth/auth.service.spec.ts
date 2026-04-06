import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { FilesService } from '../files/files.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: Partial<UsersService>;
  let filesService: Partial<FilesService>;
  let jwtService: Partial<JwtService>;
  let configService: Partial<ConfigService>;

  beforeEach(async () => {
    filesService = {
      createUserFolders: jest.fn().mockResolvedValue(undefined),
      deleteUserFolder: jest.fn().mockResolvedValue(undefined),
    };
    usersService = {
      findOneByEmail: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({
        _id: 'user123',
        name: 'Test User',
        email: 'test@example.com',
      } as any),
      updateRefreshToken: jest.fn().mockResolvedValue(undefined),
      deleteUserData: jest.fn().mockResolvedValue(undefined),
    };

    jwtService = {
      signAsync: jest.fn().mockResolvedValue('test-token'),
    };

    configService = {
      get: jest.fn().mockReturnValue('mock-secret'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: FilesService, useValue: filesService },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should create user folders in MinIO on register', async () => {
    const result = await service.register('Test User', 'test@example.com', 'password123');

    expect(usersService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Test User',
        email: 'test@example.com',
      }),
    );
    expect(filesService.createUserFolders).toHaveBeenCalledWith('user123');
    expect(result.userId).toBe('user123');
  });

  it('should delete user folder in MinIO and user data in MongoDB on deleteAccount', async () => {
    const result = await service.deleteAccount('user123', 'test@example.com');

    expect(filesService.deleteUserFolder).toHaveBeenCalledWith('user123');
    expect(usersService.deleteUserData).toHaveBeenCalledWith('user123', 'test@example.com');
    expect(result.success).toBe(true);
  });
});

