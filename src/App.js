import React, { useState } from 'react';
import Header from './components/Header/Header';
import Sidebar from './components/Sidebar/Sidebar';
import OCRDiagramViewer from './components/OCRDiagramViewer/OCRDiagramViewer';
import './styles/App.css';

function App() {
  const [selectedCar, setSelectedCar] = useState(null);

  return (
    <div className="App">
      <Header />
      <div className="main-layout">
        <Sidebar onCarSelect={setSelectedCar} />
        <main className="content">
          {selectedCar ? (
            <div className="ocr-container">
              <div className="ocr-header">
                <h1>
                  <span className="vag-brand">VAG</span> 
                  <span className="etka-name">ETKA OCR Parts Catalog</span>
                </h1>
                <div className="ocr-subtitle">
                  <span className="car-info">
                    {selectedCar.brand} {selectedCar.model} ({selectedCar.year}) • 
                    Двигатель: {selectedCar.engine}
                  </span>
                  <span className="ocr-powered">
                    🔍 Распознавание: OCR.space API
                  </span>
                </div>
              </div>
              <OCRDiagramViewer />
            </div>
          ) : (
            <div className="welcome-screen">
              <h1 className="welcome-title">
                <span className="highlight">VAG ETKA</span> Parts Catalog
              </h1>
              <p className="welcome-subtitle">
                Интеллектуальная система распознавания схем и каталогизации запчастей
              </p>
              
              <div className="features-grid">
                <div className="feature-card">
                  <div className="feature-icon">🤖</div>
                  <h3>Искусственный интеллект</h3>
                  <p>Автоматическое распознавание цифр на схемах с помощью OCR</p>
                </div>
                
                <div className="feature-card">
                  <div className="feature-icon">📊</div>
                  <h3>База данных VAG</h3>
                  <p>Более 10,000 запчастей с актуальными ценами и номерами</p>
                </div>
                
                <div className="feature-card">
                  <div className="feature-icon">⚡</div>
                  <h3>Мгновенный поиск</h3>
                  <p>Находите детали по номеру, названию или позиции на схеме</p>
                </div>
                
                <div className="feature-card">
                  <div className="feature-icon">🛒</div>
                  <h3>Интеграция</h3>
                  <p>Добавляйте в корзину, экспортируйте списки, создавайте заказы</p>
                </div>
              </div>
              
              <div className="welcome-instruction">
                <h3>🎯 Как начать:</h3>
                <ol>
                  <li>Выберите автомобиль в боковой панели слева</li>
                  <li>Загрузите изображение схемы двигателя</li>
                  <li>Система автоматически распознает номера деталей</li>
                  <li>Работайте с каталогом как в оригинальном ETKA!</li>
                </ol>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;