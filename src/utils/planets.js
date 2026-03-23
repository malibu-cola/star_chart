/**
 * 太陽・惑星位置計算
 * Jean Meeus「Astronomical Algorithms」に基づく
 * ケプラー軌道要素近似計算
 */

import { dateToJD, jdToT, DEG, RAD } from './astronomy.js';

/**
 * 太陽の黄経・黄緯を計算 (低精度)
 * @returns {{ lon: number, lat: number, ra: number, dec: number }}
 *   lon/lat: 黄道座標[度], ra: 赤経[時], dec: 赤緯[度]
 */
export function solarPosition(date) {
  const T = jdToT(dateToJD(date));

  // 太陽の幾何学的平均黄経
  let L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
  L0 = ((L0 % 360) + 360) % 360;

  // 太陽の平均近点角
  let M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
  M = ((M % 360) + 360) % 360;
  const Mrad = M * DEG;

  // 太陽の中心差
  const C = (1.914602 - 0.004817 * T) * Math.sin(Mrad)
    + 0.019993 * Math.sin(2 * Mrad)
    + 0.000289 * Math.sin(3 * Mrad);

  // 太陽の真黄経
  const sunLon = L0 + C;

  // 黄道傾斜角
  const eps = 23.439291 - 0.0130042 * T;
  const epsRad = eps * DEG;
  const lonRad = sunLon * DEG;

  // 黄道座標 → 赤道座標
  const ra = Math.atan2(Math.cos(epsRad) * Math.sin(lonRad), Math.cos(lonRad));
  const dec = Math.asin(Math.sin(epsRad) * Math.sin(lonRad));

  return {
    lon: sunLon,
    lat: 0,
    ra: ((ra * RAD / 15) + 24) % 24, // ラジアン → 時
    dec: dec * RAD,
  };
}

/**
 * 黄道傾斜角 [度]
 */
function obliquity(T) {
  return 23.439291 - 0.0130042 * T;
}

/**
 * ケプラー方程式を解く (E - e*sinE = M)
 */
function solveKepler(M, e, iterations = 15) {
  let E = M;
  for (let i = 0; i < iterations; i++) {
    E = E - (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  }
  return E;
}

/**
 * 惑星軌道要素 (J2000.0 + 世紀変化率)
 * Meeus / JPL 近似値
 */
const PLANET_ELEMENTS = {
  Mercury: {
    a: [0.38709927, 0.00000037],
    e: [0.20563593, 0.00001906],
    I: [7.00497902, -0.00594749],
    L: [252.25032350, 149472.67411175],
    longPeri: [77.45779628, 0.16047689],
    longNode: [48.33076593, -0.12534081],
    name: '水星', symbol: '☿',
  },
  Venus: {
    a: [0.72333566, 0.00000390],
    e: [0.00677672, -0.00004107],
    I: [3.39467605, -0.00078890],
    L: [181.97909950, 58517.81538729],
    longPeri: [131.60246718, 0.00268329],
    longNode: [76.67984255, -0.27769418],
    name: '金星', symbol: '♀',
  },
  Earth: {
    a: [1.00000261, 0.00000562],
    e: [0.01671123, -0.00004392],
    I: [-0.00001531, -0.01294668],
    L: [100.46457166, 35999.37244981],
    longPeri: [102.93768193, 0.32327364],
    longNode: [0.0, 0.0],
    name: '地球', symbol: '⊕',
  },
  Mars: {
    a: [1.52371034, 0.00001847],
    e: [0.09339410, 0.00007882],
    I: [1.84969142, -0.00813131],
    L: [-4.55343205, 19140.30268499],
    longPeri: [-23.94362959, 0.44441088],
    longNode: [49.55953891, -0.29257343],
    name: '火星', symbol: '♂',
  },
  Jupiter: {
    a: [5.20288700, -0.00011607],
    e: [0.04838624, -0.00013253],
    I: [1.30439695, -0.00183714],
    L: [34.39644051, 3034.74612775],
    longPeri: [14.72847983, 0.21252668],
    longNode: [100.47390909, 0.20469106],
    name: '木星', symbol: '♃',
  },
  Saturn: {
    a: [9.53667594, -0.00125060],
    e: [0.05386179, -0.00050991],
    I: [2.48599187, 0.00193609],
    L: [49.95424423, 1222.49362201],
    longPeri: [92.59887831, -0.41897216],
    longNode: [113.66242448, -0.28867794],
    name: '土星', symbol: '♄',
  },
  Uranus: {
    a: [19.18916464, -0.00196176],
    e: [0.04725744, -0.00004397],
    I: [0.77263783, -0.00242939],
    L: [313.23810451, 428.48202785],
    longPeri: [170.95427630, 0.40805281],
    longNode: [74.01692503, 0.04240589],
    name: '天王星', symbol: '♅',
  },
  Neptune: {
    a: [30.06992276, 0.00026291],
    e: [0.00859048, 0.00005105],
    I: [1.77004347, 0.00035372],
    L: [-55.12002969, 218.45945325],
    longPeri: [44.96476227, -0.32241464],
    longNode: [131.78422574, -0.00508664],
    name: '海王星', symbol: '♆',
  },
};

/**
 * 惑星の黄道座標（日心）を計算
 */
function heliocentricPosition(elements, T) {
  const a = elements.a[0] + elements.a[1] * T;
  const e = elements.e[0] + elements.e[1] * T;
  const I = (elements.I[0] + elements.I[1] * T) * DEG;
  const L = ((elements.L[0] + elements.L[1] * T) % 360 + 360) % 360;
  const longPeri = elements.longPeri[0] + elements.longPeri[1] * T;
  const longNode = elements.longNode[0] + elements.longNode[1] * T;

  const omega = longPeri - longNode; // 近日点引数
  const M = (L - longPeri) * DEG; // 平均近点角 [rad]

  const E = solveKepler(M, e);

  // 軌道面上の座標
  const xOrb = a * (Math.cos(E) - e);
  const yOrb = a * Math.sqrt(1 - e * e) * Math.sin(E);

  const omegaRad = omega * DEG;
  const nodeRad = longNode * DEG;

  // 黄道座標に変換
  const cosO = Math.cos(omegaRad);
  const sinO = Math.sin(omegaRad);
  const cosN = Math.cos(nodeRad);
  const sinN = Math.sin(nodeRad);
  const cosI = Math.cos(I);
  const sinI = Math.sin(I);

  const x = (cosO * cosN - sinO * sinN * cosI) * xOrb + (-sinO * cosN - cosO * sinN * cosI) * yOrb;
  const y = (cosO * sinN + sinO * cosN * cosI) * xOrb + (-sinO * sinN + cosO * cosN * cosI) * yOrb;
  const z = (sinO * sinI) * xOrb + (cosO * sinI) * yOrb;

  return { x, y, z };
}

/**
 * 全惑星の赤道座標を計算
 * @returns {Array<{ name, symbol, ra, dec }>}
 */
export function planetPositions(date) {
  const T = jdToT(dateToJD(date));
  const eps = obliquity(T) * DEG;

  // 地球の日心座標
  const earth = heliocentricPosition(PLANET_ELEMENTS.Earth, T);

  const results = [];

  for (const [key, elements] of Object.entries(PLANET_ELEMENTS)) {
    if (key === 'Earth') continue;

    const planet = heliocentricPosition(elements, T);

    // 地心座標 (黄道)
    const dx = planet.x - earth.x;
    const dy = planet.y - earth.y;
    const dz = planet.z - earth.z;

    // 黄道 → 赤道座標変換
    const xEq = dx;
    const yEq = dy * Math.cos(eps) - dz * Math.sin(eps);
    const zEq = dy * Math.sin(eps) + dz * Math.cos(eps);

    const ra = ((Math.atan2(yEq, xEq) * RAD / 15) + 24) % 24;
    const dec = Math.atan2(zEq, Math.sqrt(xEq * xEq + yEq * yEq)) * RAD;

    results.push({
      name: elements.name,
      symbol: elements.symbol,
      ra,
      dec,
    });
  }

  return results;
}

export { PLANET_ELEMENTS };
