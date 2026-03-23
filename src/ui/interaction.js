/**
 * ユーザーインタラクション
 * ドラッグ回転、ピンチズーム、ホイールズーム
 */

export class Interaction {
  /**
   * @param {import('../core/app.js').App} app
   */
  constructor(app) {
    this.app = app;

    // 回転オフセット (方位角方向の手動回転) [度]
    this.rotationAz = 0;

    // ズーム倍率
    this.zoom = 1.0;
    this.minZoom = 0.5;
    this.maxZoom = 5.0;

    // ドラッグ状態
    this._dragging = false;
    this._lastX = 0;
    this._lastY = 0;

    // ピンチ状態
    this._pinchDist = 0;
  }

  /**
   * イベントリスナーを登録
   */
  attach() {
    const canvas = this.app.canvas;

    // マウス: ドラッグ回転
    canvas.addEventListener('mousedown', (e) => this._onMouseDown(e));
    window.addEventListener('mousemove', (e) => this._onMouseMove(e));
    window.addEventListener('mouseup', () => this._onMouseUp());

    // マウスホイール: ズーム
    canvas.addEventListener('wheel', (e) => this._onWheel(e), { passive: false });

    // タッチ: スワイプ回転 + ピンチズーム
    canvas.addEventListener('touchstart', (e) => this._onTouchStart(e), { passive: false });
    canvas.addEventListener('touchmove', (e) => this._onTouchMove(e), { passive: false });
    canvas.addEventListener('touchend', (e) => this._onTouchEnd(e));
  }

  _onMouseDown(e) {
    this._dragging = true;
    this._lastX = e.clientX;
    this._lastY = e.clientY;
  }

  _onMouseMove(e) {
    if (!this._dragging) return;
    const dx = e.clientX - this._lastX;
    const dy = e.clientY - this._lastY;
    this._lastX = e.clientX;
    this._lastY = e.clientY;

    // 方位角と仰角のオフセット
    this.rotationAz += dx * 0.3 / this.zoom;

    this.app.render();
  }

  _onMouseUp() {
    this._dragging = false;
  }

  _onWheel(e) {
    e.preventDefault();
    const delta = -e.deltaY * 0.001;
    this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * (1 + delta)));
    this.app.render();
  }

  _onTouchStart(e) {
    if (e.touches.length === 1) {
      this._dragging = true;
      this._lastX = e.touches[0].clientX;
      this._lastY = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
      e.preventDefault();
      this._dragging = false;
      this._pinchDist = this._getTouchDist(e.touches);
    }
  }

  _onTouchMove(e) {
    if (e.touches.length === 1 && this._dragging) {
      e.preventDefault();
      const dx = e.touches[0].clientX - this._lastX;
      this._lastX = e.touches[0].clientX;
      this._lastY = e.touches[0].clientY;

      this.rotationAz += dx * 0.3 / this.zoom;
      this.app.render();
    } else if (e.touches.length === 2) {
      e.preventDefault();
      const dist = this._getTouchDist(e.touches);
      const ratio = dist / this._pinchDist;
      this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * ratio));
      this._pinchDist = dist;
      this.app.render();
    }
  }

  _onTouchEnd(e) {
    if (e.touches.length === 0) {
      this._dragging = false;
    }
  }

  _getTouchDist(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }
}
