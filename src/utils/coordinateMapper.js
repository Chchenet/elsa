/**
 * Класс для сопоставления распознанных цифр с реальными координатами на схеме
 */
class CoordinateMapper {
  /**
   * Карта типичных позиций для схемы двигателя VAG
   * Эти координаты основаны на типичной схеме 649103010
   */
  static getEngineDiagramTemplate() {
    return {
      // Верхняя часть (система охлаждения)
      '24': { x: 500, y: 50, width: 40, height: 40 },   // Термостат
      '25': { x: 550, y: 100, width: 50, height: 50 },  // Водяной насос
      '26': { x: 600, y: 120, width: 40, height: 40 },  // Крыльчатка
      
      // Левая часть (впуск/выпуск)
      '10': { x: 450, y: 100, width: 50, height: 50 },  // Коллектор
      '11': { x: 520, y: 150, width: 50, height: 50 },  // Патрубок турбины
      '12': { x: 580, y: 180, width: 60, height: 60 },  // Турбокомпрессор
      '3': { x: 480, y: 80, width: 40, height: 40 },    // Прокладка
      
      // Центр (двигатель)
      '16': { x: 300, y: 250, width: 100, height: 80 }, // Блок цилиндров
      '17': { x: 320, y: 200, width: 80, height: 60 },  // Крышка ГБЦ
      '15': { x: 280, y: 180, width: 40, height: 40 },  // Прокладка ГБЦ
      
      // Правая часть (ГРМ)
      '23': { x: 220, y: 320, width: 40, height: 40 },  // Ремень ГРМ
      '14': { x: 180, y: 280, width: 50, height: 50 },  // Натяжитель
      '13': { x: 200, y: 200, width: 40, height: 40 },  // Ролик ГРМ
      '18': { x: 240, y: 260, width: 40, height: 40 },  // Ремень ГРМ (другой)
      
      // Нижняя часть
      '19': { x: 400, y: 280, width: 50, height: 50 },  // Масляный насос
      '20': { x: 450, y: 320, width: 40, height: 40 },  // Датчик давления
      '21': { x: 80, y: 320, width: 40, height: 40 },   // Кронштейн
      '22': { x: 120, y: 350, width: 50, height: 50 },  // Подушка
      '-6': { x: 30, y: 400, width: 60, height: 40 },   // Охлаждающая жидкость
      
      // Мелкие детали
      '0': { x: 50, y: 30, width: 40, height: 40 },     // Крышка заливной
      '2': { x: 120, y: 45, width: 40, height: 40 },    // Датчик температуры
      '5': { x: 250, y: 120, width: 40, height: 40 },   // Ролик
      '8': { x: 320, y: 70, width: 40, height: 40 },    // Катушка
      '9': { x: 380, y: 60, width: 40, height: 40 }     // Свеча
    };
  }

  /**
   * Автоматическая привязка распознанных цифр к шаблону
   * @param {Array} ocrResults - Результаты от OCR
   * @param {number} imageWidth - Ширина изображения
   * @param {number} imageHeight - Высота изображения
   * @returns {Array} - Детали с корректными координатами
   */
  static mapToTemplate(ocrResults, imageWidth, imageHeight) {
    const template = this.getEngineDiagramTemplate();
    const mappedResults = [];

    ocrResults.forEach(ocrResult => {
      const digit = ocrResult.digit;
      
      if (template[digit]) {
        // Берем координаты из шаблона
        const templateCoords = template[digit];
        
        // Масштабируем координаты под текущее изображение
        const scaledCoords = this.scaleCoordinates(
          templateCoords,
          imageWidth,
          imageHeight
        );
        
        mappedResults.push({
          ...ocrResult,
          x: scaledCoords.x,
          y: scaledCoords.y,
          width: scaledCoords.width,
          height: scaledCoords.height,
          source: 'template' // Отметка что координаты из шаблона
        });
      } else {
        // Если цифры нет в шаблоне, используем координаты от OCR
        // и масштабируем их
        const scaledCoords = this.scaleCoordinates(
          { x: ocrResult.x, y: ocrResult.y, width: ocrResult.width, height: ocrResult.height },
          imageWidth,
          imageHeight
        );
        
        mappedResults.push({
          ...ocrResult,
          x: scaledCoords.x,
          y: scaledCoords.y,
          width: scaledCoords.width,
          height: scaledCoords.height,
          source: 'ocr'
        });
      }
    });

    return mappedResults;
  }

  /**
   * Масштабирование координат под размер изображения
   */
  static scaleCoordinates(coords, imageWidth, imageHeight) {
    // Базовые размеры для шаблона (размер типичной схемы)
    const templateWidth = 800;
    const templateHeight = 600;
    
    // Коэффициенты масштабирования
    const scaleX = imageWidth / templateWidth;
    const scaleY = imageHeight / templateHeight;
    
    return {
      x: Math.round(coords.x * scaleX),
      y: Math.round(coords.y * scaleY),
      width: Math.round(coords.width * scaleX),
      height: Math.round(coords.height * scaleY)
    };
  }

  /**
   * Группировка цифр по кластерам для автоматического позиционирования
   */
  static clusterDigits(ocrResults, imageWidth, imageHeight) {
    if (ocrResults.length === 0) return [];
    
    // Создаем кластеры по координатам Y (вертикальное положение)
    const clusters = {};
    
    ocrResults.forEach(result => {
      // Определяем вертикальную зону (верх, середина, низ)
      const zone = this.getVerticalZone(result.y, imageHeight);
      
      if (!clusters[zone]) {
        clusters[zone] = [];
      }
      
      clusters[zone].push(result);
    });
    
    // Сортируем цифры внутри каждого кластера по X координате
    Object.keys(clusters).forEach(zone => {
      clusters[zone].sort((a, b) => a.x - b.x);
    });
    
    return clusters;
  }

  /**
   * Определение вертикальной зоны
   */
  static getVerticalZone(y, height) {
    const zoneHeight = height / 3;
    
    if (y < zoneHeight) return 'top';
    if (y < zoneHeight * 2) return 'middle';
    return 'bottom';
  }

  /**
   * Ручная корректировка координат через интерфейс
   */
  static adjustCoordinateManually(currentCoords, adjustment) {
    return {
      x: currentCoords.x + (adjustment.dx || 0),
      y: currentCoords.y + (adjustment.dy || 0),
      width: currentCoords.width * (adjustment.scale || 1),
      height: currentCoords.height * (adjustment.scale || 1)
    };
  }

  /**
   * Экспорт координат в формат для сохранения
   */
  static exportCoordinates(results, imageInfo) {
    return {
      version: '1.0',
      image: imageInfo,
      coordinates: results.map(r => ({
        digit: r.digit,
        x: r.x,
        y: r.y,
        width: r.width,
        height: r.height,
        confidence: r.confidence,
        source: r.source
      })),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Импорт сохраненных координат
   */
  static importCoordinates(data) {
    return data.coordinates;
  }
}

export default CoordinateMapper;