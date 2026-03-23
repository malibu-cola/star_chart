/**
 * 天文計算ユーティリティ
 * - ユリウス日計算
 * - グリニッジ恒星時 (GST)
 * - 地方恒星時 (LST)
 * - 赤道座標 → 地平座標変換
 */

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;
const HOURS_TO_DEG = 15; // 1h = 15°

/**
 * Date → ユリウス日 (JD)
 */
export function dateToJD(date) {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  const d = date.getUTCDate()
    + date.getUTCHours() / 24
    + date.getUTCMinutes() / 1440
    + date.getUTCSeconds() / 86400;

  let Y = y, M = m;
  if (M <= 2) { Y -= 1; M += 12; }

  const A = Math.floor(Y / 100);
  const B = 2 - A + Math.floor(A / 4);

  return Math.floor(365.25 * (Y + 4716)) + Math.floor(30.6001 * (M + 1)) + d + B - 1524.5;
}

/**
 * ユリウス日 → J2000.0 からの世紀数 (T)
 */
export function jdToT(jd) {
  return (jd - 2451545.0) / 36525.0;
}

/**
 * グリニッジ平均恒星時 (GMST) [度]
 */
export function gmst(date) {
  const jd = dateToJD(date);
  const T = jdToT(jd);
  // IAU 1982 式
  let gmst = 280.46061837
    + 360.98564736629 * (jd - 2451545.0)
    + 0.000387933 * T * T
    - T * T * T / 38710000.0;
  return ((gmst % 360) + 360) % 360;
}

/**
 * 地方恒星時 (LST) [度]
 * @param {Date} date
 * @param {number} lonDeg - 観測地経度 [度] (東経が正)
 */
export function lst(date, lonDeg) {
  return ((gmst(date) + lonDeg) % 360 + 360) % 360;
}

/**
 * 赤道座標 (RA/Dec) → 地平座標 (Alt/Az)
 * @param {number} raHours - 赤経 [時]
 * @param {number} decDeg  - 赤緯 [度]
 * @param {Date} date
 * @param {number} latDeg  - 観測地緯度 [度]
 * @param {number} lonDeg  - 観測地経度 [度]
 * @returns {{ alt: number, az: number }} 高度・方位角 [度]
 */
export function equatorialToHorizontal(raHours, decDeg, date, latDeg, lonDeg) {
  const lstDeg = lst(date, lonDeg);
  // 時角 (Hour Angle) [度]
  const haDeg = lstDeg - raHours * HOURS_TO_DEG;
  const ha = haDeg * DEG;
  const dec = decDeg * DEG;
  const lat = latDeg * DEG;

  const sinAlt = Math.sin(dec) * Math.sin(lat) + Math.cos(dec) * Math.cos(lat) * Math.cos(ha);
  const alt = Math.asin(sinAlt);

  const cosAz = (Math.sin(dec) - Math.sin(alt) * Math.sin(lat)) / (Math.cos(alt) * Math.cos(lat));
  let az = Math.acos(Math.max(-1, Math.min(1, cosAz)));
  if (Math.sin(ha) > 0) az = 2 * Math.PI - az;

  return { alt: alt * RAD, az: az * RAD };
}

/**
 * 地平座標 → ステレオグラフ投影 (天頂中心)
 * @param {number} altDeg - 高度 [度]
 * @param {number} azDeg  - 方位角 [度] (北=0, 東=90)
 * @returns {{ x: number, y: number }} 正規化座標 (-1 to 1)
 */
export function horizontalToStereo(altDeg, azDeg) {
  const alt = altDeg * DEG;
  const az = azDeg * DEG;
  // 天頂からの角距離
  const zd = Math.PI / 2 - alt;
  const r = Math.tan(zd / 2); // ステレオグラフ投影半径
  // 北が上、東が左 (星空は鏡像)
  const x = -r * Math.sin(az);
  const y = -r * Math.cos(az);
  return { x, y };
}

/**
 * B-V 色指数 → RGB カラー文字列
 * スペクトル型に対応した星の色を返す
 */
export function bvToColor(bv) {
  if (bv == null) return 'rgb(255,255,255)';
  // Tanner Helland の近似式を簡略化
  let r, g, b;
  // B-V: -0.4 (青白) 〜 0.0 (白) 〜 0.65 (黄) 〜 1.4 (橙) 〜 2.0 (赤)
  const t = Math.max(-0.4, Math.min(2.0, bv));

  if (t < 0) {
    // 青白い星 (O/B型)
    r = 155 + (100 * (t + 0.4) / 0.4);
    g = 176 + (79 * (t + 0.4) / 0.4);
    b = 255;
  } else if (t < 0.15) {
    // 白い星 (A型)
    r = 255;
    g = 255;
    b = 255;
  } else if (t < 0.44) {
    // 黄白い星 (F型)
    r = 255;
    g = 255;
    b = 255 - (55 * (t - 0.15) / 0.29);
  } else if (t < 0.68) {
    // 黄色い星 (G型)
    r = 255;
    g = 255 - (30 * (t - 0.44) / 0.24);
    b = 200 - (60 * (t - 0.44) / 0.24);
  } else if (t < 1.15) {
    // 橙色い星 (K型)
    r = 255;
    g = 225 - (80 * (t - 0.68) / 0.47);
    b = 140 - (80 * (t - 0.68) / 0.47);
  } else {
    // 赤い星 (M型)
    r = 255 - (30 * (t - 1.15) / 0.85);
    g = 145 - (80 * (t - 1.15) / 0.85);
    b = 60 - (40 * (t - 1.15) / 0.85);
  }

  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}

/**
 * 等級 → 描画半径 (ピクセル)
 */
export function magToRadius(mag) {
  // 1等星 = 3px, 6等星 = 0.5px
  return Math.max(0.4, 3.5 - mag * 0.5);
}

/**
 * 等級 → 不透明度
 */
export function magToAlpha(mag) {
  if (mag <= 1) return 1.0;
  if (mag >= 6.5) return 0.3;
  return 1.0 - (mag - 1) * 0.127;
}

export { DEG, RAD, HOURS_TO_DEG };
