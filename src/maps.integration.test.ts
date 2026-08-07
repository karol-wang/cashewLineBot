import { describe, it, expect, beforeAll } from 'vitest';
import { getCategoryCatalog, staticExpenseCategoryMap } from './maps';

describe('getCategoryCatalog（Integration：實際連線 Google Sheet）', () => {
  beforeAll(() => {
    if (!process.env.GOOGLE_SHEET_CSV_URL) {
      console.warn('⚠️  未設定 GOOGLE_SHEET_CSV_URL，將使用靜態備援');
    }
  });

  it('應回傳非空的 category catalog', { timeout: 10000 }, async () => {
    const catalog = await getCategoryCatalog();
    expect(Object.keys(catalog.expense).length).toBeGreaterThan(0);
    expect(Object.keys(catalog.income).length).toBeGreaterThan(0);
  });

  it('應包含「飲食」分類', async () => {
    const catalog = await getCategoryCatalog();
    expect(catalog.expense).toHaveProperty('飲食');
    expect(Array.isArray(catalog.expense['飲食'])).toBe(true);
  });

  it('飲食 分類應包含至少一個子分類', async () => {
    const catalog = await getCategoryCatalog();
    expect(catalog.expense['飲食'].length).toBeGreaterThan(0);
  });

  it('若有連到 Google Sheet，回傳的資料應與靜態 map 結構相似', async () => {
    const catalog = await getCategoryCatalog();
    // 動態 map 的 key 應是 staticCategoryMap 的超集或相同
    const staticKeys = Object.keys(staticExpenseCategoryMap);
    const dynamicKeys = Object.keys(catalog.expense);
    // 至少有一半的靜態 key 能在動態 map 中找到（允許 Google Sheet 有調整）
    const matchCount = staticKeys.filter(k => dynamicKeys.includes(k)).length;
    expect(matchCount).toBeGreaterThanOrEqual(Math.floor(staticKeys.length / 2));
  });
});
