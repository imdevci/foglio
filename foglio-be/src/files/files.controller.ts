import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  Res,
  Req,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { FilesService } from './files.service';
import { UsersService } from '../users/users.service';
import { Public } from '../auth/public.decorator';

@Controller('files')
export class FilesController {
  constructor(
    private readonly filesService: FilesService,
    private readonly usersService: UsersService,
  ) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB
      },
      fileFilter: (req, file, cb) => {
        const allowedMimes = [
          'image/jpeg',
          'image/png',
          'image/gif',
          'image/webp',
          'image/svg+xml',
          'image/heic',
          'image/heif',
          'image/heic-sequence',
          'image/heif-sequence',
          'application/pdf',
          'audio/webm',
          'audio/mp4',
          'audio/ogg',
          'audio/wav',
          'audio/mpeg',
          'audio/mp3',
          'audio/aac',
          'audio/x-m4a',
        ];
        if (
          allowedMimes.includes(file.mimetype) ||
          file.mimetype.startsWith('image/') ||
          file.mimetype.startsWith('audio/') ||
          file.originalname.toLowerCase().endsWith('.pdf') ||
          /\.(jpe?g|png|gif|webp|svg|bmp|ico|tiff|avif|heic|heif)$/i.test(file.originalname) ||
          /\.(webm|mp3|wav|ogg|m4a|aac|flac)$/i.test(file.originalname)
        ) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException('Only images, PDF and audio files are allowed'),
            false,
          );
        }
      },
    }),
  )
  async uploadFile(
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File,
    @Body('folder') folder?: string,
    @Body('userId') bodyUserId?: string,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    let userId = req.user?.userId || req.user?.sub || bodyUserId;
    if (!userId && req.user?.email) {
      const userDoc = await this.usersService.findOneByEmail(req.user.email);
      if (userDoc) {
        userId = userDoc._id.toString();
      }
    }
    return this.filesService.uploadFile(file, folder, userId);
  }

  @Public()
  @Get(':userId/:folder/:filename')
  async getUserFolderFile(
    @Param('userId') userId: string,
    @Param('folder') folder: string,
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    const objectKey = `${userId}/${folder}/${filename}`;
    return this.serveFile(objectKey, filename, res);
  }

  @Public()
  @Get(':folder/:filename')
  async getFolderFile(
    @Param('folder') folder: string,
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    const objectKey = `${folder}/${filename}`;
    return this.serveFile(objectKey, filename, res);
  }

  @Public()
  @Get(':filename')
  async getFile(@Param('filename') filename: string, @Res() res: Response) {
    return this.serveFile(filename, filename, res);
  }

  @Delete(':userId/:folder/:filename')
  async deleteUserFolderFile(
    @Param('userId') userId: string,
    @Param('folder') folder: string,
    @Param('filename') filename: string,
  ) {
    const objectKey = `${userId}/${folder}/${filename}`;
    await this.filesService.deleteFile(objectKey);
    return { success: true, message: `File ${objectKey} deleted` };
  }

  @Delete(':folder/:filename')
  async deleteFolderFile(
    @Param('folder') folder: string,
    @Param('filename') filename: string,
  ) {
    const objectKey = `${folder}/${filename}`;
    await this.filesService.deleteFile(objectKey);
    return { success: true, message: `File ${objectKey} deleted` };
  }

  @Delete(':filename')
  async deleteFile(@Param('filename') filename: string) {
    await this.filesService.deleteFile(filename);
    return { success: true, message: `File ${filename} deleted` };
  }

  private async serveFile(objectKey: string, filename: string, res: Response) {
    const { stream, stat } = await this.filesService.getFileStream(objectKey);

    const lowerName = filename.toLowerCase();
    const contentType =
      stat.metaData?.['content-type'] ||
      (lowerName.endsWith('.pdf')
        ? 'application/pdf'
        : lowerName.endsWith('.webm')
        ? 'audio/webm'
        : lowerName.endsWith('.mp3')
        ? 'audio/mpeg'
        : lowerName.endsWith('.wav')
        ? 'audio/wav'
        : lowerName.endsWith('.ogg')
        ? 'audio/ogg'
        : lowerName.endsWith('.m4a')
        ? 'audio/mp4'
        : lowerName.endsWith('.png')
        ? 'image/png'
        : lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')
        ? 'image/jpeg'
        : lowerName.endsWith('.gif')
        ? 'image/gif'
        : lowerName.endsWith('.webp')
        ? 'image/webp'
        : lowerName.endsWith('.svg')
        ? 'image/svg+xml'
        : lowerName.endsWith('.heic')
        ? 'image/heic'
        : lowerName.endsWith('.heif')
        ? 'image/heif'
        : 'application/octet-stream');

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', 'inline');
    if (stat.size) {
      res.setHeader('Content-Length', stat.size);
    }
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

    stream.pipe(res);
  }
}

