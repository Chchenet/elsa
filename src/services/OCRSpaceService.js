// Сервис для распознавания через OCR.space API
// Требует: REACT_APP_OCRSPACE_API_KEY в окружении или заменить значение apiKey ниже.

const OCRSPACE_API_KEY = process.env.REACT_APP_OCRSPACE_API_KEY || 'helloworld'; // замените на ваш ключ

async function imageElementToBase64(imgEl) {
  const w = imgEl.naturalWidth || imgEl.width;
  const h = imgEl.naturalHeight || imgEl.height;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(imgEl, 0, 0, w, h);
  // data URL
  return canvas.toDataURL('image/png');
}

async function recognizeWithOCRSpace(imageElement, options = {}) {
  const base64DataUrl = await imageElementToBase64(imageElement);
  // remove prefix "data:image/png;base64,"
  const base64 = base64DataUrl.replace(/^data:image\/\w+;base64,/, '');

  const form = new FormData();
  form.append('apikey', OCRSPACE_API_KEY);
  form.append('base64Image', 'data:image/png;base64,' + base64);
  form.append('language', options.language || 'eng');
  form.append('isOverlayRequired', 'true'); // нужен TextOverlay с координатами
  // engine 2 (if available) can be more accurate:
  // form.append('OCREngine', '2');

  const resp = await fetch('https://api.ocr.space/parse/image', {
    method: 'POST',
    body: form
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`OCR.space request failed: ${resp.status} ${resp.statusText} — ${text}`);
  }

  const data = await resp.json();
  if (!data || !data.ParsedResults || data.ParsedResults.length === 0) {
    throw new Error('OCR.space returned no parsed results');
  }

  return data;
}

/**
 * Возвращает массив распознанных символов/групп в формате:
 * [{ text, confidence, x, y, width, height }]
 * Координаты в пикселях относительно натурального размера изображения.
 */
async function recognizeDigits(imageElement, options = {}) {
  const apiResult = await recognizeWithOCRSpace(imageElement, options);
  const parsed = apiResult.ParsedResults[0];

  // Если TextOverlay доступен — извлекаем слова и bbox
  const overlay = parsed.TextOverlay;
  const results = [];

  if (overlay && overlay.Lines && overlay.Lines.length > 0) {
    // overlay has Lines -> Words with Left, Top, Width, Height and WordText
    for (const line of overlay.Lines) {
      for (const w of line.Words) {
        const text = (w.WordText || '').trim();
        // оставим только те слова, которые содержат цифры (и дефис)
        if (!/^[0-9\-]+$/.test(text)) continue;
        const confidence = w.WordConfidence || parsed.ParsedTextConfidence || 0;
        // OCR.space overlay coords: Left/Top/Width/Height in pixels (should be relative to original image)
        results.push({
          text,
          confidence,
          x: Math.round(w.Left),
          y: Math.round(w.Top),
          width: Math.round(w.Width),
          height: Math.round(w.Height)
        });
      }
    }
  } else {
    // Fallback: разбор ParsedText (строка) — попытаемся найти числа без bbox
    const parsedText = parsed.ParsedText || '';
    const re = /[0-9\-]{1,6}/g;
    let m;
    while ((m = re.exec(parsedText)) !== null) {
      results.push({ text: m[0], confidence: 0, x: 0, y: 0, width: 0, height: 0 });
    }
  }

  // Можно дополнить группировкой цифр по строкам/близости, но OCR.space уже возвращает целые слова обычно
  return results;
}

export default {
  recognizeDigits,
  recognizeWithOCRSpace
};