/**
 * 月の位置・月齢計算
 * Jean Meeus「Astronomical Algorithms」簡易版
 */

import { dateToJD, jdToT, DEG, RAD } from './astronomy.js';

/**
 * 月の赤道座標を計算 (低精度)
 * @returns {{ ra: number, dec: number, age: number, illumination: number }}
 *   ra: 赤経[時], dec: 赤緯[度], age: 月齢[日], illumination: 照明率(0-1)
 */
export function moonPosition(date) {
  const T = jdToT(dateToJD(date));

  // 月の平均黄経 L'
  let Lp = 218.3164477 + 481267.88123421 * T
    - 0.0015786 * T * T + T * T * T / 538841 - T * T * T * T / 65194000;
  Lp = ((Lp % 360) + 360) % 360;

  // 月の平均近点角 M'
  let Mp = 134.9633964 + 477198.8675055 * T
    + 0.0087414 * T * T + T * T * T / 69699 - T * T * T * T / 14712000;
  Mp = ((Mp % 360) + 360) % 360;

  // 月の平均離角 D
  let D = 297.8501921 + 445267.1114034 * T
    - 0.0018819 * T * T + T * T * T / 545868 - T * T * T * T / 113065000;
  D = ((D % 360) + 360) % 360;

  // 太陽の平均近点角 M
  let M = 357.5291092 + 35999.0502909 * T
    - 0.0001536 * T * T + T * T * T / 24490000;
  M = ((M % 360) + 360) % 360;

  // 月の昇交点黄経 F
  let F = 93.2720950 + 483202.0175233 * T
    - 0.0036539 * T * T - T * T * T / 3526000 + T * T * T * T / 863310000;
  F = ((F % 360) + 360) % 360;

  const LpRad = Lp * DEG;
  const MpRad = Mp * DEG;
  const DRad = D * DEG;
  const MRad = M * DEG;
  const FRad = F * DEG;

  // 黄経の主要摂動項
  let lonCorrection = 6.289 * Math.sin(MpRad)
    + 1.274 * Math.sin(2 * DRad - MpRad)
    + 0.658 * Math.sin(2 * DRad)
    + 0.214 * Math.sin(2 * MpRad)
    - 0.186 * Math.sin(MRad)
    - 0.114 * Math.sin(2 * FRad);

  // 黄緯の主要摂動項
  let latCorrection = 5.128 * Math.sin(FRad)
    + 0.281 * Math.sin(MpRad + FRad)
    + 0.278 * Math.sin(MpRad - FRad)
    + 0.173 * Math.sin(2 * DRad - FRad);

  const moonLon = (Lp + lonCorrection) * DEG;
  const moonLat = latCorrection * DEG;

  // 黄道傾斜角
  const eps = (23.439291 - 0.0130042 * T) * DEG;

  // 黄道座標 → 赤道座標
  const sinLon = Math.sin(moonLon);
  const cosLon = Math.cos(moonLon);
  const sinLat = Math.sin(moonLat);
  const cosLat = Math.cos(moonLat);
  const sinEps = Math.sin(eps);
  const cosEps = Math.cos(eps);

  const ra = Math.atan2(
    sinLon * cosEps - sinLat / cosLat * sinEps,
    cosLon
  );
  const dec = Math.asin(sinLat * cosEps + cosLat * sinEps * sinLon);

  // 月齢 (朔からの日数)
  // 簡易計算: 平均朔望月 = 29.53059日
  const jd = dateToJD(date);
  // 2000年1月6日 18:14 UTC が新月 (JD 2451550.1)
  const age = ((jd - 2451550.1) % 29.53059 + 29.53059) % 29.53059;

  // 照明率
  const illumination = (1 - Math.cos(age * Math.PI / 14.765)) / 2;

  return {
    ra: ((ra * RAD / 15) + 24) % 24,
    dec: dec * RAD,
    age,
    illumination,
  };
}

/**
 * 月の満ち欠けをCanvasに描画
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cx - 中心X
 * @param {number} cy - 中心Y
 * @param {number} radius - 半径
 * @param {number} age - 月齢 (0-29.53)
 * @param {number} illumination - 照明率 (0-1)
 */
export function drawMoonPhase(ctx, cx, cy, radius, age, illumination) {
  // 月の円（暗い部分）
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(60, 60, 60, 0.8)';
  ctx.fill();

  // 明るい部分を描画
  // age < 14.765 なら右半球が明るい（上弦まで）
  // age >= 14.765 なら左半球が明るい（下弦まで）
  const isWaxing = age < 14.765;

  // 照明幅の楕円パラメータ
  const k = illumination;
  const cosPhase = 2 * k - 1; // -1(新月) 〜 0(半月) 〜 1(満月)

  ctx.save();
  ctx.beginPath();

  // 明るい半分の弧
  if (isWaxing) {
    // 右半分が明るい
    ctx.arc(cx, cy, radius, -Math.PI / 2, Math.PI / 2, false);
    // 境界線を楕円で描画
    ctx.ellipse(cx, cy, radius * Math.abs(cosPhase), radius, 0, Math.PI / 2, -Math.PI / 2, cosPhase > 0);
  } else {
    // 左半分が明るい
    ctx.arc(cx, cy, radius, Math.PI / 2, -Math.PI / 2, false);
    ctx.ellipse(cx, cy, radius * Math.abs(cosPhase), radius, 0, -Math.PI / 2, Math.PI / 2, cosPhase > 0);
  }

  ctx.closePath();
  ctx.fillStyle = 'rgba(255, 253, 230, 0.95)';
  ctx.fill();
  ctx.restore();

  // 月の輪郭
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(200, 200, 180, 0.3)';
  ctx.lineWidth = 0.5;
  ctx.stroke();
}
