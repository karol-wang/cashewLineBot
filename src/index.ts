import * as LINE from '@line/bot-sdk';
import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import timezone from 'dayjs/plugin/timezone';
import { achunCategory, categoryMap, rechargeWords } from './maps';
import { Transaction } from './types';
import { createFlexMessage } from './helper';

dayjs.extend(customParseFormat);
dayjs.extend(timezone);
dayjs.tz.setDefault('Asia/Taipei');

dotenv.config();

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
  channelSecret: process.env.LINE_CHANNEL_SECRET || '',
};

// 建立 LINE SDK 客戶端
const client = LINE.LineBotClient.fromChannelAccessToken({
  channelAccessToken: config.channelAccessToken,
});

const CashewPlatform = {
  webApp: process.env.CASHEW_WEB,
  app: process.env.CASHEW_APP,
} as const;

const REDIRECT_URL = '/redirect';

const app = express();

// Webhook 路由
app.post(
  '/webhook',
  LINE.middleware({ channelSecret: config.channelSecret }),
  (req: Request, res: Response) => {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    Promise.all(
      req.body.events.map((event: LINE.webhook.MessageEvent) => handleEvent(event, baseUrl))
    )
      .then(result => res.json(result))
      .catch(err => {
        if (err instanceof LINE.HTTPFetchError) {
          console.error('LINE Error Details:', JSON.stringify(err.body, null, 2));
        } else {
          console.error('Unknown Error:', err);
        }
        res.status(500).end();
      });
  }
);

app.get(REDIRECT_URL, (req, res) => {
  const { JSON } = req.query;
  if (!JSON) {
    return res.status(404).send('Missing JSON parameter');
  }

  const userAgent = req.headers['user-agent'] || '';

  // 判斷是否為行動裝置
  const isMobile = /Android|iPhone|iPad|iPod/i.test(userAgent);
  let targetUrl: URL;
  if (isMobile) {
    // 手機版：導向 Cashew App 的 Deep Link
    targetUrl = new URL(`${CashewPlatform.app}/addTransaction`);
    targetUrl.searchParams.append('JSON', JSON as string);
  } else {
    // 電腦版：導向 Cashew Web App
    targetUrl = new URL(`${CashewPlatform.webApp}/addTransaction`);
    targetUrl.searchParams.append('JSON', encodeURIComponent(JSON as string)); // 電腦版本需要再 encode 一次才能正常解析
  }
  return res.redirect(targetUrl.href);
});

/**
 * 從文字中解析出交易紀錄，並回傳交易的物件
 * @description 日期(MMDD) 品項 金額:備註
 */
const parseTransaction = (text: string, globalDate?: string): Transaction => {
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
    const regex = new RegExp(rechargeWords.join('|'));
    const isRecharge = regex.test(description);
    const category = isRecharge ? achunCategory.recharge : achunCategory.spent;

    return {
      account: '侯阿君',
      amount: isRecharge ? -amount : amount,
      category,
      subcategory: '',
      date,
      note,
    };
  }

  const [category] = Object.entries(categoryMap).find(([category, subCategory]) =>
    subCategory.includes(description)
  ) ?? [''];
  const subcategory = category ? description : '';

  return { category, subcategory, amount, date, note };
};

/**
 * 構造 Cashew App Link (依平台導向 Web App 或 App)
 * @param text
 * @example
 *  {
 *    "transactions": [
 *      {
 *        "amount": "-100",
 *        "notes": "This is a note",
 *        "category": "Shopping"
 *      },
 *      {
 *        "amount": "-150",
 *        "notes": "This is a note 2"
 *      }
 *    ]
 *  }
 */
const parseCashewLink = (transactions: Transaction[], baseUrl: string) => {
  const redirectUrl = new URL(`${baseUrl}${REDIRECT_URL}`);
  redirectUrl.searchParams.append('JSON', JSON.stringify({ transactions }));

  console.log('📝file: index.ts ~ parseCashewLink ~ transactionsText:');
  console.dir(transactions);

  return redirectUrl.href;
};

async function handleEvent(event: LINE.webhook.MessageEvent, baseUrl: string): Promise<any> {
  // 只處理文字訊息
  if (event.type !== 'message' || event.message.type !== 'text') {
    return Promise.resolve(null);
  }

  const userText = event.message.text.trim();
  const transactionsText = userText
    .split(/\n/)
    .map(t => t.trim())
    .filter(Boolean);

  let globalDate: string | undefined;
  if (transactionsText.length > 0) {
    // 判斷第一行是否為日期
    const dMatch = transactionsText[0].match(/^((?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01]))$/);
    if (dMatch) {
      const d = dayjs(dMatch[1], ['MMDD'], true);
      if (d.isValid()) {
        globalDate = d.format('YYYY-MM-DD');
        transactionsText.shift();
      }
    }
  }

  try {
    if (transactionsText.length === 0) {
      throw new Error('No transactions');
    }

    const transactions = transactionsText.map(transactionText => {
      const transaction = parseTransaction(transactionText, globalDate);

      // 驗證輸入內容
      if (!transaction.amount || isNaN(transaction.amount) || !transaction.category) {
        throw new Error('Invalid input');
      }

      return transaction;
    });

    const actionLink = parseCashewLink(transactions, baseUrl);

    // 定義 Flex Message 內容
    const flexContainer = createFlexMessage(transactions, actionLink);

    return client.replyMessage({
      replyToken: event.replyToken as string,
      messages: [
        {
          type: 'flex',
          altText: `記帳確認：${transactionsText.join(', ')}`,
          contents: flexContainer,
        },
      ],
    });
  } catch (err) {
    return client.replyMessage({
      replyToken: event.replyToken as string,
      messages: [
        {
          type: 'text',
          text: '⚠️ 請輸入正確格式：\n「日期(MMDD) 品項 金額:備註」\n\n或是將日期寫在第一行：\n0408\n咖啡 120:備註\n晚餐 99',
        },
      ],
    });
  }
}

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🚀 TS Bot is running on http://localhost:${port}`);
});
