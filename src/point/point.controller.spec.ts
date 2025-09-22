import { Test, TestingModule } from '@nestjs/testing';
import { PointHistoryTable } from 'src/database/pointhistory.table';
import { UserPointTable } from 'src/database/userpoint.table';
import { PointController } from './point.controller';

describe('PointController', () => {
  let controller: PointController;
  let userDb: jest.Mocked<UserPointTable>;
  let historyDb: jest.Mocked<PointHistoryTable>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PointController],
      providers: [
        {
          provide: UserPointTable,
          useValue: { findById: jest.fn(), save: jest.fn() },
        },
        {
          provide: PointHistoryTable,
          useValue: { findByUserId: jest.fn(), save: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get<PointController>(PointController);
    userDb = module.get(UserPointTable);
    historyDb = module.get(PointHistoryTable);
  });
});
