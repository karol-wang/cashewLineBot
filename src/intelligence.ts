import { GoogleGenAI, Type } from '@google/genai';
import dayjs from 'dayjs';
import { staticCategoryMap } from './maps';
import { Transaction } from './types';

/**
 * 使用 Gemini AI 進行自然語言語意解析（支援一句話包含單筆或多筆交易）
 * @param userText 使用者輸入的自然語言訊息
 * @param categoryMap 現有的分類與子類別選單
 * @returns 解析出之 Transaction 陣列，若解析失敗或無金錢交易則傳回 null
 */
export const parseTransactionWithAI = async (
  userText: string,
  categoryMap: Record<string, string[]> = staticCategoryMap
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

現有的分類與子類別對照表 (categoryMap) 如下：
${JSON.stringify(categoryMap, null, 2)}

規則與邏輯：
若文字中提及「阿君」或「侯阿君」則為特殊情況，以下以"#"標記。
1. 【多筆拆解】：若輸入包含多個消費/收入項目（例如：「昨天午餐吃便當100，下午茶手搖60，晚上搭計程車200」），請將每筆交易獨立拆解為陣列中的一個物件
，若有「阿君平分」等等的意思，則將該項目的金額除2，並分兩筆記錄，第一筆為正常情況，第二筆為 #。
2. 【金額 amount】：支出請記錄為負數（例如：-250, -80）；收入、儲值、退款或領錢請記錄為正數（例如：1000）。
3. 【分類 category & subcategory】：
   - # 時，金額為負時，category = 「阿君仔」；金額為正時，category = 「阿君抵加」，sub皆為空。
   - 請比對對照表，選擇最符合的主類別 (category) 與子類別 (subcategory)。
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
        const validTransactions = parsedList
          .filter(t => t.amount && !isNaN(t.amount) && t.category)
          .map(t => ({
            category: t.category,
            subcategory: t.subcategory || '',
            amount: t.amount,
            date: t.date || today,
            note: t.note || '',
            account: t.account || '我的錢錢',
          }));

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
