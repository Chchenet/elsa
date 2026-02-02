import React, { useState, useRef } from 'react';
import TesseractOCRService from '../../services/TesseractOCRService';
import './OCRDiagramViewer.css';

const OCRDiagramViewer = () => {
  const [imageUrl, setImageUrl] = useState('');
  const [parts, setParts] = useState([]);
  const [status, setStatus] = useState('Выберите изображение схемы');
  const [loading, setLoading] = useState(false);

  const imageRef = useRef(null);
  const fileInputRef = useRef(null);

  const handleImageUpload = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setImageUrl(ev.target.result);
      setParts([]);
      setStatus('Изображение загружено. Нажмите "Распознать"');
    };
    reader.readAsDataURL(file);
  };

  const handleImageLoad = () => {
    // ничего не передаём в worker напрямую
    setStatus('Изображение готово');
  };

  const handleRecognize = async () => {
    if (!imageRef.current) { setStatus('Сначала загрузите изображение'); return; }
    setLoading(true);
    setStatus('Распознавание...');
    try {
      // Передаём imageRef.current — сервис внутри создаёт canvas и передаёт dataURL/Blob в worker
      const symbols = await TesseractOCRService.recognizeImage(imageRef.current, { onlyDigits: true });
      console.log('Tesseract symbols:', symbols);

      // Простая группировка в числа (по строкам и близости)
      symbols.sort((a, b) => {
        if (Math.abs(a.y - b.y) < 10) return a.x - b.x;
        return a.y - b.y;
      });

      const grouped = [];
      for (const s of symbols) {
        if (grouped.length === 0) {
          grouped.push({ text: s.digit, x: s.x, y: s.y, x2: s.x + s.width, y2: s.y + s.height, conf: s.confidence });
          continue;
        }
        const last = grouped[grouped.length - 1];
        const sameLine = Math.abs(s.y - last.y) < Math.max(12, Math.round((last.y2 - last.y) / 2));
        const gap = s.x - last.x2;
        if (sameLine && gap < Math.max(20, Math.round((s.width + (last.x2 - last.x)) / 2))) {
          last.text += s.digit;
          last.x2 = Math.max(last.x2, s.x + s.width);
          last.y2 = Math.max(last.y2, s.y + s.height);
          last.conf = Math.max(last.conf, s.confidence);
        } else {
          grouped.push({ text: s.digit, x: s.x, y: s.y, x2: s.x + s.width, y2: s.y + s.height, conf: s.confidence });
        }
      }

      const newParts = grouped.map((g, idx) => ({
        id: `part-${idx}`,
        number: g.text,
        name: `Деталь ${g.text}`,
        confidence: g.conf,
        coordinates: { x: Math.round(g.x), y: Math.round(g.y), width: Math.max(8, Math.round(g.x2 - g.x)), height: Math.max(8, Math.round(g.y2 - g.y)) }
      }));

      setParts(newParts);
      setStatus(`Распознано ${newParts.length} позиций`);
    } catch (err) {
      console.error('Ошибка распознавания:', err);
      setStatus('Ошибка распознавания — смотрите консоль');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setImageUrl('');
    setParts([]);
    setStatus('Выберите изображение схемы');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="ocr-diagram-viewer">
      <div className="ocr-control-panel">
        <input type="file" accept="image/*" onChange={handleImageUpload} ref={fileInputRef} style={{ display: 'none' }} id="image-upload" />
        <label htmlFor="image-upload" className="ocr-upload-btn">📁 Загрузить схему</label>

        {imageUrl && (
          <>
            <button onClick={handleRecognize} disabled={loading} className="ocr-smart-btn">🧠 Распознать</button>
            <button onClick={handleReset} className="ocr-reset-btn">♻️ Сброс</button>
          </>
        )}
        <div className="ocr-status">{status}{loading ? ' ...' : ''}</div>
      </div>

      <div className="ocr-image-container">
        {imageUrl ? (
          <div className="ocr-image-wrapper" style={{ position: 'relative' }}>
            <img ref={imageRef} src={imageUrl} alt="Схема" className="ocr-diagram-image" onLoad={handleImageLoad} style={{ display: 'block', maxWidth: '100%' }} />
            {parts.map(part => (
              <div key={part.id} className="ocr-digit-marker" style={{
                position: 'absolute', left: `${part.coordinates.x}px`, top: `${part.coordinates.y}px`,
                width: `${part.coordinates.width}px`, height: `${part.coordinates.height}px`,
                border: '2px solid rgba(102,126,234,0.9)', background: 'rgba(102,126,234,0.12)', borderRadius: 8
              }}>
                <div style={{ position: 'absolute', top: '-22px', left: 0, background: '#667eea', color: '#fff', padding: '3px 6px', borderRadius: '12px', fontSize: 12, fontWeight: 700 }}>
                  {part.number}
                </div>
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