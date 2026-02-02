import React, { useState, useRef, useEffect } from 'react';
import SmartOCRService from '../../services/SmartOCRService';
import AutoOCRService from '../../services/AutoOCRService';
import './OCRDiagramViewer.css';

// Компонент для просмотра и умного распознавания схемы
const OCRDiagramViewer = () => {
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

  const imageRef = useRef(null);
  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    // Если у нас есть внутренний канвас для обработки, установим его в AutoOCRService
    if (canvasRef.current) {
      AutoOCRService.setCanvas(canvasRef.current, 1);
    }
  }, [canvasRef.current]);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setStatus('📷 Загружаем изображение...');
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target.result;
      setImageUrl(url);
      setImage(file);
      setStatus('✅ Изображение загружено. Нажмите "Умное распознавание"');
      setLoading(false);

      setRecognizedDigits([]);
      setParts([]);
      setSelectedPart(null);
    };
    reader.readAsDataURL(file);
  };

  const handleImageLoad = () => {
    if (!imageRef.current) return;

    // ВАЖНО: используем naturalWidth/naturalHeight чтобы получать реальные пиксели исходного изображения
    const natW = imageRef.current.naturalWidth || imageRef.current.width;
    const natH = imageRef.current.naturalHeight || imageRef.current.height;

    setImageSize({ width: natW, height: natH });

    // Подготавливаем внутренний канвас для AutoOCRService с тем же натуральным размером
    const canvas = document.createElement('canvas');
    canvas.width = natW;
    canvas.height = natH;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, natW, natH);
    ctx.drawImage(imageRef.current, 0, 0, natW, natH);

    // Сохраняем канвас в ref и в AutoOCRService
    canvasRef.current = canvas;
    AutoOCRService.setCanvas(canvas, 1); // масштаб 1: координаты OCR должны быть в натуральных пикселях
  };

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
        // небольшая задержка для UX
        // eslint-disable-next-line no-await-in-loop
        await new Promise(resolve => setTimeout(resolve, 180));
      }

      // Используем SmartOCRService для предварительного анализа и OCR
      const results = await SmartOCRService.quickSmartRecognize(image);

      console.log('Результаты умного распознавания (raw):', results);

      // ОЖИДАНИЕ: SmartOCRService.quickSmartRecognize возвращает массив объектов,
      // где у каждого есть x,y,width,height в натуральных пикселях и digit/confidence, system, ...
      // Если OCR отдаёт координаты в процентах — необходимо масштабировать
      const normalizedResults = results.map(r => {
        // Определим, похоже ли значение в пикселях или в процентах (простая эвристика)
        let out = { ...r };
        if (r.x <= 1 && r.y <= 1 && r.width <= 1 && r.height <= 1 && imageSize.width && imageSize.height) {
          out.x = Math.round(r.x * imageSize.width);
          out.y = Math.round(r.y * imageSize.height);
          out.width = Math.round(r.width * imageSize.width);
          out.height = Math.round(r.height * imageSize.height);
        }
        return out;
      });

      // Если требуется — дополнительно прогнать через AutoOCRService (локальное сравнение)
      const recognized = [];
      for (const res of normalizedResults) {
        try {
          const region = AutoOCRService.extractDigitRegion(res);
          const single = AutoOCRService.recognizeSingleDigit(region);
          if (single && single.digit) {
            recognized.push({
              digit: single.digit,
              confidence: single.confidence,
              x: res.x,
              y: res.y,
              width: res.width,
              height: res.height,
              system: res.system || null,
            });
          } else {
            // fallback: если локальное распознавание не уверено, берём OCR результат (если есть)
            recognisedFallback:
            recognized.push({
              digit: res.digit || null,
              confidence: res.confidence || 0,
              x: res.x,
              y: res.y,
              width: res.width,
              height: res.height,
              system: res.system || null,
            });
          }
        } catch (err) {
          console.warn('Ошибка обработки региона:', err);
        }
      }

      setRecognizedDigits(recognized);

      // Создаём объекты parts для интерфейса — id уникален по координатам/цифре
      const newParts = recognized.map((result, idx) => {
        const partInfo = {}; // Здесь можно подгружать из базы partsDatabase, но оставим базовый шаблон
        const number = partInfo.number || `UNKNOWN-${result.digit}-${idx}`;
        const name = partInfo.name || `Деталь ${result.digit}`;
        const systemColor = '#8A8A8A';

        return {
          id: `${result.digit}-${idx}-${result.x}-${result.y}`,
          number,
          name,
          price: partInfo.price || 0,
          category: partInfo.category || 'Неизвестно',
          system: result.system || partInfo.system || 'other',
          color: systemColor,
          confidence: result.confidence || 0,
          coordinates: {
            x: Math.round(result.x),
            y: Math.round(result.y),
            width: Math.max(10, Math.round(result.width || imageSize.width * 0.05)),
            height: Math.max(10, Math.round(result.height || imageSize.height * 0.05))
          }
        };
      });

      setParts(newParts);
      setStatus(`✅ Распознано ${newParts.length} позиций`);
    } catch (err) {
      console.error('Ошибка умного распознавания:', err);
      setStatus('❌ Ошибка распознавания. Смотрите консоль.');
    } finally {
      setLoading(false);
      setShowProcessingSteps(false);
      setProcessingStep('');
    }
  };

  const handleReset = () => {
    setImage(null);
    setImageUrl('');
    setRecognizedDigits([]);
    setParts([]);
    setSelectedPart(null);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setStatus('Выберите изображение схемы');
    if (fileInputRef.current) fileInputRef.current.value = '';
    // очистим внутренний canvas
    canvasRef.current = null;
    AutoOCRService.setCanvas(null, 1);
  };

  // При клике по изображению — можно выбирать деталь (left/top учитывают трансформ)
  const handleImageClick = (e) => {
    // Преобразуем координаты клика в натуральные пиксели с учётом зума/пан
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = (e.clientX - rect.left - pan.x) / zoom;
    const clickY = (e.clientY - rect.top - pan.y) / zoom;

    const found = parts.find(p => {
      const x = p.coordinates.x;
      const y = p.coordinates.y;
      const w = p.coordinates.width;
      const h = p.coordinates.height;
      return clickX >= x && clickX <= x + w && clickY >= y && clickY <= y + h;
    });

    if (found) {
      setSelectedPart(found);
    } else {
      setSelectedPart(null);
    }
  };

  return (
    <div className="ocr-diagram-viewer">
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
                onClick={handleReset}
                className="ocr-reset-btn"
              >
                ♻️ Сброс
              </button>
            </>
          )}
        </div>
        <div className="ocr-status">{status}</div>
      </div>

      <div className="ocr-image-container" style={{ position: 'relative' }}>
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

            {parts.map(part => (
              <div
                key={part.id}
                className={`ocr-digit-marker ${selectedPart?.id === part.id ? 'selected' : ''}`}
                style={{
                  left: `${part.coordinates.x}px`,
                  top: `${part.coordinates.y}px`,
                  width: `${part.coordinates.width}px`,
                  height: `${part.coordinates.height}px`,
                }}
                title={`${part.name} (${part.number}) — confidence ${part.confidence}`}
              >
                <div className="ocr-digit-number">{part.number}</div>
                <div className="digit-confidence">{Math.round(part.confidence * 100) / 100}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="ocr-placeholder">Загрузите изображение схемы для распознавания</div>
        )}
      </div>
    </div>
  );
};

export default OCRDiagramViewer;