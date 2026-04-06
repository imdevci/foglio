import { Controller, Get, Post, Put, Delete, Body, Param, Req, BadRequestException } from '@nestjs/common';
import { LabelsService } from './labels.service';
import { Label } from './label.schema';
import { CreateLabelDto } from './create-label.dto';
import { UpdateLabelDto } from './update-label.dto';

@Controller('labels')
export class LabelsController {
  constructor(private readonly labelsService: LabelsService) { }

  @Get()
  async findAll(@Req() req: any): Promise<Label[]> {
    const user = req.user.email;
    if (!user) {
      throw new BadRequestException('User not found in token');
    }
    return this.labelsService.findAll(user);
  }

  @Post()
  async create(@Req() req: any, @Body() createLabelDto: CreateLabelDto): Promise<Label> {
    const user = req.user.email;
    if (!user) {
      throw new BadRequestException('User not found in token');
    }
    return this.labelsService.create({ ...createLabelDto, user });
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() updateLabelDto: UpdateLabelDto): Promise<Label | null> {
    return this.labelsService.update(id, updateLabelDto);
  }

  @Delete(':id')
  async delete(@Param('id') id: string): Promise<any> {
    return this.labelsService.delete(id);
  }
}