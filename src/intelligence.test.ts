import { describe, it, expect, beforeAll } from 'vitest';
import { parseTransactionWithAI } from './intelligence';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';

dayjs.extend(isoWeek); // 週一為第一天

const DATE_FORMATE = 'YYYY-MM-DD';

describe('parseTransactionWithAI', () => {
  beforeAll(() => {
    if (!process.env.GEMINI_API_KEY) {
      console.warn('⚠️  未設定 GEMINI_API_KEY');
    }
  });

  it('測試使用自然語言:昨天中午吃麥當勞 200', async () => {
    const result = await parseTransactionWithAI('昨天中午吃麥當勞 200');
    expect(result?.[0]?.amount).toBe(-200);
    expect(result?.[0]?.category).toBe('飲食');
    expect(result?.[0]?.subcategory).toBe('午餐');
    expect(result?.[0]?.note).toBe('麥當勞');
    expect(result?.[0]?.date).toBe(dayjs().subtract(1, 'day').format(DATE_FORMATE));
  });
  it('測試使用自然語言:禮拜一晚餐99 飲料50', async () => {
    const result = await parseTransactionWithAI('禮拜一晚餐99 飲料50');
    expect(result?.[0]?.amount).toBe(-99);
    expect(result?.[0]?.category).toBe('飲食');
    expect(result?.[0]?.subcategory).toBe('晚餐');
    expect(result?.[1]?.amount).toBe(-50);
    expect(result?.[1]?.category).toBe('飲食');
    expect(result?.[1]?.subcategory).toBe('飲料');
    expect(result?.[0]?.date).toBe(dayjs().isoWeekday(1).format(DATE_FORMATE));
  });
  it('測試使用自然語言:上週日吃喝39 午餐跟阿君平分1000', async () => {
    const result = await parseTransactionWithAI('上週日吃喝39 午餐1000跟阿君平分');
    console.log('📝file: intelligence.test.ts ~ line 37 ~ result:', result);
    expect(result?.[0]?.amount).toBe(-39);
    expect(result?.[0]?.category).toBe('飲食');
    expect(result?.[0]?.subcategory).toBe('吃吃喝喝的');
    expect(result?.[1]?.amount).toBe(-500);
    expect(result?.[1]?.category).toBe('飲食');
    expect(result?.[1]?.subcategory).toBe('午餐');
    expect(result?.[2]?.amount).toBe(-500);
    expect(result?.[2]?.category).toBe('阿君仔');
    expect(result?.[2]?.subcategory).toBe('');
    expect(result?.[2]?.account).toBe('侯阿君');
    expect(result?.[0]?.date).toBe(dayjs().subtract(1, 'week').isoWeekday(7).format(DATE_FORMATE));
  });
  it('沒設置 GEMINI_API_KEY 則直接返回 null', async () => {
    const originalKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    const result = await parseTransactionWithAI('昨天中午吃麥當勞 200');
    expect(result).toBeNull();

    if (originalKey) {
      process.env.GEMINI_API_KEY = originalKey;
    }
  });
});
