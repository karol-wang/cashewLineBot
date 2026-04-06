import * as LINE from '@line/bot-sdk';
import express, { Request, Response } from 'express';
import dotenv from 'dotenv';

dotenv.config();

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
  channelSecret: process.env.LINE_CHANNEL_SECRET || '',
};

// 建立 LINE SDK 客戶端
const client = LINE.LineBotClient.fromChannelAccessToken({
  channelAccessToken: config.channelAccessToken,
});

const app = express();

// Webhook 路由
app.post(
  '/webhook',
  LINE.middleware({ channelSecret: config.channelSecret }),
  (req: Request, res: Response) => {
    Promise.all(req.body.events.map(handleEvent))
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

interface Transaction {
  title?: string;
  category: string;
  subcategory: string;
  amount: number;
  note?: string;
  date?: string;
  account?: '我的錢錢' | '侯阿君';
}

/**
 * 從文字中解析出交易紀錄，並回傳交易的物件
 */
const parseTransaction = (text: string): Transaction => {
  // TODO: 增加備註 & 阿君 & 日期的解析
  const [description, amountStr] = text.split(/\s+/);
  const amount = parseInt(amountStr, 10);

  if (description.includes('阿君')) {
    const spentWords = ['花', '減', '吃', '喝', '扣'];
    const achunCategory = { spent: '阿君仔', recharge: '阿君抵加' };
    const regex = new RegExp(spentWords.join('|'));
    const category = regex.test(description)
      ? achunCategory.spent
      : achunCategory.recharge;

    return {
      account: '侯阿君',
      amount,
      category,
      subcategory: '',
    };
  }

  const categoryMap = {
    飲食: ['早餐', '午餐', '晚餐', '宵夜', '飲料', '甜點', '零食', '其他'],
    交通: ['捷運', '公車', '計程車', '油錢', '停車費', '其他'],
    購物: ['服飾', '美妝', '日用品', '其他'],
    娛樂: ['電影', '遊戲', '其他'],
    其他: ['其他'],
  };

  const [category] = Object.entries(categoryMap).find(([category, subCategory]) =>
    subCategory.includes(description)
  ) ?? [''];
  const subcategory = category ? description : '';

  return { category, subcategory, amount };
};

/**
 * 構造 Cashew Deep Link (URL Scheme)
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
const parseCashewLink = (transactions: Transaction[]) => {
  const cashewLink = new URL(`https://cashewapp.web.app/addTransaction`);
  cashewLink.searchParams.append('JSON', JSON.stringify({ transactions }));

  console.log('📝file: index.ts ~ line 99 ~ transactionsText:');
  console.dir(transactions);

  return cashewLink.href;
};

async function handleEvent(event: LINE.webhook.MessageEvent): Promise<any> {
  // 只處理文字訊息
  if (event.type !== 'message' || event.message.type !== 'text') {
    return Promise.resolve(null);
  }

  const userText = event.message.text.trim();
  // 解析格式：品項 金額 (例如: 雞肉飯 60)
  const transactionsText = userText.split(/\n/);

  try {
    const transactions = transactionsText.map(transactionText => {
      const transaction = parseTransaction(transactionText);

      // 驗證輸入內容
      if (!transaction.amount || isNaN(transaction.amount) || !transaction.category) {
        throw new Error('Invalid input');
      }

      return transaction;
    });

    const actionLink = parseCashewLink(transactions);
    const flexContent = transactions.map<LINE.messagingApi.FlexComponent>(
      ({ category, subcategory, amount }) => {
        return {
          type: 'text',
          text: `${category} - ${subcategory} $${amount}`,
          weight: 'bold',
          size: 'md',
          margin: 'md',
        };
      }
    );

    // 定義 Flex Message 內容
    const flexContainer: LINE.messagingApi.FlexContainer = {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: 'Cashew 記帳助手',
            weight: 'bold',
            color: '#1DB446',
            size: 'sm',
          },
          ...flexContent,
          {
            type: 'button',
            style: 'primary',
            color: '#1DB446',
            margin: 'xl',
            action: {
              type: 'uri',
              label: '確認並存入 Cashew',
              uri: actionLink,
            },
          },
        ],
      },
    };

    // 回傳 Flex Message
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
          text: '⚠️ 請輸入正確格式：「品項 金額」\n例如：咖啡 120',
        },
      ],
    });
  }
}

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🚀 TS Bot is running on http://localhost:${port}`);
});
