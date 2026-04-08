
# 💰 LINE Cashew Bookkeeper (TS Edition)

這是一個基於 **LINE Messaging API** 的自動化記帳助手。它能將使用者輸入的文字指令轉換為精美的 **Flex Message**，並透過 **App Link** 一鍵將資料新增至 [**Cashew** 記帳 App](https://cashewapp.web.app)。

---

## 🚀 核心功能

* **智能解析：** 支援 `日期(MMDD) 品項 金額:備註`及`首行輸入日期(MMDD)` 格式，自動解析為記帳資料。
* **動態 Flex Message：** 根據輸入自動生成確認卡片。
* **多筆交易支援：** 一次處理多筆待入帳項目(一行一筆)。
* **精準時區：** 強制採用 `Asia/Taipei` (GMT+8)，解決 Vercel Server 預設 UTC 的時區偏差。
* **安全編碼：** 自動處理 **雙重 URL 編碼 (Double Encoding)**，確保複雜 JSON 傳輸至 Web App 時不亂碼。

---

## 🛠 技術

* **Language:** TypeScript
* **Framework:** Express.js
* **Platform:** Vercel (Serverless Functions)
* **SDK:** `@line/bot-sdk`
* **Utility:** `dayjs` (Timezone/UTC), `URLSearchParams` (Encoding)

---

## 📋 環境變數設定 (`.env`)

在 Vercel 或本地開發時，請確保以下變數已設定：

```env
LINE_CHANNEL_ACCESS_TOKEN=你的_Channel_Access_Token
LINE_CHANNEL_SECRET=你的_Channel_Secret
CASHEW_WEB=https://budget-track.web.app
CASHEW_APP=https://cashewapp.web.app