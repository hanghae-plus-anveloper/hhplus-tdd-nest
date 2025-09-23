import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  ValidationPipe,
} from '@nestjs/common';
import { enqueue } from 'src/common/concurrency/queue';
import { PointHistoryTable } from 'src/database/pointhistory.table';
import { UserPointTable } from 'src/database/userpoint.table';
import { PointBody as PointDto } from './point.dto';
import { PointHistory, TransactionType, UserPoint } from './point.model';

@Controller('/point')
export class PointController {
  constructor(
    private readonly userDb: UserPointTable,
    private readonly historyDb: PointHistoryTable,
  ) {}

  /**
   * TODO - 특정 유저의 포인트를 조회하는 기능을 작성해주세요.
   */
  @Get(':id')
  async point(@Param('id') id): Promise<UserPoint> {
    const userId = Number.parseInt(id);

    const userPoint = await this.userDb.selectById(userId);
    if (!userPoint) {
      throw new Error('존재하지 않는 사용자입니다.');
    }

    return userPoint;
  }

  /**
   * TODO - 특정 유저의 포인트 충전/이용 내역을 조회하는 기능을 작성해주세요.
   */
  @Get(':id/histories')
  async history(@Param('id') id): Promise<PointHistory[]> {
    const userId = Number.parseInt(id);

    const userPoint = await this.userDb.selectById(userId);
    if (!userPoint) {
      throw new Error('존재하지 않는 사용자입니다.');
    }

    return this.historyDb.selectAllByUserId(userId);
  }

  /**
   * TODO - 특정 유저의 포인트를 충전하는 기능을 작성해주세요.
   */
  @Patch(':id/charge')
  async charge(
    @Param('id') id,
    @Body(ValidationPipe) pointDto: PointDto,
  ): Promise<UserPoint> {
    const userId = Number.parseInt(id);

    // enqueue를 사용하여 userId별로 작업이 순차적으로 처리
    return enqueue(userId, async () => {
      const amount = pointDto.amount;

      if (amount <= 0) {
        throw new Error('충전 금액은 0보다 커야 합니다.');
      }

      const current = await this.userDb.selectById(userId);
      if (!current) {
        throw new Error('존재하지 않는 사용자입니다.');
      }

      const updated = await this.userDb.insertOrUpdate(
        userId,
        current.point + amount,
      );
      await this.historyDb.insert(
        userId,
        amount,
        TransactionType.CHARGE,
        updated.updateMillis,
      );

      return updated;
    });
  }

  /**
   * TODO - 특정 유저의 포인트를 사용하는 기능을 작성해주세요.
   */
  @Patch(':id/use')
  async use(
    @Param('id') id,
    @Body(ValidationPipe) pointDto: PointDto,
  ): Promise<UserPoint> {
    const userId = Number.parseInt(id);

    // enqueue를 사용하여 userId별로 작업이 순차적으로 처리
    return enqueue(userId, async () => {
      const amount = pointDto.amount;

      const current = await this.userDb.selectById(userId);
      if (!current) {
        throw new Error('존재하지 않는 사용자입니다.');
      }

      if (current.point < amount) {
        throw new Error('포인트가 부족합니다.');
      }

      const updated = await this.userDb.insertOrUpdate(
        userId,
        current.point - amount,
      );
      await this.historyDb.insert(
        userId,
        amount,
        TransactionType.USE,
        updated.updateMillis,
      );

      return updated;
    });
  }
}
