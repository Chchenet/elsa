/* AutoOCRService.js
   Обновлён: добавлена нормализация_region -> template размер,
   предобработка (grayscale + адаптивная бинаризация), нормализованные признаки
   и сравнение через косинусную схожесть.
*/

class AutoOCRService {
  constructor() {
    // Канвас, на котором лежит исходное изображение (устанавливается извне)
    this.canvas = null;
    this.ctx = null;
    this.scale = 1; // масштаб изображения относительно канваса
    // Унифицированный размер шаблона для сравнения
    this.templateW = 40;
    this.templateH = 60;
    // Порог совпадения (0..1)
    this.matchThreshold = 0.72;

    // Шаблоны цифр (заполняется при инициализации)
    this.digitTemplates = this.createDigitTemplates();

    // Если требуется, можно поменять gridSize для extractFeatures
    this.featureGrid = { cols: this.templateW, rows: this.templateH }; // используем поблочное представление (пиксель как признак)
  }

  // Установить канвас (вызов из внешнего кода)
  setCanvas(canvas, scale = 1) {
    this.canvas = canvas;
    this.scale = scale;
    if (canvas) {
      this.ctx = canvas.getContext('2d');
    } else {
      this.ctx = null;
    }
  }

  /* --- Извлечение области цифры (нормализация в templateW/templateH + предобработка) --- */
  extractDigitRegion(digitData) {
    if (!this.canvas || !this.ctx) {
      throw new Error('Canvas not set. Call setCanvas() before extracting regions.');
    }

    const { x, y, width, height } = digitData;

    const srcX = Math.round(x * this.scale);
    const srcY = Math.round(y * this.scale);
    const srcW = Math.max(1, Math.round(width * this.scale));
    const srcH = Math.max(1, Math.round(height * this.scale));

    const digitCanvas = document.createElement('canvas');
    digitCanvas.width = this.templateW;
    digitCanvas.height = this.templateH;
    const digitCtx = digitCanvas.getContext('2d');

    // Ресайзим исходную область в шаблонный размер
    digitCtx.drawImage(
      this.canvas,
      srcX, srcY, srcW, srcH,
      0, 0, this.templateW, this.templateH
    );

    // Предобработка: grayscale + адаптивная бинаризация
    const rawImageData = digitCtx.getImageData(0, 0, this.templateW, this.templateH);
    const processed = this.preprocessImage(rawImageData);
    digitCtx.putImageData(processed, 0, 0);

    const features = this.extractFeatures(processed, this.templateW, this.templateH);

    return {
      canvas: digitCanvas,
      width: this.templateW,
      height: this.templateH,
      data: processed,
      features
    };
  }

  /* --- Предобработка: grayscale + простая адаптивная бинаризация на основе интегральной карты --- */
  preprocessImage(imageData) {
    const w = imageData.width;
    const h = imageData.height;
    const src = imageData.data;

    // Градация серого
    const gray = new Uint8ClampedArray(w * h);
    for (let i = 0, j = 0; i < src.length; i += 4, j++) {
      const r = src[i], g = src[i + 1], b = src[i + 2];
      gray[j] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    }

    // Интегральная карта для быстрого вычисления суммы по окну
    const integral = new Uint32Array((w + 1) * (h + 1));
    for (let y = 0; y < h; y++) {
      let rowSum = 0;
      for (let x = 0; x < w; x++) {
        rowSum += gray[y * w + x];
        integral[(y + 1) * (w + 1) + (x + 1)] = integral[y * (w + 1) + (x + 1)] + rowSum;
      }
    }

    const window = Math.max(7, Math.floor(Math.min(w, h) / 6)); // адаптивный размер окна
    const half = Math.floor(window / 2);

    const out = new Uint8ClampedArray(w * h * 4);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const x1 = Math.max(0, x - half);
        const y1 = Math.max(0, y - half);
        const x2 = Math.min(w - 1, x + half);
        const y2 = Math.min(h - 1, y + half);

        const area = (x2 - x1 + 1) * (y2 - y1 + 1);

        const sum = integral[(y2 + 1) * (w + 1) + (x2 + 1)]
                  - integral[(y1) * (w + 1) + (x2 + 1)]
                  - integral[(y2 + 1) * (w + 1) + (x1)]
                  + integral[(y1) * (w + 1) + (x1)];

        const mean = Math.round(sum / area);
        const threshold = mean - 8; // небольшая поправка
        const val = (gray[y * w + x] < threshold) ? 0 : 255;
        const idx = (y * w + x) * 4;
        out[idx] = out[idx + 1] = out[idx + 2] = val;
        out[idx + 3] = 255;
      }
    }

    return new ImageData(out, w, h);
  }

  /* --- Извлечение признаков: используем бинарный пиксельный вектор, нормализованный L2 --- */
  extractFeatures(imageData, width, height) {
    const data = imageData.data;
    const vec = new Float32Array(width * height);
    let sumSq = 0;

    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
      // бинарный: 0 или 1 (обратный: 1 = фон, 0 = черный), но порядок неважен для косинуса
      const v = data[i] > 128 ? 1 : 0;
      vec[j] = v;
      sumSq += v * v;
    }

    const norm = Math.sqrt(sumSq) || 1;
    for (let i = 0; i < vec.length; i++) vec[i] = vec[i] / norm;
    return vec;
  }

  /* --- Сравнение через косинусную схожесть (скаляр для ��ормализованных векторов) --- */
  compareFeatures(f1, f2) {
    if (!f1 || !f2 || f1.length !== f2.length) return 0;
    let dot = 0;
    for (let i = 0; i < f1.length; i++) dot += f1[i] * f2[i];
    return dot; // в диапазоне [0,1] для неотрицательных нормализованных векторов
  }

  /* --- Создание шаблона одной цифры в том же размере, что и template --- */
  createDigitCanvas(digitChar) {
    const canvas = document.createElement('canvas');
    canvas.width = this.templateW;
    canvas.height = this.templateH;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'black';
    // подбираем размер шрифта пропорционально высоте шаблона
    const fontSize = Math.floor(this.templateH * 0.72);
    ctx.font = `bold ${fontSize}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(digitChar, canvas.width / 2, canvas.height / 2);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const processed = this.preprocessImage(imageData);
    const features = this.extractFeatures(processed, canvas.width, canvas.height);

    return {
      canvas,
      features
    };
  }

  createDigitTemplates() {
    return {
      '0': this.createDigitCanvas('0'),
      '1': this.createDigitCanvas('1'),
      '2': this.createDigitCanvas('2'),
      '3': this.createDigitCanvas('3'),
      '4': this.createDigitCanvas('4'),
      '5': this.createDigitCanvas('5'),
      '6': this.createDigitCanvas('6'),
      '7': this.createDigitCanvas('7'),
      '8': this.createDigitCanvas('8'),
      '9': this.createDigitCanvas('9'),
      '-': this.createDigitCanvas('-')
    };
  }

  /* --- Распознавание одиночной цифры --- */
  recognizeSingleDigit(digitImage) {
    const features = digitImage.features;
    if (!features) return null;

    let bestMatch = null;
    let bestScore = -1;

    for (const [digit, tpl] of Object.entries(this.digitTemplates)) {
      const score = this.compareFeatures(features, tpl.features);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = digit;
      }
    }

    // Возвращаем объект с уверенностью в процентах
    if (bestScore >= this.matchThreshold) {
      return { digit: bestMatch, confidence: Math.round(bestScore * 100) / 100 };
    }

    return null;
  }

  /* --- Группировка/слияние/валидация (сохранена базовая логика, можно дополнять) --- */
  groupDigits(recognizedDigits) {
    // Простая кластеризация по близости — оставлена существующая логика проекта
    // Здесь можно улучшить, если нужно.
    const clusters = [];
    const used = new Set();

    for (let i = 0; i < recognizedDigits.length; i++) {
      if (used.has(i)) continue;
      const base = recognizedDigits[i];
      const cluster = [base];
      used.add(i);
      for (let j = i + 1; j < recognizedDigits.length; j++) {
        if (used.has(j)) continue;
        const other = recognizedDigits[j];
        const dx = Math.abs(base.x - other.x);
        const dy = Math.abs(base.y - other.y);
        if (dx < Math.max(base.width, other.width) * 1.2 && dy < Math.max(base.height, other.height) * 1.2) {
          cluster.push(other);
          used.add(j);
        }
      }
      clusters.push(cluster);
    }

    return clusters;
  }

  mergeDigitGroups(groups) {
    const results = [];
    for (const g of groups) {
      // Сортируем по X (лево-право), затем формир��ем строчку цифр
      g.sort((a, b) => a.x - b.x);
      const num = g.map(item => item.digit || '?').join('');
      results.push({
        digits: g,
        value: num,
        x: Math.round(g[0].x),
        y: Math.round(g[0].y)
      });
    }
    return results;
  }

  filterValidNumbers(numbers) {
    // Фильтрация по простому критерию: наличие цифры и длина > 0
    return numbers.filter(n => n.value && n.value.replace(/\?/g, '').length > 0);
  }

  groupAndValidate(recognizedDigits) {
    // Полный pipeline объединения и валидации
    const groups = this.groupDigits(recognizedDigits);
    const numbers = this.mergeDigitGroups(groups);
    const validNumbers = this.filterValidNumbers(numbers);

    validNumbers.sort((a, b) => {
      if (Math.abs(a.y - b.y) < 20) return a.x - b.x;
      return a.y - b.y;
    });

    return validNumbers;
  }
}

// Экспортируем одиночный сервис (как в оригинальном проекте удобнее)
export default new AutoOCRService();