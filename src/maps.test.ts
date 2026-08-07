import { describe, expect, it } from 'vitest';
import { parseCsvToCategoryCatalog } from './maps';

describe('parseCsvToCategoryCatalog', () => {
  it('應解析包含收入與支出的三欄格式', () => {
    const catalog = parseCsvToCategoryCatalog(
      'type,category,subcategory\nexpense,飲食,早餐\nincome,薪資,薪水'
    );

    expect(catalog).toEqual({
      expense: { 飲食: ['早餐'] },
      income: { 薪資: ['薪水'] },
    });
  });

  it('舊的兩欄格式應預設為支出', () => {
    const catalog = parseCsvToCategoryCatalog('category,subcategory\n飲食,早餐\n交通,高鐵');

    expect(catalog).toEqual({
      expense: { 飲食: ['早餐'], 交通: ['高鐵'] },
      income: {},
    });
  });

  it('應移除同一分類內重複的子類別', () => {
    const catalog = parseCsvToCategoryCatalog(
      'type,category,subcategory\nincome,薪資,獎金\nincome,薪資,獎金'
    );

    expect(catalog.income.薪資).toEqual(['獎金']);
  });
});
