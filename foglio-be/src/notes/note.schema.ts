import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Label } from '../labels/label.schema';

export type NoteDocument = Note & Document;

@Schema({ timestamps: true })
export class Note {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  content?: string;

  @Prop({ type: Types.ObjectId, ref: 'Label' })
  label: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Label' })
  previousLabel?: Types.ObjectId;

  @Prop({ required: true })
  user: string;

  @Prop()
  password?: string;

  @Prop({ default: false })
  isProtected: boolean;

  @Prop({ default: false })
  isPinned: boolean;
}

export const NoteSchema = SchemaFactory.createForClass(Note);