/**
 * アプリケーションのメインクラス
 */

import { Renderer } from './renderer.js';
import { solarPosition, planetPositions } from '../utils/planets.js';
import { moonPosition } from '../utils/moon.js';
import { Controls } from '../ui/controls.js';
import { Interaction } from '../ui/interaction.js';

export class App {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.renderer = null;
    this.controls = null;
    this.interaction = null;

    // 観測パラメータ
    this.date = new Date();
    this.lat = 35.6762;  // 東京
    this.lon = 139.6503;

    // データ
    this.stars = [];
    this.constellationLines = null;
    this.constellationNames = null;
    this.milkyWay = null;
    this.messier = null;
  }

  async init() {
    this.canvas = document.getElementById('starChart');
    this.ctx = this.canvas.getContext('2d');
    this.renderer = new Renderer(this.canvas, this.ctx);

    // UI Controls (観測地をLocalStorageから復元するため、先にnew)
    this.controls = new Controls(this);

    // タッチ/マウス操作
    this.interaction = new Interaction(this);
    this.interaction.attach();
    this.renderer.interaction = this.interaction;

    this.resize();
    window.addEventListener('resize', () => {
      this.resize();
      this.render();
    });

    await this.loadData();

    // UIを構築
    this.controls.build();
    this.controls.startDisplayUpdate();

    this.render();

    // 1分ごとに自動更新（アニメーション中でなければ）
    setInterval(() => {
      if (!this.controls.animationTimer) {
        this.date = new Date();
        this.render();
        this.controls._updateDisplay();
      }
    }, 60000);
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  async loadData() {
    const [stars, lines, names, mw, messier] = await Promise.all([
      fetch('/data/stars.json').then(r => r.json()),
      fetch('/data/constellations.lines.json').then(r => r.json()),
      fetch('/data/constellations.names.json').then(r => r.json()),
      fetch('/data/mw.json').then(r => r.json()),
      fetch('/data/messier.json').then(r => r.json()),
    ]);

    this.stars = stars;
    this.constellationLines = lines;
    this.constellationNames = names;
    this.milkyWay = mw;
    this.messier = messier;
  }

  render() {
    const { date, lat, lon } = this;
    const layers = this.controls ? this.controls.layers : {};

    // 太陽系天体の位置計算
    const sun = solarPosition(date);
    const planets = planetPositions(date);
    const moon = moonPosition(date);

    this.renderer.clear();

    // 描画順序: 天の川 → 星座線 → 恒星 → メシエ → 惑星 → 月 → 太陽 → 星座名 → 地平線
    if (this.milkyWay && layers.milkyWay !== false) {
      this.renderer.drawMilkyWay(this.milkyWay, date, lat, lon);
    }
    if (this.constellationLines && layers.constellationLines !== false) {
      this.renderer.drawConstellationLines(this.constellationLines, date, lat, lon);
    }
    this.renderer.drawStars(this.stars, date, lat, lon);
    if (layers.starLabels !== false) {
      this.renderer.drawStarLabels(this.stars, date, lat, lon);
    }
    if (this.messier && layers.messier !== false) {
      this.renderer.drawMessier(this.messier, date, lat, lon);
    }
    if (layers.planets !== false) {
      this.renderer.drawPlanets(planets, date, lat, lon);
    }
    if (layers.moon !== false) {
      this.renderer.drawMoon(moon, date, lat, lon);
    }
    if (layers.sun !== false) {
      this.renderer.drawSun(sun, date, lat, lon);
    }
    if (this.constellationNames && this.constellationLines && layers.constellationNames !== false) {
      this.renderer.drawConstellationNames(this.constellationNames, this.constellationLines, date, lat, lon);
    }
    this.renderer.drawHorizon();
  }
}
