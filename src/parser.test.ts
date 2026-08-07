import { describe, it, expect } from 'vitest';
import { parseCategoryQuery, parseTransaction, parseCashewLink } from './parser';
import dayjs from 'dayjs';

const DATE_FORMATE = 'YYYY-MM-DD';

describe('parseCategoryQuery', () => {
  it('一般記帳文字應回傳 isQuery: false', () => {
    const res = parseCategoryQuery('早餐 100');
    expect(res.isQuery).toBe(false);
    expect(res.replyText).toBeUndefined();
  });

  it('無關鍵字時應列出所有主類別與子類別概覽', () => {
    const res = parseCategoryQuery('查');
    expect(res.isQuery).toBe(true);
    expect(res.replyText).toContain('💸 支出分類 (13 種)');
    expect(res.replyText).toContain('💰 收入分類 (1 種)');
    expect(res.replyText).toContain(
      '📂 飲食：\n  早餐、午餐、晚餐、宵夜、飲料、豆漿&牛奶、咖啡(豆)、吃吃喝喝的、食材、水果、保健食品、飲料（多人）、冰、麵包、點心、餐費 (多人)'
    );
  });

  it('應支援多種前綴指令：「分類」、「選單」、「!cat」、「/cat」', () => {
    const res1 = parseCategoryQuery('分類');
    expect(res1.isQuery).toBe(true);

    const res2 = parseCategoryQuery('/cat');
    expect(res2.isQuery).toBe(true);
  });

  it('應對子類別關鍵字進行模糊搜尋', () => {
    const res = parseCategoryQuery('查 早餐');
    expect(res.isQuery).toBe(true);
    expect(res.replyText).toContain('🔍 搜尋「早餐」找到的對應類別：');
    expect(res.replyText).toContain('📂 主類別：飲食');
    expect(res.replyText).toContain('🏷️ 子類別：早餐');
  });

  it('應對主類別名稱進行模糊搜尋', () => {
    const res = parseCategoryQuery('查 交通');
    expect(res.isQuery).toBe(true);
    expect(res.replyText).toContain('🔍 搜尋「交通」找到的對應類別：');
    expect(res.replyText).toContain('📂 主類別：交通');
    expect(res.replyText).toContain('💸 支出');
    expect(res.replyText).toContain('🏷️ 包含子類別：火車、高鐵、捷運、公車/客運、計程車');
  });

  it('應查詢收入分類與關鍵字', () => {
    const res = parseCategoryQuery('查 錢錢');
    expect(res.isQuery).toBe(true);
    expect(res.replyText).toContain('💰 收入');
    expect(res.replyText).toContain('📂 主類別：錢錢來啦');
    expect(res.replyText).toContain('🏷️ 包含子類別：獎金、存款息、公司薪資、信用卡回饋');
    expect(res.replyText).not.toContain('💳 回饋卡別：');
  });

  it('查詢信用卡回饋子分類時應列出所有回饋卡別', () => {
    const res = parseCategoryQuery('查 信用卡回饋');
    expect(res.isQuery).toBe(true);
    expect(res.replyText).toContain('📂 主類別：錢錢來啦');
    expect(res.replyText).toContain('🏷️ 子類別：信用卡回饋');
    expect(res.replyText).toContain(
      '💳 回饋卡別：Unicard、Ubear、大戶、Richart、eco永續卡、Cube、熊本熊、iLeo'
    );
  });

  it('不應使用信用卡回饋 title 查到分類', () => {
    const res = parseCategoryQuery('查 Unicard');
    expect(res.isQuery).toBe(true);
    expect(res.replyText).toContain('🔍 未找到與「Unicard」相關的分類。');
  });

  it('查無結果時應回傳友善提示訊息', () => {
    const res = parseCategoryQuery('查 鋼彈');
    expect(res.isQuery).toBe(true);
    expect(res.replyText).toContain('🔍 未找到與「鋼彈」相關的分類。');
  });
});

describe('parseTransaction', () => {
  it('應正確解析基本記帳格式「品項 金額:備註」', () => {
    const t = parseTransaction('早餐 80:麥當勞');
    expect(t.amount).toBe(-80);
    expect(t.category).toBe('飲食');
    expect(t.note).toBe('麥當勞');
    expect(t.date).toBe(dayjs().format(DATE_FORMATE));
  });

  it('應正確解析含日期前綴「MMDD 品項 金額」', () => {
    const t = parseTransaction('0408 高鐵 1490');
    expect(t.amount).toBe(-1490);
    expect(t.category).toBe('交通');
    expect(t.date).toBe('2026-04-08');
  });

  it('多筆交易套用 首行指定日期 (globalDate) 時日期應一致', () => {
    const text = '0510\n高鐵 1490\n晚餐 990';
    const transactionsText = text.split('\n');
    transactionsText.shift();
    const transactions = transactionsText.map(line => parseTransaction(line, '2026-05-10'));
    expect(transactions.length).toBe(2);
    expect(transactions[0].date).toBe('2026-05-10');
    expect(transactions[1].date).toBe('2026-05-10');
  });

  it('收入分類應產生正數金額', () => {
    const t = parseTransaction('回饋 50000');
    expect(t.amount).toBe(50000);
    expect(t.category).toBe('錢錢來啦');
    expect(t.subcategory).toBe('回饋');
  });

  it('信用卡回饋清單應套用固定分類、標題與帳戶', () => {
    const t = parseTransaction('Unicard 500');
    expect(t).toMatchObject({
      title: 'Unicard',
      category: '錢錢來啦',
      subcategory: '信用卡回饋',
      amount: 500,
      date: dayjs().format(DATE_FORMATE),
      account: '我的錢錢',
    });
  });

  it('信用卡回饋卡名比對不分大小寫，並回傳標準名稱', () => {
    const t = parseTransaction('ubear 300');
    expect(t).toMatchObject({
      title: 'Ubear',
      category: '錢錢來啦',
      subcategory: '信用卡回饋',
      amount: 300,
      account: '我的錢錢',
    });
  });

  it('信用卡回饋卡名包含關鍵字，並回傳標準名稱', () => {
    const t = parseTransaction('熊本 163');
    expect(t).toMatchObject({
      title: '熊本熊',
      category: '錢錢來啦',
      subcategory: '信用卡回饋',
      amount: 163,
      account: '我的錢錢',
    });
  });

  it('「阿君加」應固定分類為阿君抵加與正數金額', () => {
    const t = parseTransaction('阿君加 100');
    expect(t).toMatchObject({
      account: '侯阿君',
      amount: 100,
      category: '阿君抵加',
      subcategory: '',
      date: dayjs().format(DATE_FORMATE),
    });
  });

  it('其他阿君訊息應維持阿君仔支出', () => {
    const t = parseTransaction('阿君午餐 100');
    expect(t).toMatchObject({
      account: '侯阿君',
      amount: -100,
      category: '阿君仔',
      subcategory: '',
      date: dayjs().format(DATE_FORMATE),
    });
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
