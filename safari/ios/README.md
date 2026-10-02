# iPad Safari / TestFlight

已建立獨立 iPad App 與 Safari Web Extension，保留原有 macOS 專案。

- 專案：`NYCU E3 Helper iOS/NYCU E3 Helper iOS.xcodeproj`
- Scheme：`NYCU E3 Helper iOS`
- 裝置：iPad；最低 iPadOS 26.0
- App Bundle ID：`com.yoyo1112.nycu-e3-helper`
- Extension Bundle ID：`com.yoyo1112.nycu-e3-helper.Extension`
- Team：`5XHJTS2WUD`（沿用 Mac 版設定）
- 版本：3.0.0；Build：1

App 提供啟用說明、E3 入口與隱私說明；側欄沿用共用 JavaScript，新增手指拖曳入口與調整寬度、取消手勢處理、觸控按鈕高度與窄視窗限制。iPad manifest 沒有 `nativeMessaging`、`notifications` 或 `downloads` 權限；系統通知關閉，側欄通知保留。Safari 的分頁登入 session 轉送沿用 Mac 版實作。

## 上傳 TestFlight

1. 登入 [App Store Connect](https://appstoreconnect.apple.com/)，使用這個 Team 的帳號。
2. 若已建立相同 Bundle ID 的 macOS App，為該 App 新增 iOS 平台；若沒有相同 App 紀錄，建立 iOS App，名稱 `NYCU E3 Helper`、主要語言繁體中文、Bundle ID `com.yoyo1112.nycu-e3-helper`、SKU 可填 `nycu-e3-helper-ios`。先確認帳號內該 SKU 可用。
3. 用 Xcode 開啟 `../build/ipad/NYCU E3 Helper.xcarchive`，在 Organizer 選 **Distribute App → App Store Connect → Upload**。也可用 Apple Transporter 上傳 `../build/ipad/export/NYCU E3 Helper iOS.ipa`。
4. 等 Apple 處理完成，到 App 的 TestFlight 分頁選擇 iOS Build `2.2.0 (1)`，依頁面要求完成出口合規等資訊，再加入內部測試群組。
5. 在 iPad 安裝 TestFlight，接受邀請並安裝。外部測試另需填寫測試資訊與 Beta App Review；E3 功能需要獲授權的測試帳號。

上傳到 App Store Connect 不代表 App Store 正式上架。Safari 擴充功能可以透過 TestFlight 測試，見 [Apple 發行說明](https://developer.apple.com/documentation/safariservices/distributing-your-safari-web-extension)。

## 在 iPad 啟用

1. 開啟 E3 Helper App 查看啟用說明。
2. 設定 → App → Safari → 延伸功能，啟用 NYCU E3 Helper。
3. 允許存取 `e3p.nycu.edu.tw`、`e3.nycu.edu.tw`。
4. 用 Safari 登入 E3，重新整理，點右側 E3 Helper → 同步。
5. 翻譯與 AI 摘要需另允許 Google Translate 與 OpenAI 的網站存取；摘要需自行提供 API Key。

請保持已登入的 E3 分頁開啟。iPad 版沒有系統推播；Safari 關閉或進入背景時無法保證同步與提醒時間。單檔由 Safari 開啟或下載；大型 ZIP 請分批處理。

## 重複建置

從儲存庫根目錄執行：

```sh
# 同版本第二次上傳用 Build 2；不要重複使用 Apple 已接受的 Build。
BUILD_NUMBER=2 bash scripts/archive-ipad.sh
```

腳本同步 macOS 與 iPad 共用資源、以目前 Apple Developer 帳號自動簽署 Archive，再匯出 App Store Connect IPA。預設輸出 `safari/build/ipad/`，可用第一個參數指定其他路徑。編譯與簽署使用暫存目錄，避免 Desktop／iCloud 的 Finder metadata 造成 codesign 失敗；成功後保留 Archive 與 IPA。此腳本只匯出，不上傳。

如需更換 Team 或 Bundle ID，請同時更改兩個 target 與 `ExportOptions.plist`。iPad 專案採 XML property list 儲存，Xcode 可直接開啟；版本同步腳本同時支援 Mac 專案的 OpenStep 格式與這個 XML 格式。

## 驗證與目前狀態

- iPad 真機 SDK Release 建置、Apple 開發簽署 Archive、App Store Connect 發行 IPA 匯出通過。
- 匯出 IPA 包含 App、Safari Extension 與兩份原生 privacy manifest；版本／Build 一致、Bundle ID 前綴正確、1024px 圖示沒有 alpha 通道。
- 共用 JS 單元測試通過；包含 iPad 不啟用桌面通知及封裝資源一致性。
- Chromium UI 測試包含六分頁、語言／設定、觸控點擊、寬度與入口拖曳、取消手勢、窄視窗。這些測試不等於 iPad Safari 實機驗證。
- 尚未完成 iPad Safari 實機登入／同步、下載、翻譯、摘要與背景恢復測試。
- 2026-10-02 01:24（台北時間）已上傳 `2.2.0 (1)`，Apple 回報 `UPLOAD SUCCEEDED with no errors` 並進入處理。App 紀錄已建立，名稱 NYCU E3 Helper、主要語言繁體中文。處理完成與測試群組指派尚未在 App Store Connect 網頁驗證，也尚未取得邀請連結。

Privacy manifest 描述原生 App／Extension 的 API 使用；App Store Connect 的 App Privacy 問項仍須依完整 JavaScript 資料流填寫。翻譯和摘要會傳送內容給第三方。App Store 正式送審前仍需公開隱私政策、截圖與審查帳號／展示方式，見 `../APP_STORE.md`。
