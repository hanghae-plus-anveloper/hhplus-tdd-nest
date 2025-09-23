import { Test, TestingModule } from '@nestjs/testing';
import { PointHistoryTable } from 'src/database/pointhistory.table';
import { UserPointTable } from 'src/database/userpoint.table';
import { PointController } from './point.controller';
import { TransactionType } from './point.model';

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
          useValue: { selectById: jest.fn(), insertOrUpdate: jest.fn() },
        },
        {
          provide: PointHistoryTable,
          useValue: { selectAllByUserId: jest.fn(), insert: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get<PointController>(PointController);
    userDb = module.get(UserPointTable);
    historyDb = module.get(PointHistoryTable);
  });

  // 1. 포인트 충전 테스트, PATCH /point/{userId}/charge
  describe('1. 포인트를 충전한다.', () => {
    it('1-1. 포인트 충전에 성공한다.', async () => {
      const userId = 1;
      const now = Date.now();

      userDb.selectById.mockResolvedValue({
        id: userId,
        point: 50,
        updateMillis: now,
      });
      userDb.insertOrUpdate.mockResolvedValue({
        id: userId,
        point: 150,
        updateMillis: now,
      });
      historyDb.insert.mockResolvedValue({
        id: 1,
        userId,
        amount: 100,
        type: TransactionType.CHARGE,
        timeMillis: now,
      });

      const dto = { amount: 100 };

      const result = await controller.charge(userId.toString(), dto);

      // then
      expect(result.point).toBe(150);
      expect(userDb.selectById).toHaveBeenCalledWith(userId);
      expect(userDb.insertOrUpdate).toHaveBeenCalledWith(userId, 150);
      expect(historyDb.insert).toHaveBeenCalledWith(
        userId,
        100,
        TransactionType.CHARGE,
        expect.any(Number),
      );
    });
    it('1-2. 음수 포인트를 요청 시 포인트 충전에 실패한다.', async () => {
      const userId = 1;
      const dto = { amount: -100 };

      await expect(controller.charge(userId.toString(), dto)).rejects.toThrow(
        '충전 금액은 0보다 커야 합니다.',
      );

      // then
      // DB는 아예 호출되지 않아야 함
      expect(userDb.selectById).not.toHaveBeenCalled();
      expect(userDb.insertOrUpdate).not.toHaveBeenCalled();
      expect(historyDb.insert).not.toHaveBeenCalled();
    });
  });

  // 2. 포인트 사용 테스트, PATCH /point/{userId}/use
  describe('2. 포인트를 사용한다.', () => {
    it('2-1. 포인트 사용에 성공한다.', async () => {
      const userId = 1;
      const now = Date.now();

      userDb.selectById.mockResolvedValue({
        id: userId,
        point: 200,
        updateMillis: now,
      });
      userDb.insertOrUpdate.mockResolvedValue({
        id: userId,
        point: 100, // 200 - 100
        updateMillis: now,
      });
      historyDb.insert.mockResolvedValue({
        id: 1,
        userId,
        amount: 100,
        type: TransactionType.USE,
        timeMillis: now,
      });

      const dto = { amount: 100 };

      const result = await controller.use(userId.toString(), dto);

      expect(result.point).toBe(100);
      expect(userDb.selectById).toHaveBeenCalledWith(userId);
      expect(userDb.insertOrUpdate).toHaveBeenCalledWith(userId, 100);
      expect(historyDb.insert).toHaveBeenCalledWith(
        userId,
        100,
        TransactionType.USE,
        expect.any(Number),
      );
    });

    it('2-2. 존재하지 않는 사용자의 포인트 사용 요청 시 사용에 실패한다.', async () => {
      const userId = 999;
      const dto = { amount: 100 };

      // null 반환
      userDb.selectById.mockResolvedValue(null as any);

      await expect(controller.use(userId.toString(), dto)).rejects.toThrow(
        '존재하지 않는 사용자입니다.',
      );

      expect(userDb.insertOrUpdate).not.toHaveBeenCalled();
      expect(historyDb.insert).not.toHaveBeenCalled();
    });
    it('2-3. 보유한 포인트를 초과하는 포인트 사용 요청 시 사용에 실패한다.', async () => {
      const userId = 1;
      const now = Date.now();

      userDb.selectById.mockResolvedValue({
        id: userId,
        point: 50, // 50
        updateMillis: now,
      });

      const dto = { amount: 100 };

      await expect(controller.use(userId.toString(), dto)).rejects.toThrow(
        '포인트가 부족합니다.',
      );

      expect(userDb.insertOrUpdate).not.toHaveBeenCalled();
      expect(historyDb.insert).not.toHaveBeenCalled();
    });
  });

  // 3. 포인트 조회 테스트, GET /point/{userId}
  describe('3. 포인트를 조회한다.', () => {
    it('3-1. 포인트 조회에 성공한다.', async () => {
      const userId = 1;
      const now = Date.now();

      userDb.selectById.mockResolvedValue({
        id: userId,
        point: 300,
        updateMillis: now,
      });

      const result = await controller.point(userId.toString());

      expect(result).toEqual({
        id: userId,
        point: 300,
        updateMillis: expect.any(Number),
      });
      expect(userDb.selectById).toHaveBeenCalledWith(userId);
    });
    it('3-2. 존재하지 않는 사용자의 포인트 조회 시 조회에 실패한다.', async () => {
      const userId = 999;

      userDb.selectById.mockResolvedValue(null as any);

      await expect(controller.point(userId.toString())).rejects.toThrow(
        '존재하지 않는 사용자입니다.',
      );

      expect(userDb.insertOrUpdate).not.toHaveBeenCalled();
      expect(historyDb.insert).not.toHaveBeenCalled();
    });
  });

  // 4. 포인트 내역 조회 테스트, GET /point/{userId}/histories
  describe('4. 포인트 내역을 조회한다.', () => {
    it('4-1. 포인트 내역 조회에 성공한다.', async () => {
      const userId = 1;
      const now = Date.now();

      userDb.selectById.mockResolvedValue({
        id: userId,
        point: 200,
        updateMillis: now,
      });
      historyDb.selectAllByUserId.mockResolvedValue([
        {
          id: 1,
          userId,
          amount: 100,
          type: TransactionType.CHARGE,
          timeMillis: now,
        },
        {
          id: 2,
          userId,
          amount: 50,
          type: TransactionType.USE,
          timeMillis: now,
        },
      ]);

      const result = await controller.history(userId.toString());

      expect(result).toHaveLength(2);
      expect(result[0].type).toBe(TransactionType.CHARGE);
      expect(result[1].type).toBe(TransactionType.USE);
      expect(historyDb.selectAllByUserId).toHaveBeenCalledWith(userId);
    });
    it('4-2. 존재하지 않는 사용자의 포인트 조회 시 내역 조회에 실패한다.', async () => {
      const userId = 999;

      userDb.selectById.mockResolvedValue(null as any);

      await expect(controller.history(userId.toString())).rejects.toThrow(
        '존재하지 않는 사용자입니다.',
      );

      expect(historyDb.selectAllByUserId).not.toHaveBeenCalled();
    });
  });
});
