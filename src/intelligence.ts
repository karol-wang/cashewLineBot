import { GoogleGenAI, Type } from '@google/genai';
import dayjs from 'dayjs';
import {
  achunCategory,
  creditCardReward,
  findCreditCardRewardTitle,
  staticCategoryCatalog,
} from './maps';
import { CategoryCatalog, Transaction, TransactionDirection } from './types';

/**
 * 使用 Gemini AI 進行自然語言語意解析（支援一句話包含單筆或多筆交易）
 * @param userText 使用者輸入的自然語言訊息
 * @param categoryCatalog 現有的收入／支出分類與子類別選單
 * @returns 解析出之 Transaction 陣列，若解析失敗或無金錢交易則傳回 null
 */
export const parseTransactionWithAI = async (
  userText: string,
  categoryCatalog: CategoryCatalog = staticCategoryCatalog
): Promise<Transaction[] | null> => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('⚠️ 未設定 GEMINI_API_KEY，跳過 AI 自然語言解析');
    return null;
  }

  const ai = new GoogleGenAI({ apiKey });
  const today = dayjs().format('YYYY-MM-DD');

  const systemInstruction = `
你是一個智能記帳助手。請分析使用者輸入的自然語言訊息，解析出一筆或多筆記帳交易紀錄。
今天日期是: ${today} (Asia/Taipei)。

現有的收入／支出分類與子類別對照表 (categoryCatalog) 如下：
${JSON.stringify(categoryCatalog, null, 2)}

規則與邏輯：
若文字中提及「阿君」或「侯阿君」則為特殊情況，以下以"#"標記。
1. 【多筆拆解】：
  - 若輸入包含多個消費/收入項目（例如：「昨天午餐吃便當100，下午茶手搖60，晚上搭計程車200」），請將每筆交易獨立拆解為陣列中的一個物件。
  - 若有「阿君平分」等等的意思，則將該項目的金額除2，並分兩筆記錄，第一筆為正常情況，第二筆為 #。
2. 【金額 amount】：expense 內的分類一律為負數；income 內的分類一律為正數。
3. 【分類 category & subcategory】：
  - # 時，「阿君加 100」、「阿君存 100」等增加金額的訊息，category = 「阿君抵加」、subcategory = 空字串、amount 必須為正數。
  - # 時，其他阿君支出訊息，category = 「阿君仔」、subcategory = 空字串、amount 必須為負數。
  - # 時，略過信用卡回饋清單及 categoryCatalog 的比對。
  - 若訊息提及信用卡回饋清單 ${JSON.stringify(creditCardReward.titles)} 中的卡名，固定設定 category = 「${creditCardReward.category}」、subcategory = 「${creditCardReward.subcategory}」、title = 清單內對應的標準卡名、amount 為正數、account = 「${creditCardReward.account}」。
  - 請比對 categoryCatalog，選擇最符合的主類別 (category) 與子類別 (subcategory)。
  - 若對照表中找不到完全吻合的子類別，請選取最合適的主類別 (category)，並將品項名稱作為 subcategory。
4. 【日期 date】：
  - 若提到「昨天」、「前天」、「上週三」等相對時間，請自動推算並輸出 YYYY-MM-DD 格式。
  - 若未提及日期，請預設為今天 (${today})。
5. 【帳戶 account】：
  - # account 請填寫 "侯阿君"。
  - 否則預設為 "我的錢錢"。
6. 【備註 note】：包含非分類名稱的額外資訊（如：店家名稱、發票號碼、備註原因）。
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: [
        {
          role: 'user',
          parts: [{ text: userText }],
        },
      ],
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              category: { type: Type.STRING },
              subcategory: { type: Type.STRING },
              amount: { type: Type.NUMBER },
              date: { type: Type.STRING },
              note: { type: Type.STRING },
              account: { type: Type.STRING, enum: ['我的錢錢', '侯阿君'] },
            },
            required: ['category', 'amount'],
          },
        },
      },
    });

    if (response.text) {
      const parsedList = JSON.parse(response.text) as Transaction[];
      if (Array.isArray(parsedList) && parsedList.length > 0) {
        const validTransactions = parsedList.flatMap(t => {
          if (!Number.isFinite(t.amount) || t.amount === 0 || !t.category) {
            return [];
          }

          const transactionRewardTitle =
            findCreditCardRewardTitle([t.title, t.subcategory, t.note].filter(Boolean).join(' ')) ??
            (parsedList.length === 1 ? findCreditCardRewardTitle(userText) : undefined);

          let direction: TransactionDirection | undefined;
          if (transactionRewardTitle) {
            direction = 'income';
          } else if (t.category === achunCategory.deposit) {
            direction = 'income';
          } else if (t.category === achunCategory.spent) {
            direction = 'expense';
          } else if (categoryCatalog.income[t.category]) {
            direction = 'income';
          } else if (categoryCatalog.expense[t.category]) {
            direction = 'expense';
          }

          if (!direction) return [];

          const isAchunCategory =
            t.category === achunCategory.deposit || t.category === achunCategory.spent;
          const isCreditCardReward = Boolean(transactionRewardTitle);
          const transaction: Transaction = {
            title: isCreditCardReward ? transactionRewardTitle : t.title,
            category: isCreditCardReward ? creditCardReward.category : t.category,
            subcategory: isCreditCardReward
              ? creditCardReward.subcategory
              : isAchunCategory
                ? ''
                : t.subcategory || '',
            amount: direction === 'income' ? Math.abs(t.amount) : -Math.abs(t.amount),
            date: t.date || today,
            note: t.note || '',
            account: isCreditCardReward
              ? creditCardReward.account
              : isAchunCategory
                ? '侯阿君'
                : t.account || '我的錢錢',
          };

          return [transaction];
        });

        if (validTransactions.length > 0) {
          return validTransactions;
        }
      }
    }
  } catch (error) {
    console.error('❌ Gemini AI 解析失敗:', error);
  }

  return null;
};

export default parseTransactionWithAI;
