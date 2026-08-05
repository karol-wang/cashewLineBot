import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { achunCategory, depositWords, staticCategoryMap } from './maps';
import { CashewPlatform, Transaction } from './types';

dayjs.extend(customParseFormat);

/**
 * 從文字中解析出交易紀錄，並回傳交易的物件
 * @description 日期(MMDD) 品項 金額:備註
 */
export const parseTransaction = (
  text: string,
  /** YYYY-MM-DD */
  globalDate?: string,
  currentCategoryMap: Record<string, string[]> = staticCategoryMap
): Transaction => {
  // 增加備註 & 日期的解析
  const match = text
    .trim()
    .match(/^(?:((?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01]))\s+)?(.+)\s+(-?\d+)\s*(?::(.*))?$/);

  if (!match) {
    // Return a dummy transaction that will fail the validation in handleEvent
    return { category: '', subcategory: '', amount: NaN } as unknown as Transaction;
  }

  const [, dateStr, descRaw, amountStr, noteRaw] = match;
  const description = descRaw.trim();
  /**
   * 預設為支出(負數)
   */
  const amount = -parseInt(amountStr, 10);

  /** YYYY-MM-DD */
  let date: string | undefined;
  if (dateStr) {
    const d = dayjs(dateStr, ['MMDD'], true);
    date = d.isValid() ? d.format('YYYY-MM-DD') : undefined;
  }

  if (!date && globalDate) {
    date = globalDate;
  } else if (!date) {
    date = dayjs().format('YYYY-MM-DD'); // 預設為今天
  }

  const note = noteRaw?.trim();

  if (description.includes('阿君')) {
    const regex = new RegExp(depositWords.join('|'));
    const isRecharge = regex.test(description);
    const category = isRecharge ? achunCategory.deposit : achunCategory.spent;

    return {
      account: '侯阿君',
      amount: isRecharge ? -amount : amount,
      category,
      date,
      note,
    };
  }

  const [category] = Object.entries(currentCategoryMap).find(
    ([, subCategories]) =>
      subCategories.some(keyword => description.includes(keyword) || keyword.includes(description)) // 輸入內容與子類別關鍵字任一方包含另一方，就符合
  ) ?? [''];
  const subcategory = category ? description : '';

  return { category, subcategory, amount, date, note };
};

/**
 * 構造 Cashew App Link (依平台導向 Web App 或 App)
 * @param transactions
 */
export const parseCashewLink = (
  transactions: Transaction[],
  cashewPlatformUrl: CashewPlatform
): CashewPlatform => {
  const json = JSON.stringify({ transactions });

  // 手機版：導向 Cashew App 的 Deep Link
  const appUrl = new URL(`${cashewPlatformUrl.app}/addTransaction`);
  appUrl.searchParams.append('JSON', json);

  // 電腦版：導向 Cashew Web App
  const webUrl = new URL(`${cashewPlatformUrl.webApp}/addTransaction`);
  webUrl.searchParams.append('JSON', json);

  return { webApp: webUrl.href, app: appUrl.href };
};

export interface CategoryQueryResult {
  isQuery: boolean;
  replyText?: string;
}

/**
 * 檢查輸入訊息是否為類別查詢指令，若符合則傳回格式化好的回覆內容
 * 前綴指令：查、查詢、分類、選單、類別、!cat、/cat
 */
export const parseCategoryQuery = (
  userText: string,
  categoryMap: Record<string, string[]> = staticCategoryMap
): CategoryQueryResult => {
  const queryPrefixRegex = /^(?:查|查詢|分類|選單|類別|!cat|\/cat)(?:\s+(.*))?$/i;
  const queryMatch = userText.match(queryPrefixRegex);

  if (!queryMatch) {
    return { isQuery: false };
  }

  const keyword = queryMatch[1]?.trim();

  // 1. 若無輸入關鍵字 (如「查」、「分類」、「選單」)，列出所有主類別與子類別概覽
  if (!keyword) {
    const categories = Object.keys(categoryMap);
    let replyText = `📋 目前系統支援的記帳分類 (${categories.length} 種)：\n\n`;
    for (const [cat, subCats] of Object.entries(categoryMap)) {
      replyText += `📂 ${cat}：\n  ${subCats.join('、')}\n\n`;
    }
    replyText += `💡 提示：輸入「查 <品項/關鍵字>」可查詢特定分類。`;

    return { isQuery: true, replyText: replyText.trim() };
  }

  // 2. 進行模糊搜尋 (同時比對主類別名稱與子類別關鍵字)
  const searchKeyword = keyword.toLowerCase();
  const results: {
    category: string;
    subcategory?: string;
    matchedType: 'category' | 'subcategory';
  }[] = [];

  for (const [cat, subCats] of Object.entries(categoryMap)) {
    const catMatches =
      cat.toLowerCase().includes(searchKeyword) || searchKeyword.includes(cat.toLowerCase());
    const matchedSubs = subCats.filter(
      sub => sub.toLowerCase().includes(searchKeyword) || searchKeyword.includes(sub.toLowerCase())
    );

    if (catMatches) {
      results.push({ category: cat, matchedType: 'category' });
    } else if (matchedSubs.length > 0) {
      matchedSubs.forEach(sub => {
        results.push({ category: cat, subcategory: sub, matchedType: 'subcategory' });
      });
    }
  }

  if (results.length > 0) {
    let replyText = `🔍 搜尋「${keyword}」找到的對應類別：\n\n`;

    results.forEach(item => {
      if (item.matchedType === 'category') {
        const subCats = categoryMap[item.category] || [];
        replyText += `📂 主類別：${item.category}\n🏷️ 包含子類別：${subCats.join('、')}\n\n`;
      } else {
        replyText += `📂 主類別：${item.category}\n🏷️ 子類別：${item.subcategory}\n\n`;
      }
    });

    return { isQuery: true, replyText: replyText.trim() };
  } else {
    return {
      isQuery: true,
      replyText: `🔍 未找到與「${keyword}」相關的分類。\n\n目前輸入該品項會預設歸類為其他，您可以在 Google Sheet 中新增此關鍵字！`,
    };
  }
};
