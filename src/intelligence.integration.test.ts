import { describe, it, expect, beforeAll } from 'vitest';
import { parseTransactionWithAI } from './intelligence';
import datetime from './datetime';

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
    expect(result?.[0]?.date).toBe(datetime().subtract(1, 'day').format(DATE_FORMATE));
  });
  it('測試使用自然語言:禮拜一晚餐99 飲料50', async () => {
    const result = await parseTransactionWithAI('禮拜一晚餐99 飲料50');
    expect(result?.[0]?.amount).toBe(-99);
    expect(result?.[0]?.category).toBe('飲食');
    expect(result?.[0]?.subcategory).toBe('晚餐');
    expect(result?.[1]?.amount).toBe(-50);
    expect(result?.[1]?.category).toBe('飲食');
    expect(result?.[1]?.subcategory).toBe('飲料');
    expect(result?.[0]?.date).toBe(datetime().isoWeekday(1).format(DATE_FORMATE));
  });
  it('測試使用自然語言:上週日吃喝39 午餐跟阿君平分1000', async () => {
    const result = await parseTransactionWithAI('上週日吃喝39 午餐1000跟阿君平分');
    console.log('📝file: intelligence.integration.test.ts ~ line 37 ~ result:', result);
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
    expect(result?.[0]?.date).toBe(
      datetime().subtract(1, 'week').isoWeekday(7).format(DATE_FORMATE)
    );
  });
  it('收入類別應回傳正數金額', async () => {
    const result = await parseTransactionWithAI('今天薪水入帳 50000');
    expect(result?.[0]?.amount).toBe(50000);
    expect(result?.[0]?.category).toBe('錢錢來啦');
    expect(result?.[0]?.subcategory).toBe('公司薪資');
    expect(result?.[0]?.date).toBe(datetime().format(DATE_FORMATE));
  });
  it('阿君加應回傳阿君抵加收入', async () => {
    const result = await parseTransactionWithAI('阿君存100');
    expect(result?.[0]).toMatchObject({
      amount: 100,
      category: '阿君抵加',
      subcategory: '',
      account: '侯阿君',
      date: datetime().format(DATE_FORMATE),
    });
  });
  it('信用卡回饋清單應回傳固定分類、標題與帳戶', async () => {
    const result = await parseTransactionWithAI('Unicard 500');
    expect(result?.[0]).toMatchObject({
      title: 'Unicard',
      amount: 500,
      category: '錢錢來啦',
      subcategory: '信用卡回饋',
      account: '我的錢錢',
      date: datetime().format(DATE_FORMATE),
    });
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
