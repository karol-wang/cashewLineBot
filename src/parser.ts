import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import {
  achunCategory,
  creditCardReward,
  depositWords,
  findCreditCardRewardTitle,
  staticCategoryCatalog,
} from './maps';
import { CashewPlatform, CategoryCatalog, Transaction, TransactionDirection } from './types';

dayjs.extend(customParseFormat);

interface CategoryMatch {
  direction: TransactionDirection;
  category: string;
  keyword: string;
}

/** 從文字中尋找最佳分類 */
const findCategoryMatch = (
  description: string,
  categoryCatalog: CategoryCatalog = staticCategoryCatalog
): CategoryMatch | undefined => {
  const candidates: (CategoryMatch & { score: number })[] = [];

  for (const direction of ['expense', 'income'] as const) {
    for (const [category, keywords] of Object.entries(categoryCatalog[direction])) {
      for (const keyword of keywords) {
        let score = 0;
        if (description === keyword) {
          score = 3000 + keyword.length;
        } else if (description.includes(keyword)) {
          score = 2000 + keyword.length;
        } else if (keyword.includes(description)) {
          score = 1000 + description.length;
        }

        if (score > 0) {
          candidates.push({ direction, category, keyword, score });
        }
      }
    }
  }

  const bestMatch = candidates.sort((a, b) => b.score - a.score)[0];
  if (!bestMatch) return undefined;

  return {
    direction: bestMatch.direction,
    category: bestMatch.category,
    keyword: bestMatch.keyword,
  };
};

/**
 * 從文字中解析出交易紀錄，並回傳交易的物件
 * @description 日期(MMDD) 品項 金額:備註
 */
export const parseTransaction = (
  text: string,
  /** YYYY-MM-DD */
  globalDate?: string,
  currentCategoryCatalog: CategoryCatalog = staticCategoryCatalog
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
  const absoluteAmount = Math.abs(parseInt(amountStr, 10));

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

  const creditCardRewardTitle = findCreditCardRewardTitle(description);
  if (creditCardRewardTitle) {
    return {
      title: creditCardRewardTitle,
      account: creditCardReward.account,
      amount: absoluteAmount,
      category: creditCardReward.category,
      subcategory: creditCardReward.subcategory,
      date,
      note,
    };
  }

  if (description.includes('阿君')) {
    const regex = new RegExp(depositWords.join('|'));
    const isRecharge = regex.test(description);
    const category = isRecharge ? achunCategory.deposit : achunCategory.spent;

    return {
      account: '侯阿君',
      amount: isRecharge ? absoluteAmount : -absoluteAmount,
      category,
      subcategory: '',
      date,
      note,
    };
  }

  const categoryMatch = findCategoryMatch(description, currentCategoryCatalog);
  const category = categoryMatch?.category ?? '';
  const subcategory = categoryMatch ? description : '';
  const amount = categoryMatch?.direction === 'income' ? absoluteAmount : -absoluteAmount;

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
  categoryCatalog: CategoryCatalog = staticCategoryCatalog
): CategoryQueryResult => {
  const queryPrefixRegex = /^(?:查|查詢|分類|選單|類別|!cat|\/cat)(?:\s+(.*))?$/i;
  const queryMatch = userText.match(queryPrefixRegex);

  if (!queryMatch) {
    return { isQuery: false };
  }

  const keyword = queryMatch[1]?.trim();

  // 1. 若無輸入關鍵字 (如「查」、「分類」、「選單」)，列出所有主類別與子類別概覽
  if (!keyword) {
    const expenseCategories = Object.keys(categoryCatalog.expense);
    const incomeCategories = Object.keys(categoryCatalog.income);
    let replyText = `📋 目前系統支援的記帳分類：\n\n`;

    replyText += `💸 支出分類 (${expenseCategories.length} 種)\n`;
    for (const [cat, subCats] of Object.entries(categoryCatalog.expense)) {
      replyText += `📂 ${cat}：\n  ${subCats.join('、')}\n`;
    }

    replyText += `\n💰 收入分類 (${incomeCategories.length} 種)\n`;
    for (const [cat, subCats] of Object.entries(categoryCatalog.income)) {
      replyText += `📂 ${cat}：\n  ${subCats.join('、')}\n`;
    }

    replyText += `\n💡 提示：輸入「查 <品項/關鍵字>」可查詢特定分類。`;

    return { isQuery: true, replyText: replyText.trim() };
  }

  // 2. 進行模糊搜尋 (同時比對主類別名稱與子類別關鍵字)
  const searchKeyword = keyword.toLowerCase();
  const results: {
    category: string;
    subcategory?: string;
    direction: TransactionDirection;
    matchedType: 'category' | 'subcategory';
  }[] = [];

  for (const direction of ['expense', 'income'] as const) {
    for (const [cat, subCats] of Object.entries(categoryCatalog[direction])) {
      const catMatches =
        cat.toLowerCase().includes(searchKeyword) || searchKeyword.includes(cat.toLowerCase());
      const matchedSubs = subCats.filter(
        sub =>
          sub.toLowerCase().includes(searchKeyword) || searchKeyword.includes(sub.toLowerCase())
      );

      if (catMatches) {
        results.push({ category: cat, direction, matchedType: 'category' });
      } else if (matchedSubs.length > 0) {
        matchedSubs.forEach(sub => {
          results.push({
            category: cat,
            subcategory: sub,
            direction,
            matchedType: 'subcategory',
          });
        });
      }
    }
  }

  if (results.length > 0) {
    let replyText = `🔍 搜尋「${keyword}」找到的對應類別：\n\n`;

    results.forEach(item => {
      const directionLabel = item.direction === 'income' ? '💰 收入' : '💸 支出';
      if (item.matchedType === 'category') {
        const subCats = categoryCatalog[item.direction][item.category] || [];
        replyText += `${directionLabel}\n📂 主類別：${item.category}\n🏷️ 包含子類別：${subCats.join('、')}\n\n`;
      } else {
        const isCreditCardReward =
          item.category === creditCardReward.category &&
          item.subcategory === creditCardReward.subcategory;
        const titlesText = isCreditCardReward
          ? `💳 回饋卡別：${creditCardReward.titles.join('、')}\n`
          : '';
        replyText += `${directionLabel}\n📂 主類別：${item.category}\n🏷️ 子類別：${item.subcategory}\n${titlesText}\n`;
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
