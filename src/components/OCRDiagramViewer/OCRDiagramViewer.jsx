import React, { useState, useRef, useEffect } from 'react';
import OCRSpaceService from '../../services/OCRSpaceService';
import './OCRDiagramViewer.css';

const OCRDiagramViewer = () => {
  const [imageUrl, setImageUrl] = useState('');
  const [parts, setParts] = useState([]);
  const [status, setStatus] = useState('Загрузите схему');
  const [loading, setLoading] = useState(false);

  const imageRef = useRef(null);
  const wrapperRef = useRef(null);
  const fileInputRef = useRef(null);

  // Метрики изображения (натуральный и отображаемый размеры)
  const [imgMetrics, setImgMetrics] = useState({
    naturalWidth: 0,
    naturalHeight: 0,
    clientWidth: 0,
    clientHeight: 0,
    scaleX: 1,
    scaleY: 1
  });

  // При загрузке файла
  const handleUpload = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setImageUrl(ev.target.result);
      setParts([]);
      setStatus('Изображение загружено. Нажмите "Распознать"');
    };
    reader.readAsDataURL(f);
  };

  // Когда изображение загружено в DOM — вычисляем метрики
  const handleImageLoad = () => {
    if (!imageRef.current) return;
    const natW = imageRef.current.naturalWidth || imageRef.current.width;
    const natH = imageRef.current.naturalHeight || imageRef.current.height;
    const cliW = imageRef.current.clientWidth;
    const cliH = imageRef.current.clientHeight;

    const scaleX = natW > 0 ? (cliW / natW) : 1;
    const scaleY = natH > 0 ? (cliH / natH) : 1;

    setImgMetrics({
      naturalWidth: natW,
      naturalHeight: natH,
      clientWidth: cliW,
      clientHeight: cliH,
      scaleX,
      scaleY
    });

    setStatus('Изображение готово');
  };

  // Пересчёт при ресайзе окна (если изображение responsive)
  useEffect(() => {
    const onResize = () => {
      if (!imageRef.current) return;
      const natW = imageRef.current.naturalWidth || imageRef.current.width;
      const natH = imageRef.current.naturalHeight || imageRef.current.height;
      const cliW = imageRef.current.clientWidth;
      const cliH = imageRef.current.clientHeight;
      setImgMetrics({
        naturalWidth: natW,
        naturalHeight: natH,
        clientWidth: cliW,
        clientHeight: cliH,
        scaleX: natW > 0 ? cliW / natW : 1,
        scaleY: natH > 0 ? cliH / natH : 1
      });
    };
    window.addEventListener('resize', onResize);
    // также наблюдаем за resize контейнера (если применимо)
    let ro;
    if (wrapperRef.current && 'ResizeObserver' in window) {
      ro = new ResizeObserver(onResize);
      ro.observe(wrapperRef.current);
    }
    return () => {
      window.removeEventListener('resize', onResize);
      if (ro && wrapperRef.current) ro.unobserve(wrapperRef.current);
    };
  }, []);

  // Вызов OCR.space и обработка результатов
  const handleRecognize = async () => {
    if (!imageRef.current) {
      setStatus('Сначала загрузите изображение');
      return;
    }
    setLoading(true);
    setStatus('Отправляю в OCR.space...');
    try {
      const symbols = await OCRSpaceService.recognizeDigits(imageRef.current, { language: 'eng' });
      console.log('OCR.space symbols raw:', symbols);

      // OCR.space часто возвращает bbox в пикселях, относящихся к картинке (натуральным)
      // Преобразуем сразу в объект parts с координатами в натуральных пикселях (как пришли)
      const mapped = symbols.map((s, idx) => ({
        id: `p-${idx}`,
        number: s.text,
        name: `Деталь ${s.text}`,
        confidence: s.confidence,
        // coordsFromOCR: ��ставляем оригинал, потом при рендере домножим на scaleX/scaleY
        coordsFromOCR: { x: s.x, y: s.y, width: s.width, height: s.height }
      }));

      setParts(mapped);
      setStatus(`OCR вернул ${mapped.length} результатов`);
    } catch (err) {
      console.error('Ошибка OCR.space:', err);
      setStatus(`Ошибка OCR: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Экспорт результатов (координаты в натуральных и в отображаемых пикселях)
  const handleExport = () => {
    const exportData = {
      imageUrl,
      imageMetrics: imgMetrics,
      parts: parts.map(p => ({
        id: p.id,
        number: p.number,
        confidence: p.confidence,
        coordsFromOCR: p.coordsFromOCR,
        coordsDisplay: {
          x: Math.round(p.coordsFromOCR.x * imgMetrics.scaleX),
          y: Math.round(p.coordsFromOCR.y * imgMetrics.scaleY),
          width: Math.round(p.coordsFromOCR.width * imgMetrics.scaleX),
          height: Math.round(p.coordsFromOCR.height * imgMetrics.scaleY)
        }
      })),
      timestamp: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ocr-results-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Возвращает стиль для маркера (позиция в отображаемых пикселях)
  const getMarkerStyle = (part) => {
    const c = part.coordsFromOCR;
    const left = Math.round((c.x || 0) * (imgMetrics.scaleX || 1));
    const top = Math.round((c.y || 0) * (imgMetrics.scaleY || 1));
    const width = Math.max(6, Math.round((c.width || 10) * (imgMetrics.scaleX || 1)));
    const height = Math.max(6, Math.round((c.height || 10) * (imgMetrics.scaleY || 1)));

    return {
      position: 'absolute',
      left: `${left}px`,
      top: `${top}px`,
      width: `${width}px`,
      height: `${height}px`,
      border: '2px solid rgba(102,126,234,0.9)',
      background: 'rgba(102,126,234,0.12)',
      borderRadius: 8,
      zIndex: 20,
      boxSizing: 'border-box',
      overflow: 'hidden'
    };
  };

  // Ресет
  const handleReset = () => {
    setImageUrl('');
    setParts([]);
    setStatus('Загрузите схему');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="ocr-diagram-viewer">
      <div className="ocr-control-panel">
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleUpload} style={{ display: 'none' }} id="image-upload" />
        <label htmlFor="image-upload" className="ocr-upload-btn">📁 Загрузить схему</label>

        {imageUrl && (
          <>
            <button onClick={handleRecognize} disabled={loading} className="ocr-smart-btn">🧠 Распознать</button>
            <button onClick={handleExport} className="ocr-export-btn">⬇️ Экспорт</button>
            <button onClick={handleReset} className="ocr-reset-btn">♻️ Сброс</button>
          </>
        )}
        <div className="ocr-status">{status}{loading ? ' ...' : ''}</div>
      </div>

      <div className="ocr-image-container" ref={wrapperRef} style={{ position: 'relative' }}>
        {imageUrl ? (
          <div className="ocr-image-wrapper" style={{ position: 'relative' }}>
            <img
              ref={imageRef}
              src={imageUrl}
              alt="Схема"
              onLoad={handleImageLoad}
              style={{ display: 'block', maxWidth: '100%', height: 'auto' }}
            />

            {parts.map(part => (
              <div key={part.id} style={getMarkerStyle(part)} title={`${part.number} (conf: ${part.confidence})`}>
                <div style={{
                  position: 'absolute',
                  top: '-20px',
                  left: 0,
                  background: '#667eea',
                  color: '#fff',
                  padding: '3px 6px',
                  borderRadius: '12px',
                  fontSize: 12,
                  fontWeight: 700
                }}>{part.number}</div>
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