// TesseractOCRService.js
// Устанавливать: npm install tesseract.js
import { createWorker } from 'tesseract.js';

class TesseractOCRService {
  constructor() {
    this.worker = null;
    this.initialized = false;
    this.lang = 'eng';
    this.tessOptions = {
      tessedit_char_whitelist: '0123456789-',
      preserve_interword_spaces: '0'
    };
  }

  async init() {
    if (this.initialized) return;
    this.worker = createWorker({
      logger: (m) => {
        // Для дебага можно раскомментировать
        // console.log('TESS:', m);
      }
    });
    await this.worker.load();
    await this.worker.loadLanguage(this.lang);
    await this.worker.initialize(this.lang);
    await this.worker.setParameters({
      tessedit_char_whitelist: this.tessOptions.tessedit_char_whitelist,
      preserve_interword_spaces: this.tessOptions.preserve_interword_spaces,
      tessedit_pageseg_mode: '6'
    });
    this.initialized = true;
  }

  // Предобработка: canvas (натуральный размер), grayscale, contrast stretch, adaptive threshold
  createPreprocessedCanvas(imageElement) {
    const w = imageElement.naturalWidth || imageElement.width;
    const h = imageElement.naturalHeight || imageElement.height;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(imageElement, 0, 0, w, h);

    const src = ctx.getImageData(0, 0, w, h).data;
    const gray = new Uint8ClampedArray(w * h);
    for (let i = 0, j = 0; i < src.length; i += 4, j++) {
      gray[j] = Math.round(0.299 * src[i] + 0.587 * src[i + 1] + 0.114 * src[i + 2]);
    }

    // Contrast stretch by percentiles 2%..98%
    const hist = new Uint32Array(256);
    for (let i = 0; i < gray.length; i++) hist[gray[i]]++;
    const total = gray.length;
    const lowCount = Math.floor(total * 0.02);
    const highCount = Math.floor(total * 0.98);
    let cumsum = 0, lowVal = 0, highVal = 255;
    for (let v = 0; v < 256; v++) { cumsum += hist[v]; if (cumsum >= lowCount) { lowVal = v; break; } }
    cumsum = 0;
    for (let v = 255; v >= 0; v--) { cumsum += hist[v]; if (cumsum >= total - highCount) { highVal = v; break; } }
    const scale = highVal > lowVal ? 255 / (highVal - lowVal) : 1;
    for (let i = 0; i < gray.length; i++) {
      let v = Math.round((gray[i] - lowVal) * scale);
      if (v < 0) v = 0; if (v > 255) v = 255;
      gray[i] = v;
    }

    // Integral image -> adaptive threshold
    const integral = new Uint32Array((w + 1) * (h + 1));
    for (let y = 0; y < h; y++) {
      let rowSum = 0;
      for (let x = 0; x < w; x++) {
        rowSum += gray[y * w + x];
        integral[(y + 1) * (w + 1) + (x + 1)] = integral[y * (w + 1) + (x + 1)] + rowSum;
      }
    }

    const out = new Uint8ClampedArray(w * h * 4);
    const win = Math.max(15, Math.floor(Math.min(w, h) / 20));
    const half = Math.floor(win / 2);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const x1 = Math.max(0, x - half), y1 = Math.max(0, y - half);
        const x2 = Math.min(w - 1, x + half), y2 = Math.min(h - 1, y + half);
        const area = (x2 - x1 + 1) * (y2 - y1 + 1);
        const sum = integral[(y2 + 1) * (w + 1) + (x2 + 1)]
                  - integral[(y1) * (w + 1) + (x2 + 1)]
                  - integral[(y2 + 1) * (w + 1) + (x1)]
                  + integral[(y1) * (w + 1) + (x1)];
        const mean = Math.round(sum / area);
        const threshold = mean - 10;
        const gv = gray[y * w + x];
        const val = gv < threshold ? 0 : 255;
        const idx = (y * w + x) * 4;
        out[idx] = out[idx + 1] = out[idx + 2] = val;
        out[idx + 3] = 255;
      }
    }

    ctx.putImageData(new ImageData(out, w, h), 0, 0);
    return canvas;
  }

  // Конвертируем canvas в dataURL или objectURL (fallback toBlob)
  canvasToTransferURL(canvas) {
    try {
      const dataUrl = canvas.toDataURL('image/png');
      return Promise.resolve({ url: dataUrl, isObjectURL: false });
    } catch (e) {
      return new Promise((resolve, reject) => {
        try {
          canvas.toBlob((blob) => {
            if (!blob) { reject(new Error('toBlob returned null')); return; }
            const objUrl = URL.createObjectURL(blob);
            resolve({ url: objUrl, isObjectURL: true });
          }, 'image/png');
        } catch (err) {
          reject(err);
        }
      });
    }
  }

  // Основной метод: принимает HTMLImageElement и возвращает массив {digit, confidence, x, y, width, height}
  async recognizeImage(imageElement, options = { onlyDigits: true }) {
    await this.init();

    const preCanvas = this.createPreprocessedCanvas(imageElement);
    const { url: transferUrl, isObjectURL } = await this.canvasToTransferURL(preCanvas);

    // Передаём в worker только строку (dataURL) или objectURL (строку) — не DOM!
    const { data } = await this.worker.recognize(transferUrl, { tessjs_create_hocr: '0', tessjs_create_tsv: '0' });

    if (isObjectURL) {
      try { URL.revokeObjectURL(transferUrl); } catch (e) { /* ignore */ }
    }

    const symbols = (data && data.symbols) ? data.symbols : [];
    const results = [];

    for (const s of symbols) {
      const ch = s.text;
      const conf = (typeof s.confidence !== 'undefined') ? s.confidence : (typeof s.conf !== 'undefined' ? s.conf : 0);
      let bbox = null;
      if (s.bbox && typeof s.bbox.x0 !== 'undefined') bbox = { x0: s.bbox.x0, y0: s.bbox.y0, x1: s.bbox.x1, y1: s.bbox.y1 };
      else if (s.bbox && typeof s.bbox.x !== 'undefined') bbox = { x0: s.bbox.x, y0: s.bbox.y, x1: s.bbox.x + s.bbox.w, y1: s.bbox.y + s.bbox.h };
      else if (s.boundingBox && typeof s.boundingBox.x0 !== 'undefined') bbox = { x0: s.boundingBox.x0, y0: s.boundingBox.y0, x1: s.boundingBox.x1, y1: s.boundingBox.y1 };
      else if (s.bbox && s.bbox.x1 && s.bbox.y1 && s.bbox.x2 && s.bbox.y2) bbox = { x0: s.bbox.x1, y0: s.bbox.y1, x1: s.bbox.x2, y1: s.bbox.y2 };
      if (!bbox) continue;
      const x = Math.round(bbox.x0), y = Math.round(bbox.y0), width = Math.round(bbox.x1 - bbox.x0), height = Math.round(bbox.y1 - bbox.y0);
      if (options.onlyDigits && !/^[0-9\-]$/.test(ch)) continue;
      results.push({ digit: ch, confidence: conf, x, y, width, height });
    }

    // fallback: words -> split (если symbols пусты)
    if (results.length === 0 && data && data.words && data.words.length > 0) {
      for (const w of data.words) {
        const text = w.text || ''; const wordConf = w.confidence || 0; const bx = w.bbox || w.boundingBox || null;
        let x = 0, y = 0, width = 0, height = 0;
        if (bx) {
          if (typeof bx.x0 !== 'undefined') { x = Math.round(bx.x0); y = Math.round(bx.y0); width = Math.round(bx.x1 - bx.x0); height = Math.round(bx.y1 - bx.y0); }
          else if (typeof bx.x !== 'undefined') { x = Math.round(bx.x); y = Math.round(bx.y); width = Math.round(bx.w); height = Math.round(bx.h); }
        }
        const chars = text.split('');
        const perW = width > 0 ? Math.max(1, Math.round(width / Math.max(1, chars.length))) : 0;
        for (let i = 0; i < chars.length; i++) {
          const ch = chars[i]; if (!/^[0-9\-]$/.test(ch)) continue;
          const cx = x + i * perW;
          results.push({ digit: ch, confidence: wordConf, x: cx, y, width: perW, height });
        }
      }
    }

    results.sort((a, b) => {
      if (Math.abs(a.y - b.y) < 10) return a.x - b.x;
      return a.y - b.y;
    });

    return results;
  }

  async terminate() {
    if (this.worker) {
      try { await this.worker.terminate(); } catch (e) { /* ignore */ }
    }
    this.worker = null;
    this.initialized = false;
  }
}

export default new TesseractOCRService();