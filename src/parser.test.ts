import { describe, it, expect } from 'vitest';
import { parseTransaction, parseCashewLink } from './parser';
import { staticCategoryMap } from './maps';

// ──────────────────────────────────────────────
// parseTransaction
// ──────────────────────────────────────────────

describe('parseTransaction', () => {
  const map = staticCategoryMap;

  it('解析基本格式：品項 金額', () => {
    const result = parseTransaction('早餐 100', undefined, map);
    expect(result.amount).toBe(-100);
    expect(result.category).toBe('飲食');
    expect(result.subcategory).toBe('早餐');
  });

  it('解析含日期格式：MMDD 品項 金額', () => {
    const result = parseTransaction('0801 午餐 150', undefined, map);
    expect(result.amount).toBe(-150);
    expect(result.date).toMatch(/^\d{4}-08-01$/);
  });

  it('解析含備註格式：品項 金額:備註', () => {
    const result = parseTransaction('咖啡(豆) 250:星巴克', undefined, map);
    expect(result.amount).toBe(-250);
    expect(result.note).toBe('星巴克');
  });

  it('globalDate 在沒有指定日期時套用', () => {
    const result = parseTransaction('晚餐 200', '2025-08-01', map);
    expect(result.date).toBe('2025-08-01');
  });

  it('指定日期優先於 globalDate', () => {
    const result = parseTransaction('0805 晚餐 200', '2025-08-01', map);
    expect(result.date).toMatch(/^\d{4}-08-05$/);
  });

  it('阿君存入：金額為負數（加進帳戶）', () => {
    const result = parseTransaction('阿君存 500', undefined, map);
    expect(result.account).toBe('侯阿君');
    expect(result.amount).toBe(500); // 存入為正數（cashew 以正數表示存入）
    expect(result.category).toBe('阿君抵加');
  });

  it('阿君消費：金額為正數', () => {
    const result = parseTransaction('阿君 100', undefined, map);
    expect(result.account).toBe('侯阿君');
    expect(result.amount).toBe(-100);
    expect(result.category).toBe('阿君仔');
  });

  it('格式錯誤：回傳 NaN amount', () => {
    const result = parseTransaction('不合格式', undefined, map);
    expect(isNaN(result.amount)).toBe(true);
  });
});

// ──────────────────────────────────────────────
// parseCashewLink
// ──────────────────────────────────────────────

describe('parseCashewLink', () => {
  const mockPlatform = {
    webApp: 'https://cashewapp.web.app',
    app: 'cashewapp://',
  };

  it('產生正確的 webApp URL', () => {
    const transactions = [{ category: '飲食', subcategory: '早餐', amount: -100 }];
    const result = parseCashewLink(transactions, mockPlatform);
    expect(result.webApp).toContain('cashewapp.web.app/addTransaction');
    expect(result.webApp).toContain('JSON=');
  });

  it('產生正確的 app deep link', () => {
    const transactions = [{ category: '飲食', subcategory: '午餐', amount: -200 }];
    const result = parseCashewLink(transactions, mockPlatform);
    expect(result.app).toContain('cashewapp://');
  });
});
