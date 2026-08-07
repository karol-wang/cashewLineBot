import { type CategoryCatalog, type CategoryMap, type TransactionDirection } from './types';
import datetime from './datetime';

export const staticExpenseCategoryMap: CategoryMap = {
  飲食: [
    '早餐',
    '午餐',
    '晚餐',
    '宵夜',
    '飲料',
    '豆漿&牛奶',
    '咖啡(豆)',
    '吃吃喝喝的',
    '食材',
    '水果',
    '保健食品',
    '飲料（多人）',
    '冰',
    '麵包',
    '點心',
    '餐費 (多人)',
  ],
  交通: ['火車', '高鐵', '捷運', '公車/客運', '計程車', '飛機'],
  購物: ['運動D'],
  娛樂: ['電影', '遊戲'],
  車車: ['油錢', '停車費', '維修保養'],
  居家生活: ['房租', '電費', '瓦斯費', '水費', '生活用品', '網路費', '洗衣'],
  穿的: ['鞋子', '衣褲', '包包', '外套'],
  趴趴造: ['旅行遊玩', '租車', '住宿'],
  哩哩摳摳: ['雜支'],
  理容: ['剪髮', '頭皮護理'],
  運動: ['活動', '游泳', '運動場地'],
  '3C': ['手機配件', '電信網路', '手機', '電腦商品'],
  其他: ['其他'],
};

export const staticIncomeCategoryMap: CategoryMap = {
  錢錢來啦: ['獎金', '存款息', '公司薪資', '信用卡回饋'],
};

export const staticCategoryCatalog: CategoryCatalog = {
  expense: staticExpenseCategoryMap,
  income: staticIncomeCategoryMap,
};

export const achunCategory = { spent: '阿君仔', deposit: '阿君抵加' };

export const depositWords = ['存', '加', '進'];

export const creditCardReward = {
  category: '錢錢來啦',
  subcategory: '信用卡回饋',
  account: '我的錢錢',
  titles: ['Unicard', 'Ubear', '大戶', 'Richart', 'eco永續卡', 'Cube', '熊本熊', 'iLeo'],
} as const;

/** 從訊息中找出信用卡回饋名稱，回傳清單內的標準名稱。 */
export const findCreditCardRewardTitle = (description: string): string | undefined => {
  const normalizedDescription = description.toLowerCase();
  return creditCardReward.titles.find(title => title.toLowerCase().includes(normalizedDescription));
};

let cachedCategoryCatalog: CategoryCatalog | null = null;
let lastFetchTime = 0;
const CACHE_TTL_MIN = 5; // 5 分鐘快取

/**
 * 動態取得 CategoryCatalog（優先自 Google Sheets CSV 讀取，並提供記憶體快取與本地靜態備援）
 */
export const getCategoryCatalog = async (): Promise<CategoryCatalog> => {
  const now = datetime();
  const csvUrl = process.env.GOOGLE_SHEET_CSV_URL;

  // 若快取有效，直接返回快取內容 (0ms)
  if (cachedCategoryCatalog && now.diff(lastFetchTime, 'minute') < CACHE_TTL_MIN) {
    console.log(
      `📝file: maps.ts ~ getCategoryCatalog ~ 使用快取 (${datetime(lastFetchTime).format('YYYY-MM-DD HH:mm:ss')})`
    );
    return cachedCategoryCatalog;
  }

  // 若未設定 GOOGLE_SHEET_CSV_URL，直接降級使用靜態 categoryMap
  if (!csvUrl) {
    console.log('📝file: maps.ts ~ getCategoryCatalog ~ 使用靜態 category catalog');
    return staticCategoryCatalog;
  }

  try {
    console.log('📝file: maps.ts ~ getCategoryCatalog ~ 讀取 Google Sheet CSV');
    const res = await fetch(csvUrl);
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    const csvText = await res.text();
    const parsedCatalog = parseCsvToCategoryCatalog(csvText);
    const categoryCatalog: CategoryCatalog = {
      expense:
        Object.keys(parsedCatalog.expense).length > 0
          ? parsedCatalog.expense
          : staticExpenseCategoryMap,
      income:
        Object.keys(parsedCatalog.income).length > 0
          ? parsedCatalog.income
          : staticIncomeCategoryMap,
    };

    if (
      Object.keys(parsedCatalog.expense).length > 0 ||
      Object.keys(parsedCatalog.income).length > 0
    ) {
      cachedCategoryCatalog = categoryCatalog;
      lastFetchTime = now.valueOf();
      return categoryCatalog;
    }
  } catch (err) {
    console.error('⚠️ 讀取 Google Sheet CSV 失敗，降級使用本地 staticCategoryMap:', err);
  }

  return cachedCategoryCatalog || staticCategoryCatalog;
};

/**
 * 將 CSV 格式文字解析為 CategoryCatalog。
 * 新格式：type,category,subcategory；舊的兩欄格式預設為 expense。
 */
export const parseCsvToCategoryCatalog = (csvText: string): CategoryCatalog => {
  const lines = csvText
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);
  const result: CategoryCatalog = { expense: {}, income: {} };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // 跳過標題列
    if (i === 0 && line.toLowerCase().includes('category')) continue;

    const parts = line.split(',').map(s => s.trim().replace(/^"(.*)"$/, '$1'));
    if (parts.length >= 2) {
      const hasDirection = parts[0] === 'expense' || parts[0] === 'income';
      const direction: TransactionDirection = hasDirection
        ? (parts[0] as TransactionDirection)
        : 'expense';
      const category = hasDirection ? parts[1] : parts[0];
      const subcategory = hasDirection ? parts[2] : parts[1];

      if (category && subcategory) {
        if (!result[direction][category]) {
          result[direction][category] = [];
        }
        if (!result[direction][category].includes(subcategory)) {
          result[direction][category].push(subcategory);
        }
      }
    }
  }

  return result;
};
