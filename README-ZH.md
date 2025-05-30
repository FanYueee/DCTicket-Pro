# DCTicket Pro

一個功能強大的 Discord 客服單機器人，採用模組化架構設計，整合 AI 智能支援與完整的管理功能。DCTicket Pro 為 Discord 伺服器提供專業的客戶支援功能，包含進階 AI 整合、WHMCS 支援以及靈活的配置選項。

## 🌟 主要功能

### 🎫 **進階客服單系統**
- **互動式面板**：精美的客服單創建面板，配有部門專屬按鈕
- **多部門支援**：技術支援、帳務問題、一般諮詢
- **智慧權限管理**：自動管理使用者與工作人員權限
- **訪客邀請功能**：客服單創建者和工作人員可邀請其他使用者協作
- **狀態追蹤**：開啟 → 等待工作人員 → 已關閉的工作流程
- **對話記錄系統**：自動封存對話並提供匯出功能

### 🤖 **AI 智能支援**
- **Google Gemini 整合**：使用尖端 AI 技術自動回應
- **多模態功能**：分析文字、圖片和文件
- **情境感知回應**：部門專屬的 AI 提示詞
- **智慧轉接**：從 AI 無縫轉接至真人支援
- **對話記憶**：在整個客服單中保持上下文

### 🕐 **服務時間管理**
- **營業時間**：定義營業時間並支援時區
- **假日系統**：配置一次性和週期性假日
- **智慧通知**：自動非營業時間訊息
- **彈性排程**：基於 Cron 的排程配置

### 💼 **WHMCS 整合**
- **服務顯示**：直接在客服單中顯示客戶服務
- **狀態分類**：啟用/停用服務分類
- **控制面板連結**：快速存取服務管理
- **Discord 帳號連結**：與 WHMCS 使用者無縫整合

### 📊 **管理功能**
- **基於角色的存取控制**：為每個部門配置工作人員角色
- **分類組織**：自動頻道分類
- **訊息封存**：完整的對話歷史記錄
- **工作人員提醒系統**：自動通知未回應的客服單
- **模組化架構**：根據需要啟用/停用功能

## 📋 系統需求

- Node.js 16.x 或更高版本
- Discord.js v14
- SQLite3
- Google Gemini API Key（AI 功能需要）
- WHMCS 實例與 API 存取權限（選用）

## 🚀 快速開始

### 1. 複製專案
```bash
git clone https://github.com/fanyueee/DCTicket-Pro.git
cd DCTicket-Pro
```

### 2. 安裝相依套件
```bash
npm install
```

### 3. 配置環境變數
在根目錄建立 `.env` 檔案：

```env
# Discord 設定
DISCORD_TOKEN=your-bot-token
CLIENT_ID=your-client-id
GUILD_ID=your-guild-id

# AI 整合（選用）
GEMINI_API_KEY=your-gemini-api-key

# WHMCS 整合（選用）
WHMCS_ENABLED=true
WHMCS_API_URL=https://your-whmcs.com/includes/api.php
WHMCS_API_IDENTIFIER=your-api-identifier
WHMCS_API_SECRET=your-api-secret
WHMCS_PANEL_URL=https://your-panel.com

# 時區
TIMEZONE=Asia/Taipei
```

### 4. 配置機器人
編輯 `src/core/config.js` 來自訂：
- 部門名稱和角色
- AI 提示詞和行為
- 服務時間和假日
- 功能開關

### 5. 部署指令
```bash
npm run deploy
```

### 6. 啟動機器人
```bash
npm start
```

開發模式（自動重啟）：
```bash
npm run dev
```

## 📁 專案結構

```
DCTicket/
├── src/
│   ├── core/               # 核心功能
│   │   ├── bot.js         # 主要機器人類別
│   │   ├── config.js      # 配置設定
│   │   ├── database.js    # 資料庫管理
│   │   └── logger.js      # 日誌系統
│   ├── modules/           # 功能模組
│   │   ├── ai/           # AI 整合
│   │   ├── service-hours/ # 營業時間
│   │   ├── ticket/       # 客服單系統
│   │   └── whmcs/        # WHMCS 整合
│   ├── utils/            # 實用工具函式
│   ├── index.js          # 進入點
│   └── deploy-commands.js # 指令部署
├── data/                 # SQLite 資料庫
├── logs/                 # 應用程式日誌
└── package.json
```

## 🛠️ 設定說明

### 基本設定
主要設定檔案為 `src/core/config.js`。重要設定包括：

```javascript
module.exports = {
  // 機器人設定
  botName: 'DCTicket Pro',
  timezone: 'Asia/Taipei',
  
  // 客服部門
  departments: {
    tech: { name: '技術支援', emoji: '🛠️' },
    billing: { name: '帳務問題', emoji: '💰' },
    general: { name: '一般諮詢', emoji: '📋' }
  },
  
  // 工作人員身分組 ID
  staffRoles: {
    tech: 'TECH_ROLE_ID',
    billing: 'BILLING_ROLE_ID',
    general: 'GENERAL_ROLE_ID'
  }
};
```

### AI 設定
在 `ai` 區段配置 AI 行為：

```javascript
ai: {
  enabled: true,
  model: 'gemini-2.0-flash',
  temperature: 0.7,
  maxOutputTokens: 1024
}
```

### 服務時間
設定營業時間和假日：

```javascript
serviceHours: {
  enabled: true,
  defaultSchedule: '0 9-18 * * 1-5', // 週一至週五 9AM-6PM
  timezone: 'Asia/Taipei'
}
```

## 📝 指令列表

### 客服單指令
- `/setup` - 在目前頻道建立客服單面板
- `/close` - 關閉目前的客服單
- `/invite [使用者]` - 邀請使用者查看並參與目前的客服單
- `/transfer [部門]` - 將客服單轉移至其他部門
- `/category create` - 建立部門分類
- `/role set` - 配置工作人員角色

### 提醒系統指令
- `/reminder enable` - 啟用客服單提醒通知
- `/reminder disable` - 停用客服單提醒通知
- `/reminder setrole [身分組]` - 設定接收提醒的身分組
- `/reminder settimeout [分鐘]` - 設定提醒等待時間（1-60 分鐘）
- `/reminder setmode [模式]` - 設定提醒模式（once/continuous/limited）
- `/reminder setinterval [秒數]` - 設定重複提醒間隔（30-600 秒）
- `/reminder setmaxcount [次數]` - 設定最大提醒次數（1-10 次）
- `/reminder preference [接收]` - 設定個人提醒偏好
- `/reminder setstaff [使用者] [接收]` - 管理員：設定工作人員提醒偏好
- `/reminder status` - 檢視目前提醒設定
- `/reminder debug` - 管理員：調試提醒功能

### AI 指令
- `/aiprompt view [部門]` - 檢視目前 AI 提示詞
- `/aiprompt edit [部門]` - 編輯部門提示詞
- `/aiprompt savetofile [部門]` - 儲存提示詞至檔案
- `/aiprompt loadfromfile [部門]` - 從檔案載入提示詞
- `/analyze` - 分析客服單對話
- `AI 分析` - 右鍵點擊訊息進行 AI 分析（支援文字、圖片、檔案）

### 服務指令
- `/services [使用者]` - 顯示使用者的 WHMCS 服務
- `/hours view` - 檢視目前服務時間
- `/hours set` - 配置服務時間
- `/hours holiday` - 管理假日

## 🔧 模組系統

DCTicket 使用模組化架構。每個模組都可以獨立啟用/停用：

### 啟用/停用模組
在 `config.js` 中設定模組狀態：

```javascript
ai: { enabled: true },
whmcs: { enabled: false },
serviceHours: { enabled: true }
```

### 建立自訂模組
模組遵循標準結構：
```
module-name/
├── index.js       # 模組進入點
├── service.js     # 業務邏輯
├── repository.js  # 資料存取
├── commands/      # 斜線指令
└── README.md      # 文件
```

## 🌐 AI 提示詞管理

### 檔案型提示詞
將複雜的提示詞儲存在檔案中：
```
src/modules/ai/prompts/
├── default.txt
├── general/prompt.txt
├── billing/prompt.txt
└── tech/prompt.txt
```

### 提示詞優先順序
1. 檔案系統提示詞
2. 資料庫提示詞
3. 設定檔預設值

### 使用方法
1. **查看提示詞**：`/aiprompt view [部門]`
2. **編輯提示詞**：`/aiprompt edit [部門]`
3. **儲存至檔案**：`/aiprompt savetofile [部門]`
4. **從檔案載入**：`/aiprompt loadfromfile [部門]`

## 🔒 安全性

- API 金鑰儲存在環境變數中
- 所有指令都有權限檢查
- 安全的客服單存取控制
- 不記錄敏感資料
- 自動清理暫存檔案

## 📊 日誌系統

日誌按模組組織：
```
logs/
├── combined.log     # 所有日誌
├── error.log       # 僅錯誤日誌
├── ai/            # AI 模組日誌
└── whmcs/         # WHMCS 模組日誌
```

## 🚀 進階功能

### 多模態 AI 分析
- 支援文字訊息分析
- 圖片內容識別與分析
- 程式碼檔案審查
- 文件內容理解

### 智慧對話管理
- 自動保存對話上下文
- 部門轉移時保留歷史
- AI 與真人對話無縫銜接
- 避免重複回應機制

### 訪客邀請系統
- **權限控制**：僅客服單創建者和工作人員可邀請他人
- **受限權限**：被邀請者只能查看和發送訊息，無法關閉客服單
- **防止連鎖邀請**：被邀請者無法再邀請其他人
- **自動通知**：邀請時在頻道顯示通知並發送私訊
- **權限清理**：客服單關閉時自動移除所有被邀請者的權限

### 工作人員提醒系統
- **自動監控**：持續檢查未回應的客服單
- **三種提醒模式**：單次提醒、持續提醒、限制次數提醒
- **營業時間整合**：僅在營業時間和非假日期間發送提醒
- **個人偏好設定**：工作人員可自行選擇是否接收提醒
- **身分組管理**：自動管理提醒身分組的新增/移除
- **即時追蹤**：從客服單轉接人工時開始計時

### 假日管理系統
- 一次性假日設定
- 週期性假日（如每週日）
- 自訂假日訊息
- 假日期間 AI 行為調整

## 🤝 貢獻指南

1. Fork 此專案
2. 建立功能分支
3. 提交您的變更
4. 推送到分支
5. 開啟 Pull Request

## 📄 授權條款

此專案採用 MIT 授權條款 - 詳見 LICENSE 檔案。

## 📞 支援

如有問題或功能請求，請使用 [GitHub Issues](https://github.com/fanyueee/DCTicket-Pro/issues) 頁面。

## 💡 使用提示

### 初次設定
1. 確保所有必要的角色 ID 都已正確配置
2. 建議先在測試伺服器上試用
3. 仔細閱讀各模組的 README 文件

### 最佳實踐
- 定期備份資料庫檔案（`data/` 目錄）
- 監控日誌檔案以排除問題
- 根據實際需求調整 AI 溫度參數
- 為不同部門設定專屬的提示詞

### 故障排除
- 檢查 `logs/error.log` 查看錯誤訊息
- 確認所有環境變數都已正確設定
- 驗證機器人權限是否足夠
- 使用 `/analyze` 指令診斷 AI 行為
- 使用 `/reminder debug` 檢查提醒系統狀態
- 確認提醒身分組已正確設定且存在

### 提醒系統使用指南
1. **初次設定**：先使用 `/reminder setrole` 設定提醒身分組
2. **啟用功能**：使用 `/reminder enable` 啟用提醒系統
3. **調整參數**：根據需要設定提醒時間和模式
4. **工作人員管理**：讓工作人員使用 `/reminder preference` 設定個人偏好
5. **監控運作**：使用 `/reminder status` 檢查設定狀態

### 提醒模式說明
- **once（單次）**：每個客服單只提醒一次，適合一般使用
- **continuous（持續）**：持續提醒直到工作人員回應，適合高優先級支援
- **limited（限制）**：限制提醒次數，平衡提醒效果與訊息干擾

---

用 ❤️ 為 Discord 社群打造