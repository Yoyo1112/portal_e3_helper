# macOS Safari 版

iPad Safari 與 TestFlight 專案請見 [iPad 指南](ios/README.md)。

已建立 macOS App + Safari Web Extension 的 Xcode 專案，最低支援 macOS 14。Web Extension 版本與原始 manifest 同步，目前為 2.2.0。

## 開啟與簽署

1. 開啟 `NYCU E3 Helper/NYCU E3 Helper.xcodeproj`。
2. 在 Xcode → Settings → Accounts 登入已加入 Apple Developer Program 的 Apple 帳號。
3. 選專案的兩個 Targets：`NYCU E3 Helper` 與 `NYCU E3 Helper Extension`。
4. 在兩個 target 的 Signing & Capabilities 勾選 Automatically manage signing，Team 選自己的開發者帳號。
5. 預設 Bundle ID：App 為 `com.yoyo1112.nycu-e3-helper`，Extension 為 `com.yoyo1112.nycu-e3-helper.Extension`。如果該 ID 已被占用，換成自己的唯一 ID；Extension 必須以 App ID 為前綴，並同步修改 `ViewController.swift` 的 `extensionBundleIdentifier`。
6. Scheme 選 `NYCU E3 Helper`，目的地選 My Mac，按 Run。
7. 在 App 點「開啟 Safari 延伸功能設定」，啟用擴充功能並允許網站存取。登入 E3 後點右側入口測試。

若開發簽署的版本無法啟用，可在 Safari 的開發者設定允許未簽署的延伸功能。正式 App Store 版本使用發行簽署，不需要此設定。

## Safari 功能差異

- 側欄、作業、課程、公告、翻譯與摘要沿用共同程式碼。
- Safari 的桌面通知透過 `nativeMessaging` 與 Swift `UserNotifications` 原生橋接。儲存啟用設定或點「測試通知」會要求 macOS 通知授權；拒絕後請在「系統設定 → 通知 → NYCU E3 Helper」允許。只有取得系統授權才會送出通知，側欄通知保留。
- 分開下載使用原始檔案連結，由 Safari 下載或開啟預覽。跨來源的 `download` 檔名可能不生效；實際檔名以伺服器／Safari 為準。
- ZIP 保留網頁下載流程；請在 E3 頁面操作，需要有效登入，大型檔案可能占用較多記憶體。
- Safari 作業／課程同步透過同來源的 E3 分頁發送請求，沿用該分頁登入狀態；需保持已登入的 E3 分頁開啟。未開啟分頁或網路失敗會顯示同步錯誤，不會誤報登入過期。背景 alarm 與同步依 Safari 執行／休眠狀態而定，無法保證準時通知。
- Safari manifest 移除不支援的 `downloads`、`notifications`、`open_in_tab` 與目前未使用的 localhost 網站權限。

## 更新共同程式碼

從儲存庫根目錄執行：

```sh
python3 scripts/sync-safari.py
node --test tests/notifications.test.cjs tests/i18n.test.cjs tests/safari.test.cjs tests/safari-session.test.cjs
```

同步腳本會覆寫 Extension/Resources 的共用檔案並同步 App 與 Extension 的版本號。請修改根目錄的 JS，不要只改複製後的 Safari JS。不要以 converter 重新覆寫整個 Xcode 專案，以免失去 App 引導介面與 target 設定。

可在不提供 Team 的情況驗證編譯：

```sh
xcodebuild -project 'safari/NYCU E3 Helper/NYCU E3 Helper.xcodeproj' \
  -scheme 'NYCU E3 Helper' -configuration Release \
  -derivedDataPath /tmp/e3-helper-safari-build CODE_SIGNING_ALLOWED=NO build
```

這個產物沒有發行簽署，不能直接送 App Store。

## 驗證結果

- macOS Release 未簽署建置：通過。
- JS 通知、原生通知橋接、i18n、Safari 下載、登入 session 轉送與資源同步測試：25 個通過。
- 通知設定頁 UI：Chrome 與 Safari API 缺少通知的模擬環境皆通過；此測試使用 Chromium，不代表 Safari 實機驗證。
- Apple Developer 開發簽署與 Xcode Run：通過。
- Safari 網站權限：已限制兩個 E3 網址，其他網站拒絕。
- Safari 已登入帳號的作業與課程同步：通過；修正背景請求未沿用頁面 session 所造成的錯誤登入提示。
- 尚未驗證檔案下載、Google Translate 與 OpenAI；非 E3 服務在目前權限設定下被拒絕。
- 尚未進行 App Store Validate 或上傳。

上架流程與待完成項目見 `APP_STORE.md`。

原生通知新版已通過 Debug 開發簽署建置。Safari 實機已確認通知開關可用，「測試通知」經原生橋接取得授權並成功送出 macOS 排程請求。通知橫幅與點擊行為尚未完成實機確認；macOS 勿擾模式或通知樣式可能影響彈窗顯示。
