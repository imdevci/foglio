import { Test, TestingModule } from '@nestjs/testing';
import { NotesController } from './notes.controller';
import { getModelToken } from '@nestjs/mongoose';
import { Note } from './note.schema';
import { LabelsService } from '../labels/labels.service';
import { UsersService } from '../users/users.service';

describe('NotesController', () => {
  let controller: NotesController;
  let mockNoteModel: any;
  let mockLabelsService: Partial<LabelsService>;
  let mockUsersService: Partial<UsersService>;

  beforeEach(async () => {
    mockNoteModel = {
      find: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([
        {
          toObject: () => ({
            _id: 'note1',
            title: 'Meeting Notes',
            content: '<p>Discuss budget and targets</p>',
            user: 'user@example.com',
            isProtected: false,
            isPinned: false,
          }),
        },
      ]),
    };

    mockLabelsService = {
      ensureTrashLabelExists: jest.fn().mockResolvedValue({ _id: 'trash123' } as any),
      restoreNote: jest.fn().mockResolvedValue({
        toObject: () => ({
          _id: 'note1',
          title: 'Meeting Notes',
          content: '<p>Discuss budget and targets</p>',
          label: { _id: 'label1', name: 'Work' },
          isProtected: false,
        }),
      } as any),
    };

    mockUsersService = {};

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotesController],
      providers: [
        {
          provide: getModelToken(Note.name),
          useValue: mockNoteModel,
        },
        {
          provide: LabelsService,
          useValue: mockLabelsService,
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    controller = module.get<NotesController>(NotesController);
  });

  it('should search both title and content while excluding trash', async () => {
    const req = { user: { email: 'user@example.com' } };
    const results = await controller.findAll(req, 'budget');

    expect(mockNoteModel.find).toHaveBeenCalledWith(
      expect.objectContaining({
        user: 'user@example.com',
        label: { $ne: 'trash123' },
        $or: expect.arrayContaining([
          expect.objectContaining({ title: { $regex: 'budget', $options: 'i' } }),
          expect.objectContaining({ content: { $regex: 'budget', $options: 'i' } }),
        ]),
      }),
    );
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('Meeting Notes');
    expect(results[0].content).toBe('<p>Discuss budget and targets</p>');
  });

  it('should restore a note from trash', async () => {
    const result = await controller.restorePut('note1');

    expect(mockLabelsService.restoreNote).toHaveBeenCalledWith('note1');
    expect(result._id).toBe('note1');
    expect(result.label.name).toBe('Work');
  });
});

