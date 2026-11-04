# 十月初五 · 澳門立體歷史地圖

在原有歷史網站中加入可 360° 水平旋轉的澳門三維地形，保留街道地圖、兩組歷史時間軸、戰役示意、插圖及全景。

## 使用

- 拖曳地形旋轉；滾輪／雙指縮放；右鍵拖曳／雙指拖曳平移。
- 「360° 旋轉」開始／暫停環繞；「俯視」切換俯視；「總覽」復原鏡頭。
- 「隱藏地名」切換標籤；「街道地圖／立體澳門」切換模式。
- 點澳門半島、路環或十月初五標籤，進入相應歷史街區。
- 點時間軸自動進入原有街道地圖及事件介紹。
- 鍵盤聚焦三維畫布後：方向鍵旋轉／傾斜，+ / - 縮放，Home 回總覽。
- 沒有 WebGL 時會顯示提示，仍可切換街道地圖或閱讀時間軸。

## 執行與部署

此專案是完整靜態網站，沒有 npm 建置步驟，地形不需要 API key。

本機：`python -m http.server 8080`，再開啟 `http://localhost:8080`。
請經 HTTP 服務讀取，不要直接雙擊 HTML（ES modules / fetch 受瀏覽器限制）。

Render Static Site：連接本程式庫，分支 `main`，Publish Directory 設為 `.`；Build Command 留空（如介面要求則填 `echo static-site`）。原有 Render 服務若已開啟自動部署，提交到其綁定分支後會自動更新。部署成功後仍見舊版時，可強制重新整理。

## 程式結構

- `index.html`：原有歷史頁與模式切換整合。
- `terrain-view.js`：Three.js 場景、真實起伏網格、岩層側面、標籤、鏡頭、滑鼠／觸控／鍵盤互動。
- `terrain.css`：參考深色歷史地圖的畫面與手機排版。
- `terrain/macau.json`：預先產生的地形網格、海岸環、道路橋樑線。
- `terrain/surface.png`：根據土地覆蓋、道路資料生成的地表紋理。
- `terrain/land.geojson`：處理後陸地輪廓，座標為本專案的局部公里座標（並非 WGS84 GeoJSON）。
- `vendor/`：Three.js 0.169.0、OrbitControls 與 MIT 授權；瀏覽器不需外連下載這兩個模組。
- `scripts/build-terrain.py`：地形重建程式；原始下載快取忽略於 Git。
- `scripts/check-terrain.mjs`：檢查網格、法線、投影及模式整合。
- `media/`：原有歷史圖片與全景資源。

## 地理資料與限制

海岸、陸地覆蓋、道路與邊界來自 OpenStreetMap 經 OpenFreeMap / OpenMapTiles 向量瓦片，依 ODbL 授權。完整模型是展示用的當代澳門主要陸地範圍，包括半島、氹仔、路氹、路環及機場；小於約 8,000 平方米的碎片忽略。北部按 OSM 陸地邊界裁切，東側口岸島分界採簡化裁切。不是法定行政界圖，亦不是歷史岸線重建。

高程來自 AWS Terrain Tiles 的 Terrarium 瓦片（第 12 級，澳門約 35–40 米解析度）；採雙線性插值，負高程在陸地上歸零。DEM 與現代填海岸線的年代可能不同。預設垂直放大 4 倍以突出山丘。下方岩層厚度及顏色為視覺設計，不代表地質測量。橋樑為道路資料的示意線，沒有橋面工程高程。

來源：
- https://www.openstreetmap.org/copyright
- https://openfreemap.org/
- https://openmaptiles.org/
- https://registry.opendata.aws/terrain-tiles/
- https://github.com/tilezen/joerd/blob/master/docs/attribution.md

重建：Python 3，安裝 `numpy pillow scipy shapely mapbox-vector-tile`，以及 `curl`，然後執行 `python scripts/build-terrain.py`。建置會下載上游資料，執行網站本身不需要這些 Python 套件。可由 `scripts/.cache/tilejson.json` 查閱該次下載的資料版本。高程原始瓦片留在快取以便核對。

檢查：`node scripts/check-terrain.mjs`。本次環境沒有可用瀏覽器控制工具，因此未做實機瀏覽器／手機操作驗證；部署後建議在 Safari 與 Chrome 檢查觸控及 WebGL 效能。
