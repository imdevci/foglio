import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './user.schema';
import { Note, NoteDocument } from '../notes/note.schema';
import { Label, LabelDocument } from '../labels/label.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Note.name) private noteModel: Model<NoteDocument>,
    @InjectModel(Label.name) private labelModel: Model<LabelDocument>,
  ) {}

  async findOneByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email }).exec();
  }

  async findOneById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  async create(userData: Partial<User>): Promise<UserDocument> {
    const newUser = new this.userModel(userData);
    return newUser.save();
  }

  async updateRefreshToken(userId: string, refreshToken: string | null): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, { refreshToken }).exec();
  }

  async deleteUserData(userId: string, email?: string): Promise<void> {
    const userIdentifiers: string[] = [];
    if (email) userIdentifiers.push(email);
    if (userId) userIdentifiers.push(userId);

    await Promise.all([
      this.noteModel.deleteMany({ user: { $in: userIdentifiers } }).exec(),
      this.labelModel.deleteMany({ user: { $in: userIdentifiers } }).exec(),
      this.userModel.findByIdAndDelete(userId).exec(),
    ]);
  }
}
