# YOUNGER 100天結案報告產生器 V2

顧問用的 100 天計劃結案報告工具。左側填寫（中文欄位）、右側即時預覽，可產出中／英文網頁版報告連結、PNG、PDF。

> ⚠️ 這是全新專案，**與舊站完全獨立**。請另外建立一個新的 Netlify 站連到本 repo，不要覆蓋原本的 `younger-100day-plan-finial` 站與舊 repo。

## 功能
- **Email 帶入**：輸入客戶 email，自動帶入 Google Sheet 的 D0/D30/D60/D90 分數（缺漏以 0 計）
- **AI 智慧分析**：可選 Claude / Gemini，語氣可選溫暖／專業，語言可選中／英
- **圖表**：數據改善趨勢（與自己 D0 基準比）、行動力雷達（D0 vs D90）
- **推薦方案**：從 Google Sheet 多選商品（圖＋標題），報告以膠囊樣式呈現
- **輸出**：產生客戶專屬報告連結（一鍵複製）＋ PNG ＋ PDF
- **雙語**：報告可切換中／英；客戶端連結頁也能切換

## 架構
- 前端：靜態 HTML / CSS / JS + Chart.js（無建置步驟）
- 後端：Netlify Functions
  - `analyze` — AI 代理（金鑰只放伺服器端環境變數）
  - `save-report` / `get-report` — 報告存取（Netlify Blobs）
- 資料：沿用既有 Google Sheet（透過 GAS `doGet` 查詢、商品表 CSV）

## 環境變數（在 Netlify 後台設定）
| 變數 | 用途 |
|------|------|
| `CLAUDE_API_KEY` | Claude 分析 |
| `GEMINI_API_KEY` | Gemini 分析 |

> 🔒 安全：金鑰**只**放 Netlify 環境變數，前端不含任何金鑰。建議把先前外洩、寫死在舊站的 Gemini 金鑰停用重建。

## 設定值（如需更換，改 `assets/app.js` 最上方）
- `GAS_URL`：表單 / 查詢用的 Google Apps Script 網址
- `PRODUCTS_CSV`：推薦商品 Google Sheet 的 CSV export 網址
- 會員中心連結 `ACCOUNT_URL` 在 `assets/report.js`

## 部署
1. 在 Netlify「Add new site → Import from Git」選這個 repo（**新站，勿覆蓋舊站**）
2. Build command 留空；Publish directory = `.`
3. 設定上面兩個環境變數
4. Netlify Blobs 免額外設定，部署後即可用

## 本機開發
```bash
npm install
npm run dev   # netlify dev：同時起靜態頁與 functions
```
（純看畫面可直接開 `index.html`，但 AI 與產生連結需要 functions，請用 `netlify dev`。）
