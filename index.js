const line = require('@line/bot-sdk');
const express = require('express');

const config = {
  channelAccessToken: '你的_ACCESS_TOKEN',
  channelSecret: '你的_SECRET'
};

const client = new line.Client(config);
const app = express();

app.post('/webhook', line.middleware(config), (req, res) => {
  Promise.all(req.body.events.map(handleEvent))
    .then((result) => res.json(result))
    .catch((err) => {
      console.error(err);
      res.status(500).end();
    });
});

async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') return null;

  // 1. 解析訊息，假設格式為 "品項 金額" (例如：咖啡 120)
  const [note, amount] = event.message.text.split(' ');
  
  if (!amount || isNaN(amount)) {
    return client.replyMessage(event.replyToken, { type: 'text', text: '格式錯誤，請輸入「品項 金額」' });
  }

  // 2. 建構 Cashew Deep Link
  // 參數說明：amount (金額), note (備註), category (類別，需與 Cashew 內名稱一致)
  const cashewLink = `cashew://transactions/new?amount=${amount}&note=${encodeURIComponent(note)}`;

  // 3. 回傳 Flex Message
  const flexMsg = {
    type: "flex",
    altText: `確認記帳：${note} $${amount}`,
    contents: {
      "type": "bubble",
      "body": {
        "type": "box",
        "layout": "vertical",
        "contents": [
          { "type": "text", "text": "💰 快速記帳確認", "weight": "bold", "size": "xl", "color": "#1DB446" },
          { "type": "separator", "margin": "md" },
          {
            "type": "box",
            "layout": "vertical",
            "margin": "lg",
            "contents": [
              { "type": "text", "text": `品項：${note}`, "size": "md", "color": "#555555" },
              { "type": "text", "text": `金額：$${amount}`, "size": "xxl", "weight": "bold", "margin": "sm" }
            ]
          },
          {
            "type": "button",
            "action": {
              "type": "uri",
              "label": "點我存入 Cashew",
              "uri": cashewLink
            },
            "style": "primary",
            "color": "#1DB446",
            "margin": "xl"
          }
        ]
      }
    }
  };

  return client.replyMessage(event.replyToken, flexMsg);
}

app.listen(3000, () => console.log('Bot is running on port 3000'));