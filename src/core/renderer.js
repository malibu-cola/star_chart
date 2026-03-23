/**
 * Canvas 描画エンジン
 * 星空の描画を管理する
 */

import {
  equatorialToHorizontal,
  horizontalToStereo,
  bvToColor,
  magToRadius,
  magToAlpha,
  HOURS_TO_DEG,
} from '../utils/astronomy.js';
import { drawMoonPhase } from '../utils/moon.js';

export class Renderer {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {CanvasRenderingContext2D} ctx
   */
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    /** @type {import('../ui/interaction.js').Interaction|null} */
    this.interaction = null;
  }

  /** 画面幅 (CSS px) */
  get width() { return this.canvas.width / (window.devicePixelRatio || 1); }
  get height() { return this.canvas.height / (window.devicePixelRatio || 1); }

  /** 投影の中心と半径（ズーム適用済み） */
  get projParams() {
    const size = Math.min(this.width, this.height);
    const zoom = this.interaction ? this.interaction.zoom : 1;
    return {
      cx: this.width / 2,
      cy: this.height / 2,
      radius: size * 0.45 * zoom,
    };
  }

  /** 画面クリア */
  clear() {
    const ctx = this.ctx;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.restore();
  }

  /**
   * 赤道座標を画面座標に変換
   * @param {number} raHours - 赤経 [時]
   * @param {number} decDeg  - 赤緯 [度]
   * @returns {{ sx, sy, alt, az } | null} 地平線以下なら null
   */
  project(raHours, decDeg, date, latDeg, lonDeg) {
    const { alt, az } = equatorialToHorizontal(raHours, decDeg, date, latDeg, lonDeg);
    if (alt < 0) return null;

    // ドラッグ回転オフセットを適用
    const rotAz = this.interaction ? this.interaction.rotationAz : 0;
    const { x, y } = horizontalToStereo(alt, az + rotAz);
    const { cx, cy, radius } = this.projParams;
    return {
      sx: cx + x * radius,
      sy: cy + y * radius,
      alt,
      az,
    };
  }

  /**
   * d3-celestial座標 (RA度, Dec度) を画面座標に変換
   * d3-celestialはRAを度数 (-180〜180) で格納している
   */
  projectCelestial(raDeg, decDeg, date, latDeg, lonDeg) {
    const raHours = raDeg / HOURS_TO_DEG; // 度→時
    return this.project(raHours, decDeg, date, latDeg, lonDeg);
  }

  /**
   * 地平線の円を描画
   */
  drawHorizon() {
    const ctx = this.ctx;
    const { cx, cy, radius } = this.projParams;

    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(50, 80, 50, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // ドラッグ回転オフセットを方位ラベルにも適用
    const rotAz = this.interaction ? this.interaction.rotationAz * (Math.PI / 180) : 0;

    const labels = [
      { text: '北 N', angle: Math.PI },
      { text: '東 E', angle: Math.PI / 2 },
      { text: '南 S', angle: 0 },
      { text: '西 W', angle: -Math.PI / 2 },
    ];

    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(100, 180, 100, 0.8)';

    for (const label of labels) {
      const a = label.angle - rotAz;
      const lx = cx + (radius + 18) * Math.sin(a);
      const ly = cy - (radius + 18) * Math.cos(a);
      ctx.fillText(label.text, lx, ly);
    }
  }

  /**
   * 恒星を描画
   */
  drawStars(stars, date, latDeg, lonDeg) {
    const ctx = this.ctx;

    for (const star of stars) {
      if (star.proper === 'Sol') continue;

      const pos = this.project(star.ra, star.dec, date, latDeg, lonDeg);
      if (!pos) continue;

      const r = magToRadius(star.mag);
      const alpha = magToAlpha(star.mag);
      const color = bvToColor(star.bv);

      // グロー効果 (明るい星のみ)
      if (star.mag <= 2) {
        ctx.beginPath();
        ctx.arc(pos.sx, pos.sy, r * 3, 0, Math.PI * 2);
        ctx.fillStyle = color.replace('rgb', 'rgba').replace(')', `,${alpha * 0.15})`);
        ctx.fill();
      }

      // 星本体
      ctx.beginPath();
      ctx.arc(pos.sx, pos.sy, r, 0, Math.PI * 2);
      ctx.fillStyle = color.replace('rgb', 'rgba').replace(')', `,${alpha})`);
      ctx.fill();
    }
  }

  /**
   * 主要恒星名を描画 (等級2以下)
   */
  drawStarLabels(stars, date, latDeg, lonDeg) {
    const ctx = this.ctx;
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = 'rgba(200, 200, 200, 0.7)';

    for (const star of stars) {
      if (!star.proper || star.proper === 'Sol' || star.mag > 2) continue;

      const pos = this.project(star.ra, star.dec, date, latDeg, lonDeg);
      if (!pos) continue;

      const r = magToRadius(star.mag);
      ctx.fillText(star.proper, pos.sx + r + 3, pos.sy - 2);
    }
  }

  /**
   * 星座線を描画
   * @param {object} constellationLines - GeoJSON FeatureCollection (d3-celestial形式)
   */
  drawConstellationLines(constellationLines, date, latDeg, lonDeg) {
    const ctx = this.ctx;
    ctx.strokeStyle = 'rgba(80, 120, 180, 0.4)';
    ctx.lineWidth = 1;

    for (const feature of constellationLines.features) {
      const lines = feature.geometry.coordinates;
      for (const line of lines) {
        ctx.beginPath();
        let started = false;
        for (const point of line) {
          const pos = this.projectCelestial(point[0], point[1], date, latDeg, lonDeg);
          if (!pos) {
            started = false;
            continue;
          }
          if (!started) {
            ctx.moveTo(pos.sx, pos.sy);
            started = true;
          } else {
            ctx.lineTo(pos.sx, pos.sy);
          }
        }
        ctx.stroke();
      }
    }
  }

  /**
   * 星座名（日本語）を描画
   * @param {object} constellationNames - GeoJSON FeatureCollection
   * @param {object} constellationLines - 星座線データ（中心座標計算用）
   */
  drawConstellationNames(constellationNames, constellationLines, date, latDeg, lonDeg) {
    const ctx = this.ctx;
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(100, 150, 220, 0.6)';

    // 星座線データから各星座の中心座標を計算
    const centers = {};
    for (const feature of constellationLines.features) {
      let sumRa = 0, sumDec = 0, count = 0;
      for (const line of feature.geometry.coordinates) {
        for (const point of line) {
          sumRa += point[0];
          sumDec += point[1];
          count++;
        }
      }
      if (count > 0) {
        centers[feature.id] = { ra: sumRa / count, dec: sumDec / count };
      }
    }

    // 名前データとマッチングして描画
    for (const feature of constellationNames.features) {
      const id = feature.id;
      const jaName = feature.properties.ja;
      if (!jaName || !centers[id]) continue;

      const center = centers[id];
      const pos = this.projectCelestial(center.ra, center.dec, date, latDeg, lonDeg);
      if (!pos) continue;

      ctx.fillText(jaName, pos.sx, pos.sy);
    }
  }

  /**
   * 天の川を描画
   * @param {object} milkyWay - GeoJSON FeatureCollection (MultiPolygon)
   */
  drawMilkyWay(milkyWay, date, latDeg, lonDeg) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(150, 180, 220, 0.04)';
    ctx.strokeStyle = 'rgba(150, 180, 220, 0.02)';
    ctx.lineWidth = 0.5;

    for (const feature of milkyWay.features) {
      const geom = feature.geometry;

      if (geom.type === 'MultiPolygon') {
        for (const polygon of geom.coordinates) {
          this._drawMilkyWayPolygon(polygon, date, latDeg, lonDeg);
        }
      } else if (geom.type === 'Polygon') {
        this._drawMilkyWayPolygon(geom.coordinates, date, latDeg, lonDeg);
      }
    }
  }

  _drawMilkyWayPolygon(rings, date, latDeg, lonDeg) {
    const ctx = this.ctx;

    for (const ring of rings) {
      ctx.beginPath();
      let started = false;
      let visibleCount = 0;

      for (const point of ring) {
        const pos = this.projectCelestial(point[0], point[1], date, latDeg, lonDeg);
        if (!pos) {
          started = false;
          continue;
        }
        visibleCount++;
        if (!started) {
          ctx.moveTo(pos.sx, pos.sy);
          started = true;
        } else {
          ctx.lineTo(pos.sx, pos.sy);
        }
      }

      if (visibleCount > 2) {
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }
  }

  /**
   * メシエ天体を描画
   * @param {object} messier - GeoJSON FeatureCollection
   */
  drawMessier(messier, date, latDeg, lonDeg) {
    const ctx = this.ctx;

    // 種別ごとの色とマーカー形状
    const typeStyles = {
      gc: { color: 'rgba(255, 200, 50, 0.7)', label: '球状星団', marker: 'circle' },
      oc: { color: 'rgba(100, 200, 255, 0.7)', label: '散開星団', marker: 'circle' },
      e:  { color: 'rgba(255, 150, 150, 0.7)', label: '銀河', marker: 'ellipse' },
      s:  { color: 'rgba(255, 150, 150, 0.7)', label: '銀河', marker: 'ellipse' },
      i:  { color: 'rgba(255, 150, 150, 0.7)', label: '不規則銀河', marker: 'ellipse' },
      rn: { color: 'rgba(100, 255, 150, 0.6)', label: '反射星雲', marker: 'diamond' },
      pn: { color: 'rgba(100, 255, 200, 0.7)', label: '惑星状星雲', marker: 'diamond' },
      snr:{ color: 'rgba(255, 100, 100, 0.7)', label: '超新星残骸', marker: 'diamond' },
      sfr:{ color: 'rgba(100, 255, 150, 0.6)', label: '星形成領域', marker: 'diamond' },
      pos:{ color: 'rgba(200, 200, 200, 0.5)', label: '不明', marker: 'circle' },
    };

    for (const feature of messier.features) {
      const coords = feature.geometry.coordinates;
      const pos = this.projectCelestial(coords[0], coords[1], date, latDeg, lonDeg);
      if (!pos) continue;

      const props = feature.properties;
      const style = typeStyles[props.type] || typeStyles.pos;
      const r = 3;

      ctx.fillStyle = style.color;
      ctx.strokeStyle = style.color;
      ctx.lineWidth = 1;

      if (style.marker === 'ellipse') {
        // 銀河: 楕円
        ctx.beginPath();
        ctx.ellipse(pos.sx, pos.sy, r * 1.5, r, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (style.marker === 'diamond') {
        // 星雲: ひし形
        ctx.beginPath();
        ctx.moveTo(pos.sx, pos.sy - r);
        ctx.lineTo(pos.sx + r, pos.sy);
        ctx.lineTo(pos.sx, pos.sy + r);
        ctx.lineTo(pos.sx - r, pos.sy);
        ctx.closePath();
        ctx.stroke();
      } else {
        // 星団: 小円
        ctx.beginPath();
        ctx.arc(pos.sx, pos.sy, r, 0, Math.PI * 2);
        ctx.stroke();
      }

      // ラベル (番号)
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText(props.name, pos.sx + r + 2, pos.sy - 1);
    }
  }

  /**
   * 惑星を描画
   * @param {Array<{ name, symbol, ra, dec }>} planets
   */
  drawPlanets(planets, date, latDeg, lonDeg) {
    const ctx = this.ctx;

    for (const planet of planets) {
      const pos = this.project(planet.ra, planet.dec, date, latDeg, lonDeg);
      if (!pos) continue;

      // 惑星の円
      ctx.beginPath();
      ctx.arc(pos.sx, pos.sy, 4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 220, 100, 0.9)';
      ctx.fill();

      // 惑星記号 + 名前
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(255, 220, 100, 0.9)';
      ctx.fillText(`${planet.symbol} ${planet.name}`, pos.sx + 8, pos.sy);
    }
  }

  /**
   * 月を描画
   * @param {{ ra, dec, age, illumination }} moon
   */
  drawMoon(moon, date, latDeg, lonDeg) {
    const pos = this.project(moon.ra, moon.dec, date, latDeg, lonDeg);
    if (!pos) return;

    const moonRadius = 10;
    drawMoonPhase(this.ctx, pos.sx, pos.sy, moonRadius, moon.age, moon.illumination);

    // 月ラベル
    const ctx = this.ctx;
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255, 253, 200, 0.8)';
    const ageStr = `月 (月齢 ${moon.age.toFixed(1)})`;
    ctx.fillText(ageStr, pos.sx + moonRadius + 5, pos.sy);
  }

  /**
   * 太陽を描画 (地平線上にある場合)
   * @param {{ ra, dec }} sun
   */
  drawSun(sun, date, latDeg, lonDeg) {
    const pos = this.project(sun.ra, sun.dec, date, latDeg, lonDeg);
    if (!pos) return;

    const ctx = this.ctx;

    // 太陽グロー
    const gradient = ctx.createRadialGradient(pos.sx, pos.sy, 2, pos.sx, pos.sy, 30);
    gradient.addColorStop(0, 'rgba(255, 255, 200, 0.8)');
    gradient.addColorStop(0.3, 'rgba(255, 200, 50, 0.3)');
    gradient.addColorStop(1, 'rgba(255, 200, 50, 0)');
    ctx.beginPath();
    ctx.arc(pos.sx, pos.sy, 30, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();

    // 太陽本体
    ctx.beginPath();
    ctx.arc(pos.sx, pos.sy, 6, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 240, 100, 1)';
    ctx.fill();

    // ラベル
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255, 240, 100, 0.9)';
    ctx.fillText('☉ 太陽', pos.sx + 10, pos.sy);
  }
}
