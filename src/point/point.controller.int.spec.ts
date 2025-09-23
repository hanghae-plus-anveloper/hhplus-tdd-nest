import { Test, TestingModule } from '@nestjs/testing';
import { PointHistoryTable } from 'src/database/pointhistory.table';
import { UserPointTable } from 'src/database/userpoint.table';
import { PointController } from 'src/point/point.controller';
import { TransactionType } from './point.model';

describe('PointController (Integration)', () => {
  let controller: PointController;
  let userDb: UserPointTable;
  let historyDb: PointHistoryTable;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PointController],
      providers: [UserPointTable, PointHistoryTable],
    }).compile();

    controller = module.get<PointController>(PointController);
    userDb = module.get<UserPointTable>(UserPointTable);
    historyDb = module.get<PointHistoryTable>(PointHistoryTable);
  });

  it('동시에 여러 요청이 들어와도 직렬화되어 순서 보장', async () => {
    const userId = 1;

    // 초기 잔액 100
    await userDb.insertOrUpdate(userId, 100);

    // 동시에 3개의 사용 요청(-50) 실행
    const tasks = [
      controller.use(userId.toString(), { amount: 50 }),
      controller.use(userId.toString(), { amount: 50 }),
      controller.use(userId.toString(), { amount: 50 }),
    ];

    const results = await Promise.allSettled(tasks);

    // 성공/실패 카운트
    const success = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    expect(success).toBe(2); // 100에서 50, 50 → 두 번 성공
    expect(failed).toBe(1); // 세 번째는 실패 (포인트 부족)

    const finalPoint = await userDb.selectById(userId);
    expect(finalPoint.point).toBe(0); // 최종 잔액 0

    const histories = await historyDb.selectAllByUserId(userId);
    expect(histories).toHaveLength(2); // 두 번만 성공 기록
    expect(histories.every((h) => h.type === TransactionType.USE)).toBe(true);
    expect(histories.map((h) => h.amount)).toEqual([50, 50]); // 두 번 다 -50
  });
});
