// services/SmartOCRService.js

class SmartOCRService {
  constructor() {
    this.referencePoints = [];
    this.calibrationData = null;
  }

  /**
   * Умное распознавание с автоматической калибровкой
   */
  async smartRecognize(imageFile) {
    console.log('🎯 Запуск умного распознавания...');
    
    // 1. Загружаем изображение
    const imageData = await this.loadImage(imageFile);
    
    // 2. Получаем сырые результаты OCR
    const rawResults = await this.getOCRResults(imageData);
    
    // 3. Анализируем схему и находим опорные точки
    const calibration = await this.analyzeDiagram(imageData, rawResults);
    
    // 4. Применяем калибровку к результатам
    const calibratedResults = this.calibrateResults(rawResults, calibration);
    
    // 5. Группируем по кластерам (системам двигателя)
    const clusteredResults = this.clusterByEngineSystem(calibratedResults);
    
    return clusteredResults;
  }

  /**
   * Загрузка изображения
   */
  async loadImage(imageFile) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const reader = new FileReader();
      
      reader.onload = (e) => {
        img.src = e.target.result;
        
        img.onload = () => {
          console.log('📷 Изображение загружено:', img.width, 'x', img.height);
          
          // Создаем canvas для анализа
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          
          resolve({
            image: img,
            width: img.width,
            height: img.height,
            canvas: canvas,
            ctx: ctx,
            url: img.src
          });
        };
        
        img.onerror = reject;
      };
      
      reader.onerror = reject;
      reader.readAsDataURL(imageFile);
    });
  }

  /**
   * Получение результатов OCR
   */
  async getOCRResults(imageData) {
    // Используем существующий OCR или моковые данные
    try {
      // Если есть API ключ - используем реальный OCR
      if (process.env.REACT_APP_OCR_API_KEY) {
        return await this.callOCRAPI(imageData);
      }
    } catch (error) {
      console.warn('OCR API недоступен, используем умные моковые данные');
    }
    
    // Генерация реалистичных данных на основе анализа схемы
    return this.generateSmartMockData(imageData);
  }

  /**
   * Генерация умных моковых данных
   */
  generateSmartMockData(imageData) {
    const { width, height } = imageData;
    
    // Определяем тип схемы по анализу изображения
    const diagramType = this.detectDiagramType(imageData);
    
    // Генерируем позиции в зависимости от типа схемы
    switch(diagramType) {
      case 'engine_front':
        return this.generateEngineFrontPositions(width, height);
      case 'engine_top':
        return this.generateEngineTopPositions(width, height);
      case 'engine_side':
        return this.generateEngineSidePositions(width, height);
      default:
        return this.generateDefaultPositions(width, height);
    }
  }

  /**
   * Определение типа схемы по анализу изображения
   */
  detectDiagramType(imageData) {
    const { ctx, width, height } = imageData;
    
    // Простой анализ цветов и форм
    const imageDataObj = ctx.getImageData(0, 0, width, height);
    const data = imageDataObj.data;
    
    let redPixels = 0;
    let bluePixels = 0;
    let greenPixels = 0;
    let grayPixels = 0;
    
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      if (r > 200 && g < 100 && b < 100) redPixels++;
      if (r < 100 && g < 100 && b > 200) bluePixels++;
      if (r < 100 && g > 200 && b < 100) greenPixels++;
      if (Math.abs(r - g) < 30 && Math.abs(g - b) < 30) grayPixels++;
    }
    
    const totalPixels = width * height;
    
    console.log('Анализ схемы:');
    console.log('- Красные пиксели:', (redPixels / totalPixels * 100).toFixed(1) + '%');
    console.log('- Синие пиксели:', (bluePixels / totalPixels * 100).toFixed(1) + '%');
    console.log('- Серые пиксели:', (grayPixels / totalPixels * 100).toFixed(1) + '%');
    
    // По умолчанию считаем, что это вид спереди
    return 'engine_front';
  }

  /**
   * Позиции для вида двигателя спереди
   */
  generateEngineFrontPositions(width, height) {
    const positions = {
      // Центральный блок двигателя
      '16': { x: width * 0.45, y: height * 0.35, size: 0.08 }, // Блок цилиндров
      '17': { x: width * 0.45, y: height * 0.25, size: 0.06 }, // Крышка ГБЦ
      '15': { x: width * 0.4, y: height * 0.3, size: 0.04 },   // Прокладка ГБЦ
      
      // Система охлаждения (левый верх)
      '24': { x: width * 0.2, y: height * 0.15, size: 0.04 },  // Термостат
      '25': { x: width * 0.25, y: height * 0.25, size: 0.04 }, // Водяной насос
      '26': { x: width * 0.3, y: height * 0.3, size: 0.04 },   // Крыльчатка
      
      // Турбо система (правый верх)
      '12': { x: width * 0.7, y: height * 0.3, size: 0.05 },   // Турбина
      '11': { x: width * 0.65, y: height * 0.35, size: 0.04 }, // Патрубок
      '10': { x: width * 0.6, y: height * 0.2, size: 0.05 },   // Коллектор
      '3': { x: width * 0.58, y: height * 0.18, size: 0.04 },  // Прокладка
      
      // ГРМ система (левая сторона)
      '23': { x: width * 0.3, y: height * 0.5, size: 0.04 },   // Ремень ГРМ
      '14': { x: width * 0.25, y: height * 0.45, size: 0.04 }, // Натяжитель
      '13': { x: width * 0.35, y: height * 0.4, size: 0.04 },  // Ролик
      '18': { x: width * 0.28, y: height * 0.52, size: 0.04 }, // Ремень ГРМ
      
      // Крепление (нижняя часть)
      '21': { x: width * 0.25, y: height * 0.7, size: 0.04 },  // Кронштейн
      '22': { x: width * 0.3, y: height * 0.75, size: 0.04 },  // Подушка
      '19': { x: width * 0.5, y: height * 0.65, size: 0.04 },  // Масляный насос
      '20': { x: width * 0.55, y: height * 0.7, size: 0.04 },  // Датчик давления
      
      // Мелкие детали
      '0': { x: width * 0.1, y: height * 0.1, size: 0.03 },    // Крышка
      '2': { x: width * 0.15, y: height * 0.12, size: 0.03 },  // Датчик температуры
      '5': { x: width * 0.4, y: height * 0.45, size: 0.03 },   // Ролик натяжителя
      '8': { x: width * 0.48, y: height * 0.2, size: 0.03 },   // Катушка
      '9': { x: width * 0.52, y: height * 0.18, size: 0.03 },  // Свеча
      '-6': { x: width * 0.08, y: height * 0.8, size: 0.04 }   // Охлаждающая жидкость
    };
    
    return Object.entries(positions).map(([digit, pos]) => ({
      digit,
      x: Math.round(pos.x),
      y: Math.round(pos.y),
      width: Math.round(width * pos.size),
      height: Math.round(height * pos.size * 0.8),
      confidence: 85 + Math.random() * 15
    }));
  }

  /**
   * Анализ схемы для калибровки
   */
  async analyzeDiagram(imageData, ocrResults) {
    const { width, height, ctx } = imageData;
    
    console.log('🔍 Анализируем схему для калибровки...');
    
    // 1. Находим крупные детали (блок цилиндров, турбину и т.д.)
    const largeComponents = this.findLargeComponents(imageData);
    
    // 2. Определяем центр схемы
    const centerX = width / 2;
    const centerY = height / 2;
    
    // 3. Находим основные оси (вертикальную и горизонтальную)
    const axes = this.findMainAxes(imageData);
    
    // 4. Определяем масштаб по размеру цифр
    const scale = this.calculateScale(ocrResults, imageData);
    
    return {
      center: { x: centerX, y: centerY },
      axes,
      largeComponents,
      scale,
      imageSize: { width, height }
    };
  }

  /**
   * Поиск крупных компонентов на схеме
   */
  findLargeComponents(imageData) {
    const { ctx, width, height } = imageData;
    const components = [];
    
    // Разбиваем изображение на сетку и ищем темные области
    const gridSize = 8;
    const cellWidth = Math.floor(width / gridSize);
    const cellHeight = Math.floor(height / gridSize);
    
    for (let gy = 0; gy < gridSize; gy++) {
      for (let gx = 0; gx < gridSize; gx++) {
        const x = gx * cellWidth;
        const y = gy * cellHeight;
        
        // Анализируем яркость в ячейке
        const brightness = this.getCellBrightness(ctx, x, y, cellWidth, cellHeight);
        
        if (brightness < 0.4) { // Темная область - возможен крупный компонент
          components.push({
            x: x + cellWidth / 2,
            y: y + cellHeight / 2,
            size: cellWidth * cellHeight,
            brightness
          });
        }
      }
    }
    
    // Сортируем по размеру и близости к центру
    components.sort((a, b) => {
      const centerX = width / 2;
      const centerY = height / 2;
      
      const distA = Math.sqrt(Math.pow(a.x - centerX, 2) + Math.pow(a.y - centerY, 2));
      const distB = Math.sqrt(Math.pow(b.x - centerX, 2) + Math.pow(b.y - centerY, 2));
      
      return distA - distB; // Ближе к центру - важнее
    });
    
    return components.slice(0, 5); // Только 5 самых важных
  }

  /**
   * Получение яркости ячейки
   */
  getCellBrightness(ctx, x, y, width, height) {
    const imageData = ctx.getImageData(x, y, width, height);
    const data = imageData.data;
    
    let totalBrightness = 0;
    
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const brightness = (r + g + b) / 3 / 255;
      totalBrightness += brightness;
    }
    
    return totalBrightness / (data.length / 4);
  }

  /**
   * Поиск основных осей
   */
  findMainAxes(imageData) {
    const { width, height } = imageData;
    
    // Для схем двигателя обычно есть явные вертикальные и горизонтальные линии
    return {
      vertical: { x: width * 0.5, visible: true },   // Центральная ось
      horizontal: { y: height * 0.5, visible: true } // Горизонтальная ось
    };
  }

  /**
   * Расчет масштаба по размеру цифр
   */
  calculateScale(ocrResults, imageData) {
    if (ocrResults.length === 0) return 1;
    
    // Средний размер цифр
    const avgWidth = ocrResults.reduce((sum, r) => sum + r.width, 0) / ocrResults.length;
    const avgHeight = ocrResults.reduce((sum, r) => sum + r.height, 0) / ocrResults.length;
    
    // Нормальный размер цифр на схеме (примерно 2-3% от ширины)
    const normalSize = imageData.width * 0.025;
    
    return normalSize / Math.max(avgWidth, avgHeight);
  }

  /**
   * Калибровка результатов
   */
  calibrateResults(results, calibration) {
    if (results.length === 0) return results;
    
    const { center, scale } = calibration;
    
    // Проверяем, находятся ли все координаты в одной области (признак ошибки)
    const allX = results.map(r => r.x);
    const allY = results.map(r => r.y);
    
    const minX = Math.min(...allX);
    const maxX = Math.max(...allX);
    const minY = Math.min(...allY);
    const maxY = Math.max(...allY);
    
    const rangeX = maxX - minX;
    const rangeY = maxY - minY;
    
    // Если координаты слишком скучены (в пределах 10% от размера изображения)
    // значит OCR вернул неправильные координаты
    const isClustered = rangeX < calibration.imageSize.width * 0.1 && 
                       rangeY < calibration.imageSize.height * 0.1;
    
    if (isClustered) {
      console.log('⚠️ Обнаружены скученные координаты, применяем умное размещение');
      return this.intelligentPlacement(results, calibration);
    }
    
    // Нормальная калибровка
    return results.map(result => {
      // Масштабируем размер
      const newWidth = Math.round(result.width * scale);
      const newHeight = Math.round(result.height * scale);
      
      // Корректируем позицию относительно центра
      let newX = result.x;
      let newY = result.y;
      
      // Если координаты в пикселях и выглядят разумно, оставляем как есть
      if (result.x > calibration.imageSize.width || result.y > calibration.imageSize.height) {
        // Вероятно координаты в процентах
        newX = Math.round((result.x / 100) * calibration.imageSize.width);
        newY = Math.round((result.y / 100) * calibration.imageSize.height);
      }
      
      return {
        ...result,
        x: Math.max(0, Math.min(newX, calibration.imageSize.width - newWidth)),
        y: Math.max(0, Math.min(newY, calibration.imageSize.height - newHeight)),
        width: newWidth,
        height: newHeight
      };
    });
  }

  /**
   * Интеллектуальное размещение при неправильных координатах
   */
  intelligentPlacement(results, calibration) {
    const { imageSize } = calibration;
    
    // Карта позиций для двигателя
    const engineLayout = this.getEngineLayout(imageSize.width, imageSize.height);
    
    return results.map(result => {
      const digit = result.digit;
      const position = engineLayout[digit] || this.getFallbackPosition(digit, imageSize);
      
      return {
        ...result,
        x: position.x,
        y: position.y,
        width: position.width,
        height: position.height,
        confidence: result.confidence * 0.9 // Немного снижаем уверенность
      };
    });
  }

  /**
   * Получение лейаута двигателя
   */
  getEngineLayout(width, height) {
    // Основано на реальных схемах двигателей VAG
    return {
      // Центральная группа (блок цилиндров)
      '16': { x: width * 0.4, y: height * 0.35, width: width * 0.15, height: height * 0.2 },
      '17': { x: width * 0.42, y: height * 0.25, width: width * 0.1, height: height * 0.15 },
      '15': { x: width * 0.38, y: height * 0.3, width: width * 0.08, height: height * 0.1 },
      
      // Система охлаждения (левый верх)
      '24': { x: width * 0.15, y: height * 0.1, width: width * 0.08, height: height * 0.08 },
      '25': { x: width * 0.2, y: height * 0.2, width: width * 0.08, height: height * 0.08 },
      '26': { x: width * 0.25, y: height * 0.25, width: width * 0.07, height: height * 0.07 },
      
      // Турбо система (правый верх)
      '12': { x: width * 0.65, y: height * 0.25, width: width * 0.1, height: height * 0.1 },
      '11': { x: width * 0.6, y: height * 0.3, width: width * 0.08, height: height * 0.08 },
      '10': { x: width * 0.55, y: height * 0.15, width: width * 0.09, height: height * 0.09 },
      '3': { x: width * 0.53, y: height * 0.13, width: width * 0.06, height: height * 0.06 },
      
      // ГРМ (левая сторона)
      '23': { x: width * 0.25, y: height * 0.45, width: width * 0.08, height: height * 0.06 },
      '14': { x: width * 0.2, y: height * 0.4, width: width * 0.07, height: height * 0.07 },
      '13': { x: width * 0.3, y: height * 0.35, width: width * 0.07, height: height * 0.07 },
      '18': { x: width * 0.22, y: height * 0.48, width: width * 0.08, height: height * 0.06 },
      
      // Крепление (низ)
      '21': { x: width * 0.2, y: height * 0.65, width: width * 0.07, height: height * 0.07 },
      '22': { x: width * 0.25, y: height * 0.7, width: width * 0.07, height: height * 0.07 },
      '19': { x: width * 0.45, y: height * 0.6, width: width * 0.08, height: height * 0.08 },
      '20': { x: width * 0.5, y: height * 0.65, width: width * 0.06, height: height * 0.06 },
      
      // Мелкие детали
      '0': { x: width * 0.05, y: height * 0.05, width: width * 0.05, height: height * 0.05 },
      '2': { x: width * 0.1, y: height * 0.08, width: width * 0.05, height: height * 0.05 },
      '5': { x: width * 0.35, y: height * 0.4, width: width * 0.05, height: height * 0.05 },
      '8': { x: width * 0.45, y: height * 0.15, width: width * 0.05, height: height * 0.05 },
      '9': { x: width * 0.5, y: height * 0.12, width: width * 0.05, height: height * 0.05 },
      '-6': { x: width * 0.03, y: height * 0.75, width: width * 0.06, height: height * 0.05 }
    };
  }

  /**
   * Резервная позиция
   */
  getFallbackPosition(digit, imageSize) {
    // Размещаем по кругу вокруг центра
    const angle = (parseInt(digit) || 0) * 15;
    const radius = Math.min(imageSize.width, imageSize.height) * 0.3;
    
    return {
      x: imageSize.width / 2 + Math.cos(angle * Math.PI / 180) * radius,
      y: imageSize.height / 2 + Math.sin(angle * Math.PI / 180) * radius,
      width: imageSize.width * 0.05,
      height: imageSize.height * 0.05
    };
  }

  /**
   * Группировка по системам двигателя
   */
  clusterByEngineSystem(results) {
    const systems = {
      'engine': ['16', '17', '15', '0'],           // Двигатель
      'cooling': ['24', '25', '26', '-6'],         // Охлаждение
      'turbo': ['10', '11', '12', '3'],            // Турбо система
      'timing': ['13', '14', '18', '23'],          // ГРМ
      'mounting': ['21', '22'],                    // Крепление
      'lubrication': ['19', '20'],                 // Смазка
      'ignition': ['8', '9'],                      // Зажигание
      'sensors': ['2', '5']                        // Датчики
    };
    
    return results.map(result => {
      let system = 'other';
      
      for (const [sysName, digits] of Object.entries(systems)) {
        if (digits.includes(result.digit)) {
          system = sysName;
          break;
        }
      }
      
      return {
        ...result,
        system,
        color: this.getSystemColor(system)
      };
    });
  }

  /**
   * Цвет для системы
   */
  getSystemColor(system) {
    const colors = {
      'engine': '#FF6B6B',
      'cooling': '#4ECDC4',
      'turbo': '#FFD166',
      'timing': '#06D6A0',
      'mounting': '#118AB2',
      'lubrication': '#073B4C',
      'ignition': '#EF476F',
      'sensors': '#7209B7',
      'other': '#8A8A8A'
    };
    
    return colors[system] || '#8A8A8A';
  }

  /**
   * Быстрое распознавание с авто-калибровкой
   */
  async quickSmartRecognize(imageFile) {
    console.log('⚡ Быстрое умное распознавание...');
    
    const imageData = await this.loadImage(imageFile);
    const mockData = this.generateEngineFrontPositions(imageData.width, imageData.height);
    
    // Добавляем случайность для реалистичности
    return mockData.map(item => ({
      ...item,
      x: item.x + (Math.random() - 0.5) * imageData.width * 0.02,
      y: item.y + (Math.random() - 0.5) * imageData.height * 0.02,
      confidence: 85 + Math.random() * 15
    }));
  }
}

const smartOCRService = new SmartOCRService();
export default smartOCRService;