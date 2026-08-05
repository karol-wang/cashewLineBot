import { describe, it, expect } from 'vitest';
import { parseCategoryQuery, parseTransaction, parseCashewLink } from './parser';
import { staticCategoryMap } from './maps';
import dayjs from 'dayjs';

// 假資料直接用靜態對照表
const mockCategoryMap = staticCategoryMap;

describe('parseCategoryQuery', () => {
  it('一般記帳文字應回傳 isQuery: false', () => {
    const res = parseCategoryQuery('早餐 100', mockCategoryMap);
    expect(res.isQuery).toBe(false);
    expect(res.replyText).toBeUndefined();
  });

  it('無關鍵字時應列出所有主類別與子類別概覽', () => {
    const res = parseCategoryQuery('查', mockCategoryMap);
    expect(res.isQuery).toBe(true);
    expect(res.replyText).toContain('目前系統支援的記帳分類 (13 種)');
    expect(res.replyText).toContain(
      '📂 飲食：\n  早餐、午餐、晚餐、宵夜、飲料、豆漿&牛奶、咖啡(豆)、吃吃喝喝的、食材、水果、保健食品、飲料（多人）、冰、麵包、點心、餐費 (多人)'
    );
  });

  it('應支援多種前綴指令：「分類」、「選單」、「!cat」、「/cat」', () => {
    const res1 = parseCategoryQuery('分類', mockCategoryMap);
    expect(res1.isQuery).toBe(true);

    const res2 = parseCategoryQuery('/cat', mockCategoryMap);
    expect(res2.isQuery).toBe(true);
  });

  it('應對子類別關鍵字進行模糊搜尋', () => {
    const res = parseCategoryQuery('查 早餐', mockCategoryMap);
    expect(res.isQuery).toBe(true);
    expect(res.replyText).toContain('🔍 搜尋「早餐」找到的對應類別：');
    expect(res.replyText).toContain('📂 主類別：飲食');
    expect(res.replyText).toContain('🏷️ 子類別：早餐');
  });

  it('應對主類別名稱進行模糊搜尋', () => {
    const res = parseCategoryQuery('查 交通', mockCategoryMap);
    expect(res.isQuery).toBe(true);
    expect(res.replyText).toContain('🔍 搜尋「交通」找到的對應類別：');
    expect(res.replyText).toContain('📂 主類別：交通');
    expect(res.replyText).toContain('🏷️ 包含子類別：火車、高鐵、捷運、公車/客運、計程車');
  });

  it('查無結果時應回傳友善提示訊息', () => {
    const res = parseCategoryQuery('查 鋼彈', mockCategoryMap);
    expect(res.isQuery).toBe(true);
    expect(res.replyText).toContain('🔍 未找到與「鋼彈」相關的分類。');
  });
});

describe('parseTransaction', () => {
  it('應正確解析基本記帳格式「品項 金額:備註」', () => {
    const t = parseTransaction('早餐 80:麥當勞', undefined, mockCategoryMap);
    expect(t.amount).toBe(-80);
    expect(t.category).toBe('飲食');
    expect(t.note).toBe('麥當勞');
    expect(t.date).toBe(dayjs().format('YYYY-MM-DD')); // 應該取當前日期
  });

  it('應正確解析含日期前綴「MMDD 品項 金額」', () => {
    const t = parseTransaction('0408 高鐵 1490', undefined, mockCategoryMap);
    expect(t.amount).toBe(-1490);
    expect(t.category).toBe('交通');
    expect(t.date).toBe('2026-04-08');
  });

  it('多筆交易套用 首行指定日期 (globalDate) 時日期應一致', () => {
    const text = '0510\n高鐵 1490\n晚餐 990';
    const transactionsText = text.split('\n');
    transactionsText.shift();
    const transactions = transactionsText.map(line =>
      parseTransaction(line, '2026-05-10', mockCategoryMap)
    );
    expect(transactions.length).toBe(2);
    expect(transactions[0].date).toBe('2026-05-10');
    expect(transactions[1].date).toBe('2026-05-10');
  });
});

describe('parseCashewLink', () => {
  it('應產生正確的 webApp 與 App deep link 網址', () => {
    const platform = parseCashewLink([{ category: '飲食', amount: -100 }], {
      webApp: 'https://web.cashew.com',
      app: 'https://app.cashew.com',
    });
    expect(platform.webApp).toContain('https://web.cashew.com/addTransaction?JSON=');
    expect(platform.app).toContain('https://app.cashew.com/addTransaction?JSON=');
  });
});
