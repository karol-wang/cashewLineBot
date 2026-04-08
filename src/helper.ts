import { messagingApi } from '@line/bot-sdk';
import { CashewPlatform, Transaction } from './types';

type FlexComponent = messagingApi.FlexComponent;
type FlexContainer = messagingApi.FlexContainer;

/**
 * 構造 Flex Message 內容 (每一筆交易顯示的樣子)
 * @param transactions 交易紀錄
 * @param platformLinks 導向 Cashew App Link 物件
 */
export const createFlexMessage = (
  transactions: Transaction[],
  platformLinks: CashewPlatform
): FlexContainer => {
  const transactionsByDate = transactions.reduce(
    (acc, transaction) => {
      const { date = 'today', category, subcategory, amount, note } = transaction;
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push({ category, subcategory, amount, note });
      return acc;
    },
    {} as Record<string, Transaction[]>
  );

  const flexContent = Object.entries(transactionsByDate).map(
    ([date, transactions]): FlexComponent => {
      // 內容
      const contents = transactions.map<FlexComponent>(
        ({ category, subcategory, amount, note }) => {
          const catStr = [category, subcategory].filter(Boolean).join(' - ');
          const con: FlexComponent[] = [
            {
              type: 'text',
              text: `${catStr}  $${Math.abs(amount)}`,
              wrap: true,
              color: '#666666',
              size: 'sm',
            },
          ];
          if (note)
            con.push({
              type: 'text',
              text: note,
              color: '#AAAAAA',
              flex: 1,
              size: 'xs',
            });

          return {
            type: 'box',
            layout: 'baseline',
            spacing: 'sm',
            contents: con,
          };
        }
      );

      // 依日期排列的內容
      return {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'text',
                text: date,
                weight: 'bold',
              },
            ],
            paddingTop: 'xl',
            paddingBottom: 'md',
          },
          {
            type: 'separator',
          },
          {
            type: 'box',
            layout: 'vertical',
            margin: 'lg',
            spacing: 'sm',
            contents,
          },
        ],
      };
    }
  );

  // 組合結果
  return {
    type: 'bubble',
    size: 'mega',
    header: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: 'Cashew 記帳助手',
          weight: 'bold',
          color: '#1DB446',
          size: 'md',
        },
      ],
      paddingBottom: 'md',
    },
    body: {
      type: 'box',
      layout: 'vertical',
      contents: flexContent,
      paddingTop: 'none',
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'button',
          style: 'primary',
          color: '#1DB446',
          margin: 'xl',
          action: {
            type: 'uri',
            label: '確認並存入 Cashew',
            uri: platformLinks.app,
            altUri: {
              desktop: platformLinks.webApp,
            },
          },
        },
      ],
    },
  };
};
