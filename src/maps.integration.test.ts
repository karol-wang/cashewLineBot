import { describe, it, expect, beforeAll } from 'vitest';
import { getCategoryMap, staticCategoryMap } from './maps';

describe('getCategoryMap（Integration：實際連線 Google Sheet）', () => {
  beforeAll(() => {
    if (!process.env.GOOGLE_SHEET_CSV_URL) {
      console.warn('⚠️  未設定 GOOGLE_SHEET_CSV_URL，將使用靜態備援');
    }
  });

  it('應回傳非空的 categoryMap', { timeout: 10000 }, async () => {
    const map = await getCategoryMap();
    expect(Object.keys(map).length).toBeGreaterThan(0);
  });

  it('應包含「飲食」分類', async () => {
    const map = await getCategoryMap();
    expect(map).toHaveProperty('飲食');
    expect(Array.isArray(map['飲食'])).toBe(true);
  });

  it('飲食 分類應包含至少一個子分類', async () => {
    const map = await getCategoryMap();
    expect(map['飲食'].length).toBeGreaterThan(0);
  });

  it('若有連到 Google Sheet，回傳的資料應與靜態 map 結構相似', async () => {
    const map = await getCategoryMap();
    // 動態 map 的 key 應是 staticCategoryMap 的超集或相同
    const staticKeys = Object.keys(staticCategoryMap);
    const dynamicKeys = Object.keys(map);
    // 至少有一半的靜態 key 能在動態 map 中找到（允許 Google Sheet 有調整）
    const matchCount = staticKeys.filter(k => dynamicKeys.includes(k)).length;
    expect(matchCount).toBeGreaterThanOrEqual(Math.floor(staticKeys.length / 2));
  });
});
