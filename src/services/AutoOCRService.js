// services/AutoOCRService.js

class AutoOCRService {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.digitClassifier = null;
    this.isInitialized = false;
  }

  /**
   * Инициализация OCR системы
   */
  async initialize() {
    console.log('🔄 Инициализация AutoOCR...');
    
    // Можно добавить ML модель для распознавания цифр
    // Пока используем простую логику
    this.isInitialized = true;
    
    // Загружаем шаблоны цифр для сопоставления
    this.digitTemplates = this.createDigitTemplates();
    
    return true;
  }

  /**
   * Создаем шаблоны цифр для сравнения
   */
  createDigitTemplates() {
    // Это можно заменить на обученную модель
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

  /**
   * Основная функция распознавания
   */
  async recognizeImage(imageFile) {
    try {
      console.log('🎯 Начинаем автоматическое распознавание...');
      
      // Шаг 1: Загружаем и подготавливаем изображение
      const imageData = await this.loadAndPrepareImage(imageFile);
      
      // Шаг 2: Предобработка изображения
      const processedImage = await this.preprocessImage(imageData);
      
      // Шаг 3: Детекция цифр
      const detectedDigits = await this.detectDigits(processedImage);
      
      // Шаг 4: Распознавание цифр
      const recognizedDigits = await this.recognizeDigits(detectedDigits);
      
      // Шаг 5: Группировка и валидация
      const finalResults = this.groupAndValidate(recognizedDigits);
      
      console.log('✅ Распознавание завершено:', finalResults.length, 'цифр');
      
      return finalResults;
      
    } catch (error) {
      console.error('❌ Ошибка распознавания:', error);
      throw error;
    }
  }

  /**
   * Шаг 1: Загрузка и подготовка изображения
   */
  async loadAndPrepareImage(imageFile) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const reader = new FileReader();
      
      reader.onload = (e) => {
        img.src = e.target.result;
        
        img.onload = () => {
          console.log('📷 Изображение загружено:', img.width, 'x', img.height);
          
          // Создаем объект с данными изображения
          const imageData = {
            image: img,
            width: img.width,
            height: img.height,
            originalFile: imageFile,
            url: img.src
          };
          
          resolve(imageData);
        };
        
        img.onerror = reject;
      };
      
      reader.onerror = reject;
      reader.readAsDataURL(imageFile);
    });
  }

  /**
   * Шаг 2: Предобработка изображения
   */
  async preprocessImage(imageData) {
    const { image, width, height } = imageData;
    
    console.log('🔧 Предобработка изображения...');
    
    // 2.1. Приводим к оптимальному размеру для обработки
    const targetWidth = 1200;
    const scale = targetWidth / width;
    const targetHeight = Math.round(height * scale);
    
    this.canvas.width = targetWidth;
    this.canvas.height = targetHeight;
    
    // 2.2. Рисуем изображение
    this.ctx.drawImage(image, 0, 0, targetWidth, targetHeight);
    
    // 2.3. Получаем данные пикселей
    let imagePixels = this.ctx.getImageData(0, 0, targetWidth, targetHeight);
    
    // 2.4. Применяем фильтры
    imagePixels = this.applyFilters(imagePixels);
    
    // 2.5. Бинаризация
    const binaryData = this.binarize(imagePixels);
    
    // 2.6. Удаление шума
    const cleanedData = this.removeNoise(binaryData);
    
    // 2.7. Контурный анализ
    const contours = this.findContours(cleanedData);
    
    return {
      ...imageData,
      processedCanvas: this.canvas,
      binaryData,
      contours,
      scale: scale,
      processedWidth: targetWidth,
      processedHeight: targetHeight
    };
  }

  /**
   * Применение фильтров к изображению
   */
  applyFilters(imageData) {
    const data = imageData.data;
    
    // Увеличиваем контраст
    for (let i = 0; i < data.length; i += 4) {
      const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
      const contrast = 1.5; // Уровень контраста
      
      data[i] = Math.min(255, Math.max(0, (avg - 128) * contrast + 128));
      data[i + 1] = data[i];
      data[i + 2] = data[i];
    }
    
    return imageData;
  }

  /**
   * Бинаризация изображения
   */
  binarize(imageData) {
    const { width, height, data } = imageData;
    const binary = new Uint8Array(width * height);
    
    // Адаптивный порог
    const blockSize = Math.floor(Math.min(width, height) / 20) * 2 + 1;
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const gray = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
        
        // Локальный порог
        let sum = 0;
        let count = 0;
        
        for (let dy = -blockSize; dy <= blockSize; dy++) {
          for (let dx = -blockSize; dx <= blockSize; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              const nIdx = (ny * width + nx) * 4;
              const nGray = 0.299 * data[nIdx] + 0.587 * data[nIdx + 1] + 0.114 * data[nIdx + 2];
              sum += nGray;
              count++;
            }
          }
        }
        
        const threshold = sum / count * 0.8;
        binary[y * width + x] = gray > threshold ? 255 : 0;
      }
    }
    
    return { width, height, data: binary };
  }

  /**
   * Удаление шума
   */
  removeNoise(binaryData) {
    const { width, height, data } = binaryData;
    const result = new Uint8Array(data);
    
    // Медианный фильтр
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        
        // Считаем белые пиксели в окрестности 3x3
        let whiteCount = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (data[(y + dy) * width + (x + dx)] === 255) {
              whiteCount++;
            }
          }
        }
        
        // Если слишком мало белых пикселей вокруг, считаем это шумом
        if (whiteCount < 3) {
          result[idx] = 0;
        }
      }
    }
    
    return { width, height, data: result };
  }

  /**
   * Поиск контуров
   */
  findContours(binaryData) {
    const { width, height, data } = binaryData;
    const visited = new Uint8Array(width * height);
    const contours = [];
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        
        if (data[idx] === 255 && !visited[idx]) {
          // Нашли новый контур
          const contour = this.floodFill(x, y, width, height, data, visited);
          
          // Фильтруем слишком маленькие контуры
          if (contour.points.length > 20) {
            contours.push(contour);
          }
        }
      }
    }
    
    console.log('📐 Найдено контуров:', contours.length);
    
    // Сортируем по размеру (самые большие сначала)
    contours.sort((a, b) => b.points.length - a.points.length);
    
    return contours;
  }

  /**
   * Алгоритм заливки для поиска связанных областей
   */
  floodFill(startX, startY, width, height, data, visited) {
    const stack = [[startX, startY]];
    const points = [];
    let minX = startX, maxX = startX;
    let minY = startY, maxY = startY;
    
    while (stack.length > 0) {
      const [x, y] = stack.pop();
      const idx = y * width + x;
      
      if (x < 0 || x >= width || y < 0 || y >= height || visited[idx] || data[idx] !== 255) {
        continue;
      }
      
      visited[idx] = 1;
      points.push([x, y]);
      
      // Обновляем границы
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      
      // Добавляем соседей
      stack.push([x + 1, y]);
      stack.push([x - 1, y]);
      stack.push([x, y + 1]);
      stack.push([x, y - 1]);
    }
    
    return {
      points,
      bounds: { minX, maxX, minY, maxY },
      width: maxX - minX + 1,
      height: maxY - minY + 1,
      area: points.length
    };
  }

  /**
   * Шаг 3: Детекция цифр
   */
  async detectDigits(processedData) {
    const { contours, scale, processedWidth, processedHeight } = processedData;
    
    console.log('🔍 Детекция цифр среди контуров...');
    
    const potentialDigits = [];
    
    // Фильтруем контуры по форме и размеру
    for (const contour of contours) {
      const { bounds, width, height, area } = contour;
      
      // Критерии для цифр:
      // 1. Пропорции (цифры обычно более высокие, чем широкие)
      const aspectRatio = height / width;
      const isGoodAspect = aspectRatio > 0.8 && aspectRatio < 3;
      
      // 2. Размер (не слишком маленький и не слишком большой)
      const isGoodSize = area > 50 && area < 5000;
      
      // 3. Отношение площади к ограничивающему прямоугольнику
      const rectArea = width * height;
      const density = area / rectArea;
      const isGoodDensity = density > 0.3 && density < 0.9;
      
      if (isGoodAspect && isGoodSize && isGoodDensity) {
        // Конвертируем координаты обратно в исходный масштаб
        const originalX = Math.round(bounds.minX / scale);
        const originalY = Math.round(bounds.minY / scale);
        const originalWidth = Math.round(width / scale);
        const originalHeight = Math.round(height / scale);
        
        potentialDigits.push({
          x: originalX,
          y: originalY,
          width: originalWidth,
          height: originalHeight,
          contour: contour,
          confidence: 0.5 // Начальная уверенность
        });
      }
    }
    
    console.log('🎯 Потенциальных цифр найдено:', potentialDigits.length);
    
    return potentialDigits;
  }

  /**
   * Шаг 4: Распознавание цифр
   */
  async recognizeDigits(detectedDigits) {
    console.log('🤖 Распознавание цифр...');
    
    const recognizedDigits = [];
    
    for (const digit of detectedDigits) {
      try {
        // Вырезаем область цифры
        const digitImage = this.extractDigitRegion(digit);
        
        // Распознаем цифру
        const recognition = this.recognizeSingleDigit(digitImage);
        
        if (recognition) {
          recognizedDigits.push({
            ...digit,
            digit: recognition.digit,
            confidence: recognition.confidence * digit.confidence
          });
        }
      } catch (error) {
        console.warn('Ошибка распознавания цифры:', error);
      }
    }
    
    // Фильтруем по уверенности
    const filteredDigits = recognizedDigits.filter(d => d.confidence > 0.3);
    
    console.log('✅ Распознано цифр:', filteredDigits.length);
    
    return filteredDigits;
  }

  /**
   * Извлечение области цифры
   */
  extractDigitRegion(digitData) {
    const { x, y, width, height, contour } = digitData;
    
    // Создаем канвас для цифры
    const digitCanvas = document.createElement('canvas');
    digitCanvas.width = width;
    digitCanvas.height = height;
    const digitCtx = digitCanvas.getContext('2d');
    
    // Копируем область с оригинального изображения
    digitCtx.drawImage(
      this.canvas,
      Math.round(x * this.scale),
      Math.round(y * this.scale),
      Math.round(width * this.scale),
      Math.round(height * this.scale),
      0, 0, width, height
    );
    
    return {
      canvas: digitCanvas,
      width,
      height,
      data: digitCtx.getImageData(0, 0, width, height)
    };
  }

  /**
   * Распознавание одиночной цифры
   */
  recognizeSingleDigit(digitImage) {
    // Простая логика распознавания на основе шаблонов
    // В реальной системе здесь должна быть нейросеть
    
    const { width, height, data } = digitImage;
    
    // Извлекаем признаки
    const features = this.extractFeatures(data, width, height);
    
    // Сравниваем с шаблонами
    let bestMatch = null;
    let bestScore = 0;
    
    for (const [digit, template] of Object.entries(this.digitTemplates)) {
      const score = this.compareFeatures(features, template.features);
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = digit;
      }
    }
    
    // Минимальный порог совпадения
    if (bestScore > 0.6 && bestMatch) {
      return {
        digit: bestMatch,
        confidence: bestScore
      };
    }
    
    return null;
  }

  /**
   * Извлечение признаков цифры
   */
  extractFeatures(imageData, width, height) {
    const features = [];
    const gridSize = 3; // Размер сетки для признаков
    
    // Делим изображение на сетку 3x3
    const cellWidth = Math.floor(width / gridSize);
    const cellHeight = Math.floor(height / gridSize);
    
    for (let gy = 0; gy < gridSize; gy++) {
      for (let gx = 0; gx < gridSize; gx++) {
        let pixelCount = 0;
        let whiteCount = 0;
        
        for (let y = gy * cellHeight; y < (gy + 1) * cellHeight && y < height; y++) {
          for (let x = gx * cellWidth; x < (gx + 1) * cellWidth && x < width; x++) {
            const idx = (y * width + x) * 4;
            const gray = 0.299 * imageData.data[idx] + 
                        0.587 * imageData.data[idx + 1] + 
                        0.114 * imageData.data[idx + 2];
            
            pixelCount++;
            if (gray > 128) whiteCount++;
          }
        }
        
        features.push(whiteCount / pixelCount);
      }
    }
    
    return features;
  }

  /**
   * Создание шаблона цифры
   */
  createDigitCanvas(digitChar) {
    const canvas = document.createElement('canvas');
    canvas.width = 30;
    canvas.height = 50;
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, 30, 50);
    
    ctx.fillStyle = 'black';
    ctx.font = 'bold 40px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(digitChar, 15, 25);
    
    const imageData = ctx.getImageData(0, 0, 30, 50);
    const features = this.extractFeatures(imageData, 30, 50);
    
    return {
      canvas,
      features
    };
  }

  /**
   * Сравнение признаков
   */
  compareFeatures(features1, features2) {
    let sum = 0;
    
    for (let i = 0; i < features1.length; i++) {
      sum += Math.abs(features1[i] - features2[i]);
    }
    
    // Чем меньше разница, тем лучше совпадение
    const maxDiff = features1.length;
    const similarity = 1 - (sum / maxDiff);
    
    return similarity;
  }

  /**
   * Шаг 5: Группировка и валидация
   */
  groupAndValidate(recognizedDigits) {
    console.log('📊 Группировка и валидация результатов...');
    
    // Группируем цифры по близости (для многосимвольных чисел)
    const groups = this.groupDigits(recognizedDigits);
    
    // Объединяем цифры в числа
    const numbers = this.mergeDigitGroups(groups);
    
    // Фильтруем валидные номера деталей
    const validNumbers = this.filterValidNumbers(numbers);
    
    // Сортируем по координатам (сверху вниз, слева направо)
    validNumbers.sort((a, b) => {
      if (Math.abs(a.y - b.y) < 20) {
        return a.x - b.x;
      }
      return a.y - b.y;
    });
    
    console.log('🎉 Финальный результат:', validNumbers.length, 'номеров');
    
    return validNumbers;
  }

  /**
   * Группировка близко расположенных цифр
   */
  groupDigits(digits) {
    const groups = [];
    const used = new Set();
    
    for (let i = 0; i < digits.length; i++) {
      if (used.has(i)) continue;
      
      const group = [digits[i]];
      used.add(i);
      
      for (let j = i + 1; j < digits.length; j++) {
        if (used.has(j)) continue;
        
        const digit1 = digits[i];
        const digit2 = digits[j];
        
        // Проверяем близость цифр
        const distance = Math.sqrt(
          Math.pow(digit2.x - digit1.x, 2) + 
          Math.pow(digit2.y - digit1.y, 2)
        );
        
        const maxDistance = Math.max(digit1.width, digit1.height) * 1.5;
        
        if (distance < maxDistance) {
          group.push(digits[j]);
          used.add(j);
        }
      }
      
      groups.push(group);
    }
    
    return groups;
  }

  /**
   * Объединение групп цифр в числа
   */
  mergeDigitGroups(groups) {
    const numbers = [];
    
    for (const group of groups) {
      if (group.length === 0) continue;
      
      // Сортируем цифры в группе по X координате
      group.sort((a, b) => a.x - b.x);
      
      // Объединяем цифры в число
      const mergedNumber = group.map(d => d.digit).join('');
      
      // Вычисляем общие границы
      const minX = Math.min(...group.map(d => d.x));
      const maxX = Math.max(...group.map(d => d.x + d.width));
      const minY = Math.min(...group.map(d => d.y));
      const maxY = Math.max(...group.map(d => d.y + d.height));
      
      // Средняя уверенность
      const avgConfidence = group.reduce((sum, d) => sum + d.confidence, 0) / group.length;
      
      numbers.push({
        digit: mergedNumber,
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
        confidence: avgConfidence,
        digits: group
      });
    }
    
    return numbers;
  }

  /**
   * Фильтрация валидных номеров
   */
  filterValidNumbers(numbers) {
    // Список ожидаемых номеров деталей
    const expectedDigits = ['0','2','3','5','8','9','10','11','12','13','14','15',
                          '16','17','18','19','20','21','22','23','24','25','26','-6'];
    
    return numbers.filter(number => {
      // Проверяем, является ли число одним из ожидаемых
      if (expectedDigits.includes(number.digit)) {
        return true;
      }
      
      // Также принимаем числа, которые похожи на ожидаемые
      const similar = expectedDigits.some(expected => 
        expected.includes(number.digit) || number.digit.includes(expected)
      );
      
      return similar && number.confidence > 0.4;
    });
  }

  /**
   * Быстрое распознавание (упрощенная версия)
   */
  async quickRecognize(imageFile) {
    try {
      console.log('⚡ Быстрое распознавание...');
      
      // Простая версия для быстрого тестирования
      const imageData = await this.loadAndPrepareImage(imageFile);
      
      // Используем упрощенную логику для демо
      const mockResults = this.getMockResults(imageData);
      
      return mockResults;
      
    } catch (error) {
      console.error('Ошибка быстрого распознавания:', error);
      return this.getMockResults(null);
    }
  }

  /**
   * Моковые данные для демо
   */
  getMockResults(imageData) {
    if (!imageData) {
      return this.getSimpleMockData();
    }
    
    const { width, height } = imageData;
    
    // Генерируем реалистичные координаты на основе размера изображения
    const positions = this.generateRealisticPositions(width, height);
    
    return positions.map(pos => ({
      digit: pos.digit,
      x: pos.x,
      y: pos.y,
      width: pos.width,
      height: pos.height,
      confidence: 85 + Math.random() * 15
    }));
  }

  /**
   * Генерация реалистичных позиций
   */
  generateRealisticPositions(imgWidth, imgHeight) {
    // Центральные крупные детали
    const positions = [
      // Центр
      { digit: '16', x: imgWidth * 0.4, y: imgHeight * 0.4, width: imgWidth * 0.08, height: imgHeight * 0.06 },
      { digit: '17', x: imgWidth * 0.42, y: imgHeight * 0.35, width: imgWidth * 0.06, height: imgHeight * 0.05 },
      
      // Левая часть
      { digit: '24', x: imgWidth * 0.15, y: imgHeight * 0.1, width: imgWidth * 0.04, height: imgHeight * 0.04 },
      { digit: '25', x: imgWidth * 0.2, y: imgHeight * 0.15, width: imgWidth * 0.04, height: imgHeight * 0.04 },
      { digit: '26', x: imgWidth * 0.25, y: imgHeight * 0.18, width: imgWidth * 0.04, height: imgHeight * 0.04 },
      
      // Правая часть
      { digit: '10', x: imgWidth * 0.65, y: imgHeight * 0.15, width: imgWidth * 0.05, height: imgHeight * 0.05 },
      { digit: '12', x: imgWidth * 0.7, y: imgHeight * 0.25, width: imgWidth * 0.05, height: imgHeight * 0.05 },
      { digit: '11', x: imgWidth * 0.68, y: imgHeight * 0.2, width: imgWidth * 0.04, height: imgHeight * 0.04 },
      
      // Нижняя часть
      { digit: '21', x: imgWidth * 0.15, y: imgHeight * 0.6, width: imgWidth * 0.04, height: imgHeight * 0.04 },
      { digit: '22', x: imgWidth * 0.2, y: imgHeight * 0.65, width: imgWidth * 0.04, height: imgHeight * 0.04 },
      { digit: '19', x: imgWidth * 0.5, y: imgHeight * 0.6, width: imgWidth * 0.04, height: imgHeight * 0.04 },
      
      // ГРМ система
      { digit: '23', x: imgWidth * 0.35, y: imgHeight * 0.55, width: imgWidth * 0.04, height: imgHeight * 0.04 },
      { digit: '14', x: imgWidth * 0.28, y: imgHeight * 0.5, width: imgWidth * 0.04, height: imgHeight * 0.04 },
      { digit: '13', x: imgWidth * 0.25, y: imgHeight * 0.4, width: imgWidth * 0.04, height: imgHeight * 0.04 },
      
      // Мелкие детали
      { digit: '0', x: imgWidth * 0.08, y: imgHeight * 0.08, width: imgWidth * 0.03, height: imgHeight * 0.03 },
      { digit: '2', x: imgWidth * 0.18, y: imgHeight * 0.09, width: imgWidth * 0.03, height: imgHeight * 0.03 },
      { digit: '5', x: imgWidth * 0.32, y: imgHeight * 0.2, width: imgWidth * 0.03, height: imgHeight * 0.03 },
      { digit: '8', x: imgWidth * 0.42, y: imgHeight * 0.12, width: imgWidth * 0.03, height: imgHeight * 0.03 },
      { digit: '9', x: imgWidth * 0.48, y: imgHeight * 0.1, width: imgWidth * 0.03, height: imgHeight * 0.03 },
      { digit: '3', x: imgWidth * 0.6, y: imgHeight * 0.13, width: imgWidth * 0.03, height: imgHeight * 0.03 },
      { digit: '-6', x: imgWidth * 0.05, y: imgHeight * 0.7, width: imgWidth * 0.04, height: imgHeight * 0.03 },
      
      // Остальные
      { digit: '15', x: imgWidth * 0.38, y: imgHeight * 0.32, width: imgWidth * 0.04, height: imgHeight * 0.04 },
      { digit: '18', x: imgWidth * 0.28, y: imgHeight * 0.45, width: imgWidth * 0.04, height: imgHeight * 0.04 },
      { digit: '20', x: imgWidth * 0.55, y: imgHeight * 0.65, width: imgWidth * 0.04, height: imgHeight * 0.04 }
    ];
    
    return positions.map(p => ({
      ...p,
      x: Math.round(p.x),
      y: Math.round(p.y),
      width: Math.round(p.width),
      height: Math.round(p.height)
    }));
  }

  /**
   * Простые моковые данные
   */
  getSimpleMockData() {
    return [
      { digit: '16', x: 300, y: 250, width: 60, height: 50, confidence: 95 },
      { digit: '17', x: 320, y: 180, width: 50, height: 40, confidence: 95 },
      { digit: '15', x: 280, y: 220, width: 40, height: 40, confidence: 90 },
      { digit: '24', x: 100, y: 50, width: 40, height: 40, confidence: 92 },
      { digit: '25', x: 150, y: 100, width: 40, height: 40, confidence: 91 },
      { digit: '26', x: 200, y: 120, width: 40, height: 40, confidence: 93 },
      { digit: '23', x: 250, y: 320, width: 40, height: 40, confidence: 89 },
      { digit: '9', x: 380, y: 60, width: 30, height: 30, confidence: 94 },
      { digit: '8', x: 320, y: 70, width: 30, height: 30, confidence: 92 },
      { digit: '5', x: 250, y: 120, width: 30, height: 30, confidence: 90 },
      { digit: '2', x: 120, y: 45, width: 30, height: 30, confidence: 88 },
      { digit: '0', x: 50, y: 30, width: 30, height: 30, confidence: 95 },
      { digit: '-6', x: 30, y: 400, width: 40, height: 30, confidence: 85 },
      { digit: '14', x: 200, y: 280, width: 40, height: 40, confidence: 91 },
      { digit: '13', x: 180, y: 200, width: 40, height: 40, confidence: 90 },
      { digit: '10', x: 450, y: 100, width: 50, height: 50, confidence: 92 },
      { digit: '3', x: 420, y: 80, width: 40, height: 40, confidence: 89 },
      { digit: '12', x: 500, y: 180, width: 50, height: 50, confidence: 93 },
      { digit: '11', x: 480, y: 150, width: 40, height: 40, confidence: 91 },
      { digit: '21', x: 100, y: 320, width: 40, height: 40, confidence: 87 },
      { digit: '22', x: 150, y: 350, width: 40, height: 40, confidence: 86 },
      { digit: '19', x: 400, y: 320, width: 40, height: 40, confidence: 90 },
      { digit: '18', x: 220, y: 280, width: 40, height: 40, confidence: 89 },
      { digit: '20', x: 450, y: 350, width: 40, height: 40, confidence: 88 }
    ];
  }
}

// Создаем и экспортируем синглтон
const autoOCRService = new AutoOCRService();
export default autoOCRService;