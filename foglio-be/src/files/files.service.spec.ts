import { Test, TestingModule } from '@nestjs/testing';
import { FilesService } from './files.service';
import { ConfigService } from '@nestjs/config';
import { EventEmitter } from 'events';

describe('FilesService', () => {
  let service: FilesService;
  let putObjectMock: jest.Mock;
  let removeObjectsMock: jest.Mock;
  let removeObjectMock: jest.Mock;
  let listObjectsV2Mock: jest.Mock;

  beforeEach(async () => {
    putObjectMock = jest.fn().mockResolvedValue('ok');
    removeObjectsMock = jest.fn().mockResolvedValue([]);
    removeObjectMock = jest.fn().mockResolvedValue(undefined);
    listObjectsV2Mock = jest.fn();

    const configServiceMock = {
      get: jest.fn((key: string, defaultValue?: any) => {
        if (key === 'MINIO_BUCKET_NAME') return 'test-bucket';
        return defaultValue;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FilesService,
        { provide: ConfigService, useValue: configServiceMock },
      ],
    }).compile();

    service = module.get<FilesService>(FilesService);
    // Replace internal minioClient putObject
    (service as any).minioClient = {
      putObject: putObjectMock,
      removeObjects: removeObjectsMock,
      removeObject: removeObjectMock,
      listObjectsV2: listObjectsV2Mock,
      bucketExists: jest.fn().mockResolvedValue(true),
    };
  });

  it('should create root folder and audio, documents, images subfolders for a user', async () => {
    await service.createUserFolders('user-456');

    expect(putObjectMock).toHaveBeenCalledTimes(4);
    expect(putObjectMock).toHaveBeenCalledWith('test-bucket', 'user-456/', expect.any(Buffer), 0);
    expect(putObjectMock).toHaveBeenCalledWith('test-bucket', 'user-456/audio/', expect.any(Buffer), 0);
    expect(putObjectMock).toHaveBeenCalledWith('test-bucket', 'user-456/documents/', expect.any(Buffer), 0);
    expect(putObjectMock).toHaveBeenCalledWith('test-bucket', 'user-456/images/', expect.any(Buffer), 0);
  });

  it('should delete user objects and folder in MinIO', async () => {
    const mockStream = new EventEmitter();
    listObjectsV2Mock.mockReturnValue(mockStream);

    const deletePromise = service.deleteUserFolder('user-456');

    setTimeout(() => {
      mockStream.emit('data', { name: 'user-456/images/photo.png' });
      mockStream.emit('data', { name: 'user-456/documents/doc.pdf' });
      mockStream.emit('end');
    }, 10);

    await deletePromise;

    expect(listObjectsV2Mock).toHaveBeenCalledWith('test-bucket', 'user-456/', true);
    expect(removeObjectsMock).toHaveBeenCalledWith('test-bucket', [
      'user-456/images/photo.png',
      'user-456/documents/doc.pdf',
    ]);
  });

  it('should upload file into the user subfolder when userId is provided', async () => {
    const mockFile: any = {
      originalname: 'test image.png',
      mimetype: 'image/png',
      size: 1024,
      buffer: Buffer.from('fake data'),
    };

    const result = await service.uploadFile(mockFile, 'images', 'user-456');

    expect(putObjectMock).toHaveBeenCalledWith(
      'test-bucket',
      expect.stringMatching(/^user-456\/images\/\d+-[a-f0-9]+-test_image\.png$/),
      mockFile.buffer,
      mockFile.size,
      { 'Content-Type': 'image/png' },
    );
    expect(result.url).toMatch(/^\/api\/files\/user-456\/images\//);
    expect(result.filename).toMatch(/^user-456\/images\//);
  });
});

