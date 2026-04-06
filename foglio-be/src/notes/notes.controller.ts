import { Controller, Get, Post, Put, Delete, Body, Param, Req, BadRequestException, Query, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Note, NoteDocument } from './note.schema';
import { CreateNoteDto } from './create-note.dto';
import { UpdateNoteDto } from './update-note.dto';
import { LabelsService } from '../labels/labels.service';
import { UsersService } from '../users/users.service';
import { Public } from '../auth/public.decorator';
import * as bcrypt from 'bcrypt';

@Controller('notes')
export class NotesController {
  constructor(
    @InjectModel(Note.name) private noteModel: Model<NoteDocument>,
    private readonly labelsService: LabelsService,
    private readonly usersService: UsersService,
  ) { }

  @Get()
  async findAll(
    @Req() req: any,
    @Query('search') search?: string,
  ): Promise<any[]> {
    const user = req.user.email;
    if (!user) {
      throw new BadRequestException('User not found in token');
    }
    const query: any = { user };
    const trashLabel = await this.labelsService.ensureTrashLabelExists(user);
    if (trashLabel) {
      query.label = { $ne: trashLabel._id };
    }

    if (search && search.trim()) {
      const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = escaped.replace(/\s+/g, '(?:\\s*|<[^>]+>)+');
      query.$or = [
        { title: { $regex: pattern, $options: 'i' } },
        {
          content: { $regex: pattern, $options: 'i' },
          isProtected: { $ne: true },
          password: { $in: [null, ''] },
        },
      ];
    }
    const notes = await this.noteModel
      .find(query)
      .populate('label')
      .sort({ isPinned: -1, updatedAt: -1, createdAt: -1 })
      .exec();

    return notes.map(note => {
      const noteObj = note.toObject();
      const isProtected = !!noteObj.isProtected || !!noteObj.password;
      if (isProtected) {
        delete noteObj.content;
      }
      delete noteObj.password;
      return { ...noteObj, isProtected, isPinned: !!noteObj.isPinned };
    });
  }

  @Public()
  @Get('link-preview')
  async getLinkPreview(@Query('url') url: string): Promise<any> {
    if (!url) {
      throw new BadRequestException('URL is required');
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        throw new Error('Invalid protocol');
      }
    } catch {
      throw new BadRequestException('Invalid URL');
    }

    const hostname = parsedUrl.hostname.replace(/^www\./, '');
    const defaultResult = {
      url: parsedUrl.href,
      domain: hostname,
      title: hostname,
      description: '',
      image: '',
      favicon: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=64`,
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    try {
      const response = await fetch(parsedUrl.href, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
        },
      });

      if (!response.ok) {
        return defaultResult;
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
        return defaultResult;
      }

      const html = (await response.text()).slice(0, 150000);

      const getMetaContent = (regexes: RegExp[]): string => {
        for (const regex of regexes) {
          const match = html.match(regex);
          if (match && match[1]) {
            return match[1]
              .replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&quot;/g, '"')
              .replace(/&#39;/g, "'")
              .replace(/&#x27;/g, "'")
              .trim();
          }
        }
        return '';
      };

      const title = getMetaContent([
        /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
        /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i,
        /<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i,
        /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:title["']/i,
        /<title[^>]*>([^<]+)<\/title>/i,
      ]) || hostname;

      const description = getMetaContent([
        /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
        /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i,
        /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
        /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i,
        /<meta[^>]+name=["']twitter:description["'][^>]+content=["']([^"']+)["']/i,
      ]);

      let image = getMetaContent([
        /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
        /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
        /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
        /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
      ]);

      if (image && !image.startsWith('http://') && !image.startsWith('https://')) {
        try {
          image = new URL(image, parsedUrl.origin).href;
        } catch {
          image = '';
        }
      }

      return {
        url: parsedUrl.href,
        domain: hostname,
        title,
        description,
        image,
        favicon: defaultResult.favicon,
      };
    } catch {
      return defaultResult;
    } finally {
      clearTimeout(timeout);
    }
  }

  @Get('by-label/:labelId')
  async findByLabel(@Param('labelId') labelId: string): Promise<any[]> {
    const notes = await this.noteModel.find({
      $or: [
        { label: labelId },
        { label: new Types.ObjectId(labelId) },
      ],
    })
      .populate('label')
      .sort({ isPinned: -1, updatedAt: -1, createdAt: -1 })
      .exec();

    return notes.map(note => {
      const noteObj = note.toObject();
      const isProtected = !!noteObj.isProtected || !!noteObj.password;
      if (isProtected) {
        delete noteObj.content;
      }
      delete noteObj.password;
      return { ...noteObj, isProtected, isPinned: !!noteObj.isPinned };
    });
  }

  @Post()
  async create(@Req() req: any, @Body() createNoteDto: CreateNoteDto): Promise<Note> {
    const user = req.user.email;
    if (!user) {
      throw new BadRequestException('User not found in token');
    }

    const noteData: any = {
      ...createNoteDto,
      user,
      isProtected: !!createNoteDto.isProtected || !!createNoteDto.password,
    };
    if (createNoteDto.password) {
      noteData.password = await bcrypt.hash(createNoteDto.password, 10);
    }

    const createdNote = new this.noteModel(noteData);
    return createdNote.save();
  }

  @Put(':id/pin')
  async togglePin(@Param('id') id: string): Promise<any> {
    const note = await this.noteModel.findById(id).exec();
    if (!note) {
      throw new BadRequestException('Note not found');
    }
    note.isPinned = !note.isPinned;
    await note.save();
    return { success: true, isPinned: note.isPinned };
  }

  @Put(':id/protect')
  async toggleProtect(
    @Param('id') id: string,
    @Body('isProtected') isProtected?: boolean,
  ): Promise<any> {
    const note = await this.noteModel.findById(id).exec();
    if (!note) {
      throw new BadRequestException('Note not found');
    }
    const nextProtected =
      typeof isProtected === 'boolean'
        ? isProtected
        : !(note.isProtected || !!note.password);
    note.isProtected = nextProtected;
    if (!nextProtected) {
      note.password = undefined;
    }
    await note.save();
    return { success: true, isProtected: note.isProtected };
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() updateNoteDto: UpdateNoteDto): Promise<Note | null> {
    const updateData: any = { ...updateNoteDto };
    if (typeof updateNoteDto.isProtected === 'boolean') {
      updateData.isProtected = updateNoteDto.isProtected;
      if (!updateNoteDto.isProtected) {
        updateData.password = null;
      }
    }
    if (updateNoteDto.password) {
      updateData.password = await bcrypt.hash(updateNoteDto.password, 10);
      updateData.isProtected = true;
    } else if (updateNoteDto.password === "") {
      updateData.password = null;
    } else if (typeof updateNoteDto.isProtected !== 'boolean') {
      delete updateData.password;
    }

    return this.noteModel.findByIdAndUpdate(id, updateData, { new: true }).exec();
  }

  @Post(':id/unlock')
  async unlock(
    @Req() req: any,
    @Param('id') id: string,
    @Body('password') password: string,
  ): Promise<Note> {
    const note = await this.noteModel.findById(id).populate('label').exec();
    if (!note) {
      throw new BadRequestException('Note not found');
    }

    if (!note.isProtected && !note.password) {
      return note;
    }

    let isMatch = false;
    const userEmail = req.user?.email || note.user;
    if (userEmail) {
      const userDoc = await this.usersService.findOneByEmail(userEmail);
      if (userDoc && userDoc.password) {
        isMatch = await bcrypt.compare(password, userDoc.password);
      }
    }

    if (!isMatch && note.password) {
      isMatch = await bcrypt.compare(password, note.password);
    }

    if (!isMatch) {
      throw new BadRequestException('Invalid password');
    }

    const noteObj = note.toObject();
    delete noteObj.password;
    return { ...noteObj, isProtected: !!noteObj.isProtected || !!note.password } as any;
  }

  @Delete('trash/empty')
  async emptyTrash(@Req() req: any): Promise<any> {
    const user = req.user.email;
    if (!user) {
      throw new BadRequestException('User not found in token');
    }
    return this.labelsService.emptyTrash(user);
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @Query('permanent') permanent?: string): Promise<any> {
    return this.labelsService.deleteNote(id, permanent === 'true');
  }

  @Put(':id/restore')
  async restorePut(@Param('id') id: string): Promise<any> {
    return this.handleRestore(id);
  }

  @Post(':id/restore')
  async restorePost(@Param('id') id: string): Promise<any> {
    return this.handleRestore(id);
  }

  private async handleRestore(id: string): Promise<any> {
    const note = await this.labelsService.restoreNote(id);
    if (!note) return null;
    const noteObj = note.toObject ? note.toObject() : note;
    const isProtected = !!noteObj.isProtected || !!noteObj.password;
    if (isProtected) {
      delete noteObj.content;
    }
    delete noteObj.password;
    return { ...noteObj, isProtected, isPinned: !!noteObj.isPinned };
  }
}