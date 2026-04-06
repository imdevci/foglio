import { Injectable, OnModuleInit, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import * as crypto from 'crypto';
import { Readable } from 'stream';

export type FileCategory = 'images' | 'documents' | 'audio';

@Injectable()
export class FilesService implements OnModuleInit {
  private readonly logger = new Logger(FilesService.name);
  private minioClient: Minio.Client;
  private bucketName: string;

  constructor(private readonly configService: ConfigService) {
    const endPoint = this.configService.get<string>('MINIO_ENDPOINT', 'minio');
    const port = parseInt(this.configService.get<string>('MINIO_PORT', '9000'), 10);
    const useSSL = this.configService.get<string>('MINIO_USE_SSL', 'false') === 'true';
    const accessKey = this.configService.get<string>('MINIO_ACCESS_KEY', 'minioadmin');
    const secretKey = this.configService.get<string>('MINIO_SECRET_KEY', 'minioadmin');
    this.bucketName = this.configService.get<string>('MINIO_BUCKET_NAME', 'foglio-files');

    this.minioClient = new Minio.Client({
      endPoint,
      port,
      useSSL,
      accessKey,
      secretKey,
    });
  }

  async onModuleInit() {
    const initialized = await this.ensureBucketExistsWithRetry();
    if (initialized) {
      await this.ensureFoldersExist();
    }
  }

  private async ensureBucketExistsWithRetry(retries = 5, delay = 2000): Promise<boolean> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const exists = await this.minioClient.bucketExists(this.bucketName);
        if (!exists) {
          await this.minioClient.makeBucket(this.bucketName, 'us-east-1');
          this.logger.log(`Created bucket: ${this.bucketName}`);
        } else {
          this.logger.log(`Bucket already exists: ${this.bucketName}`);
        }
        return true;
      } catch (error) {
        this.logger.warn(`MinIO connection attempt ${attempt}/${retries} failed: ${error.message}`);
        if (attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, delay));
        } else {
          this.logger.error(`Could not connect to MinIO after ${retries} attempts: ${error.message}`);
        }
      }
    }
    return false;
  }

  private async ensureFoldersExist() {
    const folders: FileCategory[] = ['images', 'documents', 'audio'];
    for (const folder of folders) {
      try {
        await this.minioClient.putObject(
          this.bucketName,
          `${folder}/`,
          Buffer.alloc(0),
          0,
        );
        this.logger.log(`Verified MinIO folder: ${folder}/`);
      } catch (error) {
        this.logger.warn(`Could not verify MinIO folder ${folder}/: ${error.message}`);
      }
    }
  }

  async createUserFolders(userId: string): Promise<void> {
    const subfolders: FileCategory[] = ['audio', 'documents', 'images'];
    const foldersToCreate = [
      `${userId}/`,
      ...subfolders.map((folder) => `${userId}/${folder}/`),
    ];

    for (const folderKey of foldersToCreate) {
      await this.minioClient.putObject(
        this.bucketName,
        folderKey,
        Buffer.alloc(0),
        0,
      );
      this.logger.log(`Created user folder in MinIO: ${folderKey}`);
    }
  }

  async deleteUserFolder(userId: string): Promise<void> {
    const prefix = `${userId}/`;
    return new Promise((resolve, reject) => {
      const objectsList: string[] = [];
      const stream = this.minioClient.listObjectsV2(this.bucketName, prefix, true);

      stream.on('data', (item) => {
        if (item.name) {
          objectsList.push(item.name);
        }
      });

      stream.on('error', (err) => {
        this.logger.error(`Error listing objects for user ${userId}: ${err.message}`);
        reject(err);
      });

      stream.on('end', async () => {
        try {
          if (objectsList.length > 0) {
            await this.minioClient.removeObjects(this.bucketName, objectsList);
            this.logger.log(`Deleted ${objectsList.length} objects for user ${userId} in MinIO`);
          }
          try {
            await this.minioClient.removeObject(this.bucketName, prefix);
          } catch {
            // Ignore if already removed
          }
          resolve();
        } catch (removeErr) {
          this.logger.error(`Error deleting objects for user ${userId}: ${removeErr.message}`);
          reject(removeErr);
        }
      });
    });
  }

  determineFolder(file: Express.Multer.File): FileCategory {
    const mime = file.mimetype?.toLowerCase() || '';
    const name = file.originalname?.toLowerCase() || '';

    if (
      mime.startsWith('image/') ||
      /\.(jpe?g|png|gif|webp|svg|bmp|ico|tiff|avif|heic|heif)$/i.test(name)
    ) {
      return 'images';
    }

    if (
      mime === 'application/pdf' ||
      name.endsWith('.pdf')
    ) {
      return 'documents';
    }

    if (
      mime.startsWith('audio/') ||
      /\.(webm|mp3|wav|ogg|m4a|aac|flac|oga|opus)$/i.test(name)
    ) {
      return 'audio';
    }

    return 'documents';
  }

  resolveFolder(file: Express.Multer.File, requestedFolder?: string): FileCategory {
    const validFolders: FileCategory[] = ['images', 'documents', 'audio'];
    if (requestedFolder && validFolders.includes(requestedFolder.toLowerCase() as FileCategory)) {
      return requestedFolder.toLowerCase() as FileCategory;
    }
    return this.determineFolder(file);
  }

  async uploadFile(file: Express.Multer.File, requestedFolder?: string, userId?: string) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const folder = this.resolveFolder(file, requestedFolder);
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const randomHash = crypto.randomBytes(6).toString('hex');
    const fileName = `${Date.now()}-${randomHash}-${sanitizedName}`;
    const objectKey = userId ? `${userId}/${folder}/${fileName}` : `${folder}/${fileName}`;

    await this.minioClient.putObject(
      this.bucketName,
      objectKey,
      file.buffer,
      file.size,
      {
        'Content-Type': file.mimetype,
      },
    );

    return {
      url: `/api/files/${objectKey}`,
      filename: objectKey,
      originalName: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
      folder,
      userId,
    };
  }

  async getFileStream(objectKey: string): Promise<{ stream: Readable; stat: Minio.ItemBucketMetadata }> {
    const decodedKey = decodeURIComponent(objectKey);
    try {
      const stat = await this.minioClient.statObject(this.bucketName, decodedKey);
      const stream = await this.minioClient.getObject(this.bucketName, decodedKey);
      return { stream, stat };
    } catch (error) {
      if (!decodedKey.includes('/')) {
        for (const folder of ['images', 'documents', 'audio']) {
          try {
            const candidateKey = `${folder}/${decodedKey}`;
            const stat = await this.minioClient.statObject(this.bucketName, candidateKey);
            const stream = await this.minioClient.getObject(this.bucketName, candidateKey);
            return { stream, stat };
          } catch {
            // continue checking
          }
        }
      }
      throw new NotFoundException(`File not found: ${decodedKey}`);
    }
  }

  async deleteFile(objectKey: string) {
    const decodedKey = decodeURIComponent(objectKey);
    try {
      await this.minioClient.removeObject(this.bucketName, decodedKey);
    } catch (error) {
      this.logger.warn(`Failed to delete file ${decodedKey}: ${error.message}`);
    }

    if (!decodedKey.includes('/')) {
      for (const folder of ['images', 'documents', 'audio']) {
        try {
          await this.minioClient.removeObject(this.bucketName, `${folder}/${decodedKey}`);
        } catch {
          // ignore
        }
      }
    }
  }
}
