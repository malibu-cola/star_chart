# 星座早見盤 - Star Chart Web Application

ブラウザ上で動作する星座早見盤Webアプリケーションです。外部サーバーに依存せず、完全な静的サイトとして動作します。

**https://malibu-cola.github.io/star_chart/**

## 機能

- **恒星描画** - HYGカタログより約9,000星を等級・スペクトル型に応じた色とサイズで表示
- **星座線・星座名** - IAU公認88星座の線と日本語名を表示
- **天の川** - 天の川の濃淡を帯状ポリゴンで描画
- **惑星** - 水星〜海王星の位置をケプラー軌道計算で表示
- **月** - 月の位置と満ち欠けをリアルタイム描画
- **太陽** - 太陽の位置を表示
- **メシエ天体** - 110天体を種別（星雲・星団・銀河）ごとに異なるアイコンで表示
- **時刻制御** - スライダー・日時入力・アニメーション再生で過去2年〜未来2年の星空を表示
- **観測地設定** - GPS自動取得、主要都市選択、手動入力に対応（LocalStorage保存）
- **操作** - マウスドラッグ/スワイプで回転、ホイール/ピンチでズーム
- **レイヤー切替** - 各要素の表示/非表示を個別に切替
- **夜間モード** - 赤色LEDモードで星空観察時の目の慣れを維持

## 使い方

### オンライン

上記URLにアクセスするだけで利用できます。

### ローカル開発

```bash
npm install
npm run dev      # 開発サーバー起動
npm run build    # 本番ビルド (dist/)
npm run preview  # ビルド結果のプレビュー
```

## 技術構成

- **描画**: Canvas 2D API
- **投影**: ステレオグラフ投影（天頂中心）
- **天文計算**: Jean Meeus「Astronomical Algorithms」準拠（完全ブラウザ内計算）
- **ビルド**: Vite
- **ホスティング**: GitHub Pages

## データソース・ライセンス

| データ | ソース | ライセンス |
|---|---|---|
| 恒星カタログ | [HYG Database](https://github.com/astronexus/HYG-Database) - David Nash | CC BY-SA 4.0 |
| 星座線・星座名・メシエ天体・天の川 | [d3-celestial](https://github.com/ofrohn/d3-celestial) - Olaf Frohn | BSD-2-Clause |
| 星座境界 | Based on IAU constellation boundaries | - |
| 惑星軌道計算 | Based on Jean Meeus, *Astronomical Algorithms* (2nd ed.) | - |

## ライセンス

MIT License
