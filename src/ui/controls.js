/**
 * UI コントロール
 * 時刻制御、レイヤー表示切替、観測地設定
 */

/**
 * メイン都市リスト
 */
const CITIES = [
  { name: '東京', lat: 35.6762, lon: 139.6503 },
  { name: '大阪', lat: 34.6937, lon: 135.5023 },
  { name: '札幌', lat: 43.0618, lon: 141.3545 },
  { name: '那覇', lat: 26.2124, lon: 127.6809 },
  { name: '福岡', lat: 33.5904, lon: 130.4017 },
  { name: '仙台', lat: 38.2682, lon: 140.8694 },
  { name: '名古屋', lat: 35.1815, lon: 136.9066 },
];

/**
 * レイヤー定義
 */
const LAYERS = [
  { id: 'constellationLines', label: '星座線', default: true },
  { id: 'constellationNames', label: '星座名', default: true },
  { id: 'milkyWay', label: '天の川', default: true },
  { id: 'planets', label: '惑星', default: true },
  { id: 'moon', label: '月', default: true },
  { id: 'sun', label: '太陽', default: true },
  { id: 'messier', label: 'メシエ天体', default: true },
  { id: 'starLabels', label: '恒星名', default: true },
];

export class Controls {
  /**
   * @param {import('../core/app.js').App} app
   */
  constructor(app) {
    this.app = app;
    this.animationTimer = null;
    this.animationSpeed = 60; // 分/フレーム
    this.layers = {};

    // レイヤーの初期状態
    for (const layer of LAYERS) {
      this.layers[layer.id] = layer.default;
    }

    // LocalStorage から観測地復元
    this._restoreLocation();
  }

  /**
   * UIを構築して #ui-overlay に追加
   */
  build() {
    const overlay = document.getElementById('ui-overlay');
    overlay.innerHTML = '';

    overlay.appendChild(this._buildHeader());
    overlay.appendChild(this._buildSidePanel());
    overlay.appendChild(this._buildBottomPanel());
  }

  _buildHeader() {
    const header = document.createElement('div');
    header.id = 'header';
    header.innerHTML = `
      <div class="header-left">
        <span class="app-title">★ 星座早見盤</span>
      </div>
      <div class="header-center">
        <span id="datetime-display"></span>
        <span id="location-display"></span>
      </div>
      <div class="header-right">
        <button id="btn-night-mode" title="夜間モード">🔴</button>
      </div>
    `;

    header.querySelector('#btn-night-mode').addEventListener('click', () => {
      document.body.classList.toggle('night-mode');
    });

    return header;
  }

  _buildSidePanel() {
    const panel = document.createElement('div');
    panel.id = 'side-panel';
    panel.classList.add('collapsed');

    // トグルボタン
    const toggle = document.createElement('button');
    toggle.id = 'side-panel-toggle';
    toggle.textContent = '⚙';
    toggle.title = '設定';
    toggle.addEventListener('click', () => {
      panel.classList.toggle('collapsed');
    });
    panel.appendChild(toggle);

    const content = document.createElement('div');
    content.className = 'side-panel-content';

    // レイヤー切替
    const layerSection = document.createElement('div');
    layerSection.className = 'panel-section';
    layerSection.innerHTML = '<h3>レイヤー</h3>';

    for (const layer of LAYERS) {
      const label = document.createElement('label');
      label.className = 'toggle-label';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = this.layers[layer.id];
      checkbox.addEventListener('change', () => {
        this.layers[layer.id] = checkbox.checked;
        this.app.render();
      });
      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(` ${layer.label}`));
      layerSection.appendChild(label);
    }
    content.appendChild(layerSection);

    // 観測地設定
    const locationSection = document.createElement('div');
    locationSection.className = 'panel-section';
    locationSection.innerHTML = '<h3>観測地</h3>';

    const citySelect = document.createElement('select');
    citySelect.id = 'city-select';
    const customOption = document.createElement('option');
    customOption.value = 'custom';
    customOption.textContent = 'カスタム';
    citySelect.appendChild(customOption);

    for (const city of CITIES) {
      const opt = document.createElement('option');
      opt.value = JSON.stringify({ lat: city.lat, lon: city.lon });
      opt.textContent = city.name;
      if (Math.abs(this.app.lat - city.lat) < 0.1 && Math.abs(this.app.lon - city.lon) < 0.1) {
        opt.selected = true;
      }
      citySelect.appendChild(opt);
    }

    citySelect.addEventListener('change', () => {
      if (citySelect.value !== 'custom') {
        const { lat, lon } = JSON.parse(citySelect.value);
        this.app.lat = lat;
        this.app.lon = lon;
        this._saveLocation();
        this._updateDisplay();
        this.app.render();
      }
    });
    locationSection.appendChild(citySelect);

    // GPS ボタン
    const gpsBtn = document.createElement('button');
    gpsBtn.textContent = '📍 GPS取得';
    gpsBtn.className = 'btn';
    gpsBtn.addEventListener('click', () => this._getGPSLocation());
    locationSection.appendChild(gpsBtn);

    // 手動入力
    const manualDiv = document.createElement('div');
    manualDiv.className = 'manual-location';
    manualDiv.innerHTML = `
      <label>緯度: <input type="number" id="input-lat" step="0.01" value="${this.app.lat.toFixed(4)}"></label>
      <label>経度: <input type="number" id="input-lon" step="0.01" value="${this.app.lon.toFixed(4)}"></label>
      <button class="btn" id="btn-set-location">設定</button>
    `;
    locationSection.appendChild(manualDiv);

    content.appendChild(locationSection);
    panel.appendChild(content);

    // 手動入力イベント (build後にセットアップ)
    setTimeout(() => {
      const btn = document.getElementById('btn-set-location');
      if (btn) {
        btn.addEventListener('click', () => {
          const lat = parseFloat(document.getElementById('input-lat').value);
          const lon = parseFloat(document.getElementById('input-lon').value);
          if (!isNaN(lat) && !isNaN(lon)) {
            this.app.lat = lat;
            this.app.lon = lon;
            this._saveLocation();
            this._updateDisplay();
            this.app.render();
          }
        });
      }
    }, 0);

    return panel;
  }

  _buildBottomPanel() {
    const panel = document.createElement('div');
    panel.id = 'bottom-panel';

    // 時刻スライダー (-2年 〜 +2年)
    const now = new Date();
    const minDate = new Date(now);
    minDate.setFullYear(now.getFullYear() - 2);
    const maxDate = new Date(now);
    maxDate.setFullYear(now.getFullYear() + 2);

    panel.innerHTML = `
      <div class="time-controls">
        <button id="btn-rewind" title="巻き戻し">⏪</button>
        <button id="btn-play" title="再生/停止">▶</button>
        <button id="btn-forward" title="早送り">⏩</button>
        <button id="btn-now" title="現在時刻">📌 今</button>
        <input type="range" id="time-slider"
          min="${minDate.getTime()}"
          max="${maxDate.getTime()}"
          value="${this.app.date.getTime()}"
          step="60000">
        <input type="datetime-local" id="datetime-input"
          value="${this._toLocalDateTimeString(this.app.date)}">
        <div class="speed-control">
          <label>速度:</label>
          <select id="speed-select">
            <option value="1">1分/f</option>
            <option value="10">10分/f</option>
            <option value="60" selected>1時間/f</option>
            <option value="1440">1日/f</option>
            <option value="10080">1週間/f</option>
          </select>
        </div>
      </div>
    `;

    // イベントリスナー
    setTimeout(() => {
      const slider = document.getElementById('time-slider');
      const datetimeInput = document.getElementById('datetime-input');

      slider.addEventListener('input', () => {
        this.app.date = new Date(parseInt(slider.value));
        datetimeInput.value = this._toLocalDateTimeString(this.app.date);
        this._updateDisplay();
        this.app.render();
      });

      datetimeInput.addEventListener('change', () => {
        this.app.date = new Date(datetimeInput.value);
        slider.value = this.app.date.getTime();
        this._updateDisplay();
        this.app.render();
      });

      document.getElementById('btn-now').addEventListener('click', () => {
        this.app.date = new Date();
        slider.value = this.app.date.getTime();
        datetimeInput.value = this._toLocalDateTimeString(this.app.date);
        this._updateDisplay();
        this.app.render();
      });

      document.getElementById('btn-play').addEventListener('click', () => {
        this._toggleAnimation();
      });

      document.getElementById('btn-forward').addEventListener('click', () => {
        this.animationSpeed = Math.abs(this.animationSpeed);
        if (!this.animationTimer) this._toggleAnimation();
      });

      document.getElementById('btn-rewind').addEventListener('click', () => {
        this.animationSpeed = -Math.abs(this.animationSpeed);
        if (!this.animationTimer) this._toggleAnimation();
      });

      document.getElementById('speed-select').addEventListener('change', (e) => {
        const sign = this.animationSpeed < 0 ? -1 : 1;
        this.animationSpeed = sign * parseInt(e.target.value);
      });
    }, 0);

    return panel;
  }

  /**
   * 日時表示を更新
   */
  _updateDisplay() {
    const dtDisplay = document.getElementById('datetime-display');
    const locDisplay = document.getElementById('location-display');
    if (dtDisplay) {
      dtDisplay.textContent = this.app.date.toLocaleString('ja-JP', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit',
        timeZone: 'Asia/Tokyo',
      });
    }
    if (locDisplay) {
      // 都市名を探す
      const city = CITIES.find(c =>
        Math.abs(this.app.lat - c.lat) < 0.1 && Math.abs(this.app.lon - c.lon) < 0.1
      );
      locDisplay.textContent = city
        ? city.name
        : `${this.app.lat.toFixed(2)}°N ${this.app.lon.toFixed(2)}°E`;
    }
  }

  _toggleAnimation() {
    const btn = document.getElementById('btn-play');
    if (this.animationTimer) {
      clearInterval(this.animationTimer);
      this.animationTimer = null;
      if (btn) btn.textContent = '▶';
    } else {
      if (btn) btn.textContent = '⏸';
      this.animationTimer = setInterval(() => {
        this.app.date = new Date(this.app.date.getTime() + this.animationSpeed * 60000);
        const slider = document.getElementById('time-slider');
        const datetimeInput = document.getElementById('datetime-input');
        if (slider) slider.value = this.app.date.getTime();
        if (datetimeInput) datetimeInput.value = this._toLocalDateTimeString(this.app.date);
        this._updateDisplay();
        this.app.render();
      }, 50);
    }
  }

  _toLocalDateTimeString(date) {
    const offset = date.getTimezoneOffset();
    const local = new Date(date.getTime() - offset * 60000);
    return local.toISOString().slice(0, 16);
  }

  _getGPSLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.app.lat = pos.coords.latitude;
        this.app.lon = pos.coords.longitude;
        this._saveLocation();
        this._updateDisplay();
        this.app.render();

        const latInput = document.getElementById('input-lat');
        const lonInput = document.getElementById('input-lon');
        if (latInput) latInput.value = this.app.lat.toFixed(4);
        if (lonInput) lonInput.value = this.app.lon.toFixed(4);

        const citySelect = document.getElementById('city-select');
        if (citySelect) citySelect.value = 'custom';
      },
      (err) => {
        console.warn('Geolocation error:', err.message);
      }
    );
  }

  _saveLocation() {
    try {
      localStorage.setItem('starChart_lat', this.app.lat.toString());
      localStorage.setItem('starChart_lon', this.app.lon.toString());
    } catch (e) { /* ignore */ }
  }

  _restoreLocation() {
    try {
      const lat = localStorage.getItem('starChart_lat');
      const lon = localStorage.getItem('starChart_lon');
      if (lat && lon) {
        this.app.lat = parseFloat(lat);
        this.app.lon = parseFloat(lon);
      }
    } catch (e) { /* ignore */ }
  }

  startDisplayUpdate() {
    this._updateDisplay();
    setInterval(() => this._updateDisplay(), 10000);
  }
}
