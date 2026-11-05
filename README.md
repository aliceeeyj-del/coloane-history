# 十月初五 · 澳門歷史地景

此程式庫是 [coloane-history.onrender.com](https://coloane-history.onrender.com) 的完整靜態網站。`main` 分支的根目錄是 Render Static Site 的 Publish Directory（`.`）；沒有 npm 建置步驟。網站保留原有兩組歷史時間軸、全部 18 則文字、地標、插圖、照片來源、路環戰役四幕、2D 地圖與全景。

## 瀏覽

- 3D 地形涵蓋澳門半島、氹仔、路氹與路環。拖曳旋轉、滾輪／雙指縮放；可重置、俯視或自動環視。
- 點時間軸會平滑移向相應光圈。已知建築顯示展覽用意象模型；其他史料點使用抽象基座，均不作歷史建築復原解讀。
- 資料面板可切換原有插圖與近年照片。近年照片附拍攝者、年份、授權及 Wikimedia Commons 原圖連結；周邊街景會清楚標明並非事件現場的歷史影像。
- 戰役方向、彈道、聲光及 360° 場景只作展示示意。2D 歷史地圖仍可切換使用。

## 本機與部署

在程式庫根目錄執行 `python3 -m http.server 8080`，以 `http://localhost:8080` 開啟。請使用 HTTP 服務，因瀏覽器會透過 ES modules 和 `fetch` 載入地形與照片資料。

Render Static Site 設定：分支 `main`、Publish Directory `.`、Build Command 留空（若介面要求命令，可填 `echo static-site`）。將更新推送到綁定分支後，已啟用自動部署的 Render 服務會更新原網址。

## 資料與限制

地表、道路及海岸資料來自 OpenStreetMap / OpenFreeMap；高程來自 AWS Terrain Tiles。地形是現代地理背景，垂直起伏在展示中放大 2.6 倍，並非歷史時期的岸線、精確測繪模型或地質剖面。資料來源與授權連結可在網頁底部和「資料與地形說明」中查閱。

原有歷史插圖保存在 `media/`；新增的可選靜音動態展示在 `media/motion/`，並非歷史影片。近年照片保存在 `media/modern/`，`manifest.json` 列出每張圖的原始檔案頁、拍攝者、年份和授權。網站只按已知位置呈現地標；附近街景及示意模型不代表歷史事件精確現場。

Three.js 與 OrbitControls 保存在 `vendor/`，授權見 `vendor/THREE-LICENSE.txt`。
