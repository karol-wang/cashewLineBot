import dayjs from 'dayjs';

export const staticCategoryMap: Record<string, string[]> = {
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

export const categoryMap = staticCategoryMap;

export const achunCategory = { spent: '阿君仔', deposit: '阿君抵加' };

export const depositWords = ['存', '加', '進'];

let cachedCategoryMap: Record<string, string[]> | null = null;
let lastFetchTime = 0;
const CACHE_TTL_MIN = 5; // 5 分鐘快取

/**
 * 動態取得 CategoryMap（優先自 Google Sheets CSV 讀取，並提供記憶體快取與本地靜態備援）
 */
export const getCategoryMap = async (): Promise<Record<string, string[]>> => {
  const now = dayjs();
  const csvUrl = process.env.GOOGLE_SHEET_CSV_URL;

  // 若快取有效，直接返回快取內容 (0ms)
  if (cachedCategoryMap && now.diff(lastFetchTime, 'minute') < CACHE_TTL_MIN) {
    console.log(
      `📝file: maps.ts ~ getCategoryMap ~ 使用快取 (${dayjs(lastFetchTime).format('YYYY-MM-DD HH:mm:ss')})`
    );
    return cachedCategoryMap;
  }

  // 若未設定 GOOGLE_SHEET_CSV_URL，直接降級使用靜態 categoryMap
  if (!csvUrl) {
    console.log('📝file: maps.ts ~ getCategoryMap ~ 使用靜態 categoryMap');
    return staticCategoryMap;
  }

  try {
    console.log('📝file: maps.ts ~ getCategoryMap ~ 讀取 Google Sheet CSV');
    const res = await fetch(csvUrl);
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    const csvText = await res.text();
    const parsedMap = parseCsvToCategoryMap(csvText);

    if (Object.keys(parsedMap).length > 0) {
      cachedCategoryMap = parsedMap;
      lastFetchTime = now.valueOf();
      return parsedMap;
    }
  } catch (err) {
    console.error('⚠️ 讀取 Google Sheet CSV 失敗，降級使用本地 staticCategoryMap:', err);
  }

  return cachedCategoryMap || staticCategoryMap;
};

/**
 * 將 CSV 格式文字解析為 Record<Category, Subcategories[]>
 */
const parseCsvToCategoryMap = (csvText: string): Record<string, string[]> => {
  const lines = csvText
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);
  const result: Record<string, string[]> = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // 跳過標題列
    if (i === 0 && line.toLowerCase().includes('category')) continue;

    const parts = line.split(',').map(s => s.trim().replace(/^"(.*)"$/, '$1'));
    if (parts.length >= 2) {
      const category = parts[0];
      const subcategory = parts[1];

      if (category && subcategory) {
        if (!result[category]) {
          result[category] = [];
        }
        if (!result[category].includes(subcategory)) {
          result[category].push(subcategory);
        }
      }
    }
  }

  return result;
};
