import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { achunCategory, depositWords } from './maps';
import { CashewPlatform, Transaction } from './types';

dayjs.extend(customParseFormat);

/**
 * 從文字中解析出交易紀錄，並回傳交易的物件
 * @description 日期(MMDD) 品項 金額:備註
 */
export const parseTransaction = (
  text: string,
  globalDate?: string,
  currentCategoryMap: Record<string, string[]> = {}
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

  let date: string | undefined;
  if (dateStr) {
    const d = dayjs(dateStr, ['MMDD'], true);
    date = d.isValid() ? d.format('YYYY-MM-DD') : undefined;
  }

  if (!date && globalDate) {
    date = globalDate;
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
