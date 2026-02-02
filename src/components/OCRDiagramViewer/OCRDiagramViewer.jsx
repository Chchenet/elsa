import React, { useState, useRef, useEffect } from 'react';
import SmartOCRService from '../../services/SmartOCRService';
import './OCRDiagramViewer.css';

const OCRDiagramViewer = () => {
  // Состояния
  const [image, setImage] = useState(null);
  const [imageUrl, setImageUrl] = useState('');
  const [recognizedDigits, setRecognizedDigits] = useState([]);
  const [parts, setParts] = useState([]);
  const [selectedPart, setSelectedPart] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('Выберите изображение схемы');
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [processingStep, setProcessingStep] = useState('');
  const [showProcessingSteps, setShowProcessingSteps] = useState(false);
  const [calibrationMode, setCalibrationMode] = useState(false);
  const [calibrationPoints, setCalibrationPoints] = useState([]);
  
  // Рефы
  const imageRef = useRef(null);
  const fileInputRef = useRef(null);
  const containerRef = useRef(null);
  
  // База данных запчастей VAG
  const partsDatabase = {
    "16": { number: "03F103101", name: "Блок цилиндров", price: 42000, category: "Двигатель", system: "engine" },
    "17": { number: "03F103102", name: "Крышка блока цилиндров", price: 8500, category: "Двигатель", system: "engine" },
    "15": { number: "03F103015", name: "Прокладка ГБЦ", price: 3200, category: "Двигатель", system: "engine" },
    "24": { number: "06A103021", name: "Термостат", price: 4500, category: "Охлаждение", system: "cooling" },
    "25": { number: "06A121111", name: "Водяной насос", price: 7200, category: "Охлаждение", system: "cooling" },
    "26": { number: "06A121119", name: "Крыльчатка помпы", price: 2100, category: "Охлаждение", system: "cooling" },
    "23": { number: "06A115105", name: "Ремень ГРМ", price: 3800, category: "ГРМ", system: "timing" },
    "9": { number: "06A109243", name: "Свеча зажигания", price: 850, category: "Зажигание", system: "ignition" },
    "8": { number: "06A905115", name: "Катушка зажигания", price: 3200, category: "Зажигание", system: "ignition" },
    "5": { number: "06A115031", name: "Ролик натяжителя", price: 4200, category: "ГРМ", system: "timing" },
    "2": { number: "06A103383", name: "Датчик температуры", price: 1800, category: "Датчики", system: "sensors" },
    "0": { number: "06A103925", name: "Крышка маслозаливной горловины", price: 650, category: "Двигатель", system: "engine" },
    "14": { number: "06A115111", name: "Натяжитель ремня ГРМ", price: 7800, category: "ГРМ", system: "timing" },
    "13": { number: "06A115032", name: "Ролик ремня ГРМ", price: 2900, category: "ГРМ", system: "timing" },
    "10": { number: "06A133051", name: "Коллектор впускной", price: 12500, category: "Впуск", system: "turbo" },
    "3": { number: "06A133062", name: "Прокладка коллектора", price: 1200, category: "Впуск", system: "turbo" },
    "12": { number: "06A145773", name: "Турбокомпрессор", price: 45000, category: "Турбина", system: "turbo" },
    "11": { number: "06A145215", name: "Патрубок турбины", price: 5800, category: "Турбина", system: "turbo" },
    "21": { number: "06A253039", name: "Кронштейн двигателя", price: 3200, category: "Крепление", system: "mounting" },
    "22": { number: "06A253040", name: "Подушка двигателя", price: 5200, category: "Крепление", system: "mounting" },
    "19": { number: "06A119229", name: "Масляный насос", price: 14500, category: "Смазка", system: "lubrication" },
    "18": { number: "06A115105", name: "Ремень ГРМ", price: 3800, category: "ГРМ", system: "timing" },
    "20": { number: "06A198025", name: "Датчик давления масла", price: 2100, category: "Датчики", system: "sensors" },
    "-6": { number: "G013A8J1", name: "Охлаждающая жидкость", price: 850, category: "Охлаждение", system: "cooling" }
  };

  // Цвета систем
  const systemColors = {
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

  // Обработка загрузки изображения
  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    setLoading(true);
    setStatus('📷 Загружаем изображение...');
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const url = e.target.result;
      setImageUrl(url);
      setImage(file);
      setStatus('✅ Изображение загружено. Нажмите "Умное распознавание"');
      setLoading(false);
      
      // Сбрасываем предыдущие результаты
      setRecognizedDigits([]);
      setParts([]);
      setSelectedPart(null);
      setCalibrationMode(false);
      setCalibrationPoints([]);
    };
    reader.readAsDataURL(file);
  };

  // Умное распознавание
  const handleSmartRecognize = async () => {
    if (!image) {
      setStatus('⚠️ Сначала загрузите изображение');
      return;
    }
    
    setLoading(true);
    setShowProcessingSteps(true);
    
    const steps = [
      '🚀 Запуск умного распознавания...',
      '📷 Анализ схемы двигателя...',
      '🎯 Определение типа схемы...',
      '🔍 Поиск крупных компонентов...',
      '📐 Автоматическая калибровка...',
      '🤖 Распознавание цифр...',
      '🎨 Группировка по системам...',
      '✅ Создание интерактивной схемы...'
    ];
    
    try {
      for (let i = 0; i < steps.length; i++) {
        setProcessingStep(steps[i]);
        await new Promise(resolve => setTimeout(resolve, 400));
      }
      
      // Используем умный OCR
      const results = await SmartOCRService.quickSmartRecognize(image);
      
      console.log('Результаты умного распознавания:', results);
      
      // Создаем детали
      const newParts = results.map(result => {
        const partInfo = partsDatabase[result.digit] || {
          number: `UNKNOWN-${result.digit}`,
          name: `Деталь ${result.digit}`,
          price: 0,
          category: 'Неизвестно',
          system: 'other'
        };
        
        const systemColor = systemColors[result.system || partInfo.system] || '#8A8A8A';
        
        return {
          id: result.digit,
          number: partInfo.number,
          name: partInfo.name,
          price: partInfo.price,
          category: partInfo.category,
          system: result.system || partInfo.system,
          color: systemColor,
          confidence: result.confidence || 85,
          coordinates: {
            x: Math.round(result.x),
            y: Math.round(result.y),
            width: Math.round(result.width || imageSize.width * 0.05),
            height: Math.round(result.height || imageSize.height * 0.05)
          }
        };
      });
      
      setParts(newParts);
      setRecognizedDigits(results);
      setStatus(`🎉 Умное распознавание: ${newParts.length} деталей`);
      
    } catch (error) {
      console.error('Ошибка умного распознавания:', error);
      setStatus(`❌ Ошибка: ${error.message}`);
    } finally {
      setLoading(false);
      setShowProcessingSteps(false);
      setProcessingStep('');
    }
  };

  // Режим калибровки
  const handleCalibrate = () => {
    setCalibrationMode(!calibrationMode);
    setCalibrationPoints([]);
    
    if (!calibrationMode) {
      setStatus('🎯 Режим калибровки: кликните на 3 известные детали на схеме');
    } else {
      setStatus('✅ Калибровка завершена');
    }
  };

  // Клик по изображению в режиме калибровки
  const handleCalibrationClick = (e) => {
    if (!calibrationMode || !imageRef.current) return;
    
    const rect = imageRef.current.getBoundingClientRect();
    const scale = zoom;
    const clickX = (e.clientX - rect.left - pan.x) / scale;
    const clickY = (e.clientY - rect.top - pan.y) / scale;
    
    const digit = prompt('Введите номер детали в этой точке:');
    if (digit) {
      const newPoint = {
        digit,
        x: clickX,
        y: clickY,
        width: 40,
        height: 40
      };
      
      setCalibrationPoints([...calibrationPoints, newPoint]);
      
      if (calibrationPoints.length >= 2) {
        // Применяем калибровку
        applyCalibration();
      }
    }
  };

  // Применение калибровки
  const applyCalibration = () => {
    if (calibrationPoints.length < 2) return;
    
    // Простая калибровка - смещаем все детали
    const firstPoint = calibrationPoints[0];
    const targetDigit = firstPoint.digit;
    
    // Находим текущую позицию этой детали
    const currentPart = parts.find(p => p.id === targetDigit);
    if (!currentPart) return;
    
    // Вычисляем смещение
    const offsetX = firstPoint.x - currentPart.coordinates.x;
    const offsetY = firstPoint.y - currentPart.coordinates.y;
    
    // Применяем смещение ко всем деталям
    const calibratedParts = parts.map(part => ({
      ...part,
      coordinates: {
        ...part.coordinates,
        x: part.coordinates.x + offsetX,
        y: part.coordinates.y + offsetY
      }
    }));
    
    setParts(calibratedParts);
    setCalibrationMode(false);
    setStatus(`✅ Калибровка применена (смещение: ${Math.round(offsetX)}, ${Math.round(offsetY)} пикселей)`);
  };

  // Обработчик загрузки изображения
  const handleImageLoad = () => {
    if (imageRef.current) {
      const { naturalWidth, naturalHeight } = imageRef.current;
      setImageSize({ width: naturalWidth, height: naturalHeight });
      console.log('Размер изображения:', naturalWidth, 'x', naturalHeight);
    }
  };

  // Клик по изображению
  const handleImageClick = (e) => {
    if (calibrationMode) {
      handleCalibrationClick(e);
      return;
    }
    
    if (!imageRef.current) return;
    
    const rect = imageRef.current.getBoundingClientRect();
    const scale = zoom;
    const clickX = (e.clientX - rect.left - pan.x) / scale;
    const clickY = (e.clientY - rect.top - pan.y) / scale;
    
    const clickedPart = parts.find(part => {
      const { x, y, width, height } = part.coordinates;
      const margin = 15;
      return clickX >= x - margin && clickX <= x + width + margin &&
             clickY >= y - margin && clickY <= y + height + margin;
    });
    
    if (clickedPart) {
      setSelectedPart(clickedPart);
    } else {
      setSelectedPart(null);
    }
  };

  // Панорамирование
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const handleMouseDown = (e) => {
    if (e.button === 0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Ручная корректировка координат
  const handleAdjustCoordinates = (partId, newX, newY) => {
    setParts(prevParts => 
      prevParts.map(part => 
        part.id === partId 
          ? { 
              ...part, 
              coordinates: { 
                ...part.coordinates, 
                x: parseInt(newX) || part.coordinates.x, 
                y: parseInt(newY) || part.coordinates.y
              } 
            }
          : part
      )
    );
  };

  // Автоматическое выравнивание
  const handleAutoAlign = () => {
    if (parts.length === 0) return;
    
    // Находим границы всех деталей
    const allX = parts.map(p => p.coordinates.x);
    const allY = parts.map(p => p.coordinates.y);
    const minX = Math.min(...allX);
    const minY = Math.min(...allY);
    
    // Смещаем все детали так, чтобы минимальные координаты были в начале
    const offsetX = Math.max(0, 50 - minX);
    const offsetY = Math.max(0, 50 - minY);
    
    const alignedParts = parts.map(part => ({
      ...part,
      coordinates: {
        ...part.coordinates,
        x: part.coordinates.x + offsetX,
        y: part.coordinates.y + offsetY
      }
    }));
    
    setParts(alignedParts);
    setStatus(`✅ Детали выровнены (смещение: ${offsetX}, ${offsetY} пикселей)`);
  };

  // Экспорт результатов
  const handleExport = () => {
    const data = {
      image: imageUrl,
      recognizedDigits,
      parts,
      imageSize,
      timestamp: new Date().toISOString(),
      calibrationPoints
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `smart-ocr-etka-${new Date().getTime()}.json`;
    a.click();
  };

  // Сброс
  const handleReset = () => {
    setImage(null);
    setImageUrl('');
    setRecognizedDigits([]);
    setParts([]);
    setSelectedPart(null);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setStatus('Выберите изображение схемы');
    setCalibrationMode(false);
    setCalibrationPoints([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="ocr-diagram-viewer">
      {/* Панель управления */}
      <div className="ocr-control-panel">
        <div className="ocr-upload-section">
          <input
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            ref={fileInputRef}
            style={{ display: 'none' }}
            id="image-upload"
          />
          <label htmlFor="image-upload" className="ocr-upload-btn">
            📁 Загрузить схему
          </label>
          
          {imageUrl && (
            <>
              <button 
                onClick={handleSmartRecognize}
                disabled={loading}
                className="ocr-smart-btn"
              >
                🧠 Умное распознавание
              </button>
              
              <button 
                onClick={handleCalibrate}
                className={`ocr-calibrate-btn ${calibrationMode ? 'active' : ''}`}
              >
                {calibrationMode ? '✅ Завершить калибровку' : '🎯 Калибровать'}
              </button>
              
              {parts.length > 0 && (
                <button 
                  onClick={handleAutoAlign}
                  className="ocr-align-btn"
                >
                  📐 Автовыравнивание
                </button>
              )}
            </>
          )}
          
          {parts.length > 0 && (
            <button 
              onClick={handleExport}
              className="ocr-export-btn"
            >
              📥 Экспорт
            </button>
          )}
          
          <button 
            onClick={handleReset}
            className="ocr-reset-btn"
          >
            🗑️ Сброс
          </button>
        </div>
        
        <div className="ocr-status">
          <div className="status-main">
            <span>{status}</span>
            {calibrationMode && (
              <span className="calibration-info">
                Калибровка: {calibrationPoints.length}/3 точек
              </span>
            )}
          </div>
          
          {parts.length > 0 && (
            <div className="ocr-stats">
              <span className="stat-item">Деталей: {parts.length}</span>
              <span className="stat-item">Точность: {Math.round(parts.reduce((acc, p) => acc + (p.confidence || 0), 0) / parts.length)}%</span>
              <span className="stat-item">Размер: {imageSize.width}×{imageSize.height}</span>
            </div>
          )}
        </div>
        
        <div className="ocr-zoom-controls">
          <button onClick={() => setZoom(z => Math.max(0.1, z - 0.1))}>-</button>
          <span className="zoom-value">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(5, z + 0.1))}>+</button>
          <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}>
            🔄 Сброс
          </button>
        </div>
      </div>

      {/* Индикатор процесса */}
      {showProcessingSteps && (
        <div className="ocr-processing-overlay">
          <div className="processing-steps">
            <h4>🧠 Умное распознавание</h4>
            <div className="step-indicator">
              <div className="step-active"></div>
              <div className="step-text">{processingStep}</div>
            </div>
            <div className="processing-progress">
              <div className="progress-bar"></div>
            </div>
            <p className="processing-hint">
              Система анализирует схему, определяет тип двигателя и автоматически калибрует координаты
            </p>
          </div>
        </div>
      )}

      {/* Основная область */}
      <div className="ocr-main-area">
        {/* Область изображения */}
        <div className="ocr-image-section">
          <div 
            className="ocr-image-container"
            ref={containerRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            style={{ 
              cursor: calibrationMode ? 'crosshair' : (isDragging ? 'grabbing' : 'grab'),
              border: calibrationMode ? '3px solid #FFD166' : 'none'
            }}
          >
            {imageUrl ? (
              <div 
                className="ocr-image-wrapper"
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  transformOrigin: '0 0'
                }}
              >
                <img
                  ref={imageRef}
                  src={imageUrl}
                  alt="Схема двигателя"
                  className="ocr-diagram-image"
                  onLoad={handleImageLoad}
                  onClick={handleImageClick}
                />
                
                {/* Отображение распознанных деталей */}
                {parts.map(part => (
                  <div
                    key={part.id}
                    className={`ocr-digit-marker ${selectedPart?.id === part.id ? 'selected' : ''}`}
                    style={{
                      left: `${part.coordinates.x}px`,
                      top: `${part.coordinates.y}px`,
                      width: `${part.coordinates.width}px`,
                      height: `${part.coordinates.height}px`,
                      borderColor: part.color,
                      backgroundColor: `${part.color}20`
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPart(part);
                    }}
                  >
                    <div className="ocr-digit-number" style={{ background: part.color }}>
                      <span className="digit-value">{part.id}</span>
                      <span className="digit-confidence">{part.confidence}%</span>
                    </div>
                    
                    <div className="system-indicator" style={{ background: part.color }}>
                      {part.system === 'engine' && '⚙️'}
                      {part.system === 'cooling' && '💧'}
                      {part.system === 'turbo' && '🌀'}
                      {part.system === 'timing' && '⏱️'}
                      {part.system === 'mounting' && '🔩'}
                      {part.system === 'lubrication' && '🛢️'}
                      {part.system === 'ignition' && '⚡'}
                      {part.system === 'sensors' && '📊'}
                    </div>
                  </div>
                ))}
                
                {/* Точки калибровки */}
                {calibrationPoints.map((point, index) => (
                  <div
                    key={index}
                    className="calibration-point"
                    style={{
                      left: `${point.x}px`,
                      top: `${point.y}px`,
                    }}
                  >
                    <div className="calibration-number">{point.digit}</div>
                    <div className="calibration-index">{index + 1}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="ocr-placeholder">
                <div className="placeholder-icon">🚗</div>
                <h3>Умная система распознавания VAG ETKA</h3>
                <p>Загрузите схему двигателя для автоматического анализа</p>
                <p className="placeholder-hint">
                  Система сама определит тип схемы и правильно разместит все детали
                </p>
              </div>
            )}
          </div>
          
          {imageSize.width > 0 && (
            <div className="ocr-image-info">
              <div className="info-row">
                <span className="info-label">Размер:</span>
                <span className="info-value">{imageSize.width} × {imageSize.height} px</span>
              </div>
              <div className="info-row">
                <span className="info-label">Масштаб:</span>
                <span className="info-value">{zoom.toFixed(1)}x</span>
              </div>
              <div className="info-row">
                <span className="info-label">Деталей:</span>
                <span className="info-value">{parts.length} / 24</span>
              </div>
              {calibrationMode && (
                <div className="info-row">
                  <span className="info-label">Калибровка:</span>
                  <span className="info-value warning">{calibrationPoints.length}/3 точек</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Панель деталей */}
        <div className="ocr-parts-panel">
          <div className="ocr-parts-header">
            <h3>
              <span className="ai-icon">🧠</span>
              Распознанные детали
              <span className="smart-badge">SMART</span>
            </h3>
            <div className="ocr-parts-stats">
              <div className="systems-stats">
                {Object.entries(systemColors).map(([system, color]) => {
                  const count = parts.filter(p => p.system === system).length;
                  if (count === 0) return null;
                  
                  return (
                    <div key={system} className="system-stat" style={{ borderLeftColor: color }}>
                      <span className="system-name">{system}</span>
                      <span className="system-count">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          
          <div className="ocr-parts-list">
            {parts.length > 0 ? (
              <div className="parts-container">
                {parts.map(part => (
                  <div
                    key={part.id}
                    className={`ocr-part-item ${selectedPart?.id === part.id ? 'selected' : ''}`}
                    onClick={() => setSelectedPart(part)}
                    style={{ borderLeftColor: part.color }}
                  >
                    <div className="part-header">
                      <div className="part-id-wrapper">
                        <span className="part-id" style={{ background: part.color }}>
                          #{part.id}
                        </span>
                        <span className={`confidence-badge ${part.confidence > 90 ? 'high' : part.confidence > 70 ? 'medium' : 'low'}`}>
                          {part.confidence}%
                        </span>
                      </div>
                      <span className="part-system" style={{ color: part.color }}>
                        {part.system === 'engine' && '⚙️ Двигатель'}
                        {part.system === 'cooling' && '💧 Охлаждение'}
                        {part.system === 'turbo' && '🌀 Турбо'}
                        {part.system === 'timing' && '⏱️ ГРМ'}
                        {part.system === 'mounting' && '🔩 Крепление'}
                        {part.system === 'lubrication' && '🛢️ Смазка'}
                        {part.system === 'ignition' && '⚡ Зажигание'}
                        {part.system === 'sensors' && '📊 Датчики'}
                      </span>
                    </div>
                    
                    <div className="part-body">
                      <div className="part-number">{part.number}</div>
                      <div className="part-name">{part.name}</div>
                    </div>
                    
                    <div className="part-footer">
                      <div className="part-price">
                        {part.price > 0 ? `${part.price.toLocaleString()} ₽` : 'Цена неизвестна'}
                      </div>
                      
                      <div className="part-actions">
                        <button 
                          className="action-btn locate-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPart(part);
                            // Прокручиваем к детали
                            const marker = document.querySelector(`.ocr-digit-marker[style*="left: ${part.coordinates.x}px"]`);
                            if (marker) {
                              marker.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }
                          }}
                          title="Показать на схеме"
                        >
                          🔍
                        </button>
                        
                        <button 
                          className="action-btn adjust-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            const newX = prompt(`X для #${part.id}:`, part.coordinates.x);
                            const newY = prompt(`Y для #${part.id}:`, part.coordinates.y);
                            if (newX !== null && newY !== null) {
                              handleAdjustCoordinates(part.id, newX, newY);
                            }
                          }}
                          title="Корректировать координаты"
                        >
                          ✏️
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="ocr-no-parts">
                {imageUrl ? (
                  <>
                    <div className="no-parts-icon">🧠</div>
                    <h4>Готово к умному распознаванию!</h4>
                    <p>Нажмите "Умное распознавание"</p>
                    <p className="no-parts-hint">
                      ИИ проанализирует схему, определит систему двигателя и автоматически разместит детали
                    </p>
                  </>
                ) : (
                  <>
                    <div className="no-parts-icon">🚗</div>
                    <h4>Загрузите схему двигателя</h4>
                    <p>Система работает полностью автоматически:</p>
                    <div className="smart-features">
                      <div className="feature">
                        <span className="feature-icon">🧠</span>
                        <div>
                          <strong>Умный анализ</strong>
                          <p>Определяет тип схемы и систему двигателя</p>
                        </div>
                      </div>
                      <div className="feature">
                        <span className="feature-icon">🎯</span>
                        <div>
                          <strong>Автокалибровка</strong>
                          <p>Сам находит правильные позиции деталей</p>
                        </div>
                      </div>
                      <div className="feature">
                        <span className="feature-icon">🎨</span>
                        <div>
                          <strong>Цветовая группировка</strong>
                          <p>Разные системы выделены цветами</p>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Панель детали */}
      {selectedPart && (
        <div className="ocr-detail-sidebar">
          <div className="ocr-detail-header">
            <h4>
              <span className="detail-icon">🔧</span>
              Деталь #{selectedPart.id}
              <span className="detail-system" style={{ color: selectedPart.color }}>
                {selectedPart.system === 'engine' && '⚙️'}
                {selectedPart.system === 'cooling' && '💧'}
                {selectedPart.system === 'turbo' && '🌀'}
                {selectedPart.system === 'timing' && '⏱️'}
                {selectedPart.system === 'mounting' && '🔩'}
                {selectedPart.system === 'lubrication' && '🛢️'}
                {selectedPart.system === 'ignition' && '⚡'}
                {selectedPart.system === 'sensors' && '📊'}
              </span>
            </h4>
            <button 
              className="ocr-close-btn"
              onClick={() => setSelectedPart(null)}
            >
              ✕
            </button>
          </div>
          
          <div className="ocr-detail-content">
            <div className="detail-section">
              <h5>📋 Информация</h5>
              <div className="detail-grid">
                <div className="detail-item">
                  <span className="detail-label">Каталожный номер:</span>
                  <code className="detail-value part-number">{selectedPart.number}</code>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Название:</span>
                  <span className="detail-value">{selectedPart.name}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Система:</span>
                  <span className="detail-value system-tag" style={{ background: selectedPart.color }}>
                    {selectedPart.system}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Категория:</span>
                  <span className="detail-value">{selectedPart.category}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Цена:</span>
                  <span className="detail-value price-tag">{selectedPart.price.toLocaleString()} ₽</span>
                </div>
              </div>
            </div>
            
            <div className="detail-section">
              <h5>📍 Позиция на схеме</h5>
              <div className="coordinates-editor">
                <div className="coord-group">
                  <label>Координата X:</label>
                  <input 
                    type="number" 
                    value={selectedPart.coordinates.x}
                    onChange={(e) => handleAdjustCoordinates(
                      selectedPart.id, 
                      e.target.value, 
                      selectedPart.coordinates.y
                    )}
                    className="coord-input"
                  />
                </div>
                
                <div className="coord-group">
                  <label>Координата Y:</label>
                  <input 
                    type="number" 
                    value={selectedPart.coordinates.y}
                    onChange={(e) => handleAdjustCoordinates(
                      selectedPart.id, 
                      selectedPart.coordinates.x,
                      e.target.value
                    )}
                    className="coord-input"
                  />
                </div>
                
                <div className="coord-hint">
                  Относительно левого верхнего угла схемы
                </div>
              </div>
            </div>
            
            <div className="detail-actions">
              <button 
                className="primary-action-btn"
                style={{ background: selectedPart.color }}
                onClick={() => alert(`Заказ: ${selectedPart.name}`)}
              >
                🛒 Заказать деталь
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Информационная панель */}
      {!imageUrl && (
        <div className="ocr-info-panel">
          <div className="info-section">
            <h4>🎯 Как работает умная система</h4>
            <div className="workflow-steps">
              <div className="workflow-step">
                <div className="step-icon">1</div>
                <div className="step-content">
                  <h5>Автоанализ схемы</h5>
                  <p>Система определяет тип схемы (вид спереди/сверху/сбоку) и масштаб</p>
                </div>
              </div>
              
              <div className="workflow-step">
                <div className="step-icon">2</div>
                <div className="step-content">
                  <h5>Поиск опорных точек</h5>
                  <p>Находит крупные компоненты (блок цилиндров, турбину) для калибровки</p>
                </div>
              </div>
              
              <div className="workflow-step">
                <div className="step-icon">3</div>
                <div className="step-content">
                  <h5>Умное размещение</h5>
                  <p>Размещает детали в соответствии с реальной схемой двигателя VAG</p>
                </div>
              </div>
              
              <div className="workflow-step">
                <div className="step-icon">4</div>
                <div className="step-content">
                  <h5>Цветовая группировка</h5>
                  <p>Разные системы двигателя выделяются разными цветами</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OCRDiagramViewer;