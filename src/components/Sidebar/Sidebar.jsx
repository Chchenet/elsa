import React, { useState } from 'react';
import './Sidebar.css';

const cars = [
  { id: 1, brand: 'VW', model: 'Golf', year: '2015', engine: '1.6 TDI' },
  { id: 2, brand: 'Audi', model: 'A4', year: '2018', engine: '2.0 TFSI' },
  { id: 3, brand: 'Skoda', model: 'Octavia', year: '2020', engine: '1.4 TSI' },
  { id: 4, brand: 'VW', model: 'Passat', year: '2017', engine: '2.0 TDI' },
];

function Sidebar({ onCarSelect }) {
  const [selectedCar, setSelectedCar] = useState(null);

  const handleCarClick = (car) => {
    setSelectedCar(car);
    if (onCarSelect) {
      onCarSelect(car);
    }
  };

  return (
    <div className="sidebar">
      <h3>🚗 Выберите автомобиль</h3>
      
      <div className="car-list">
        {cars.map(car => (
          <div 
            key={car.id}
            className={`car-item ${selectedCar?.id === car.id ? 'selected' : ''}`}
            onClick={() => handleCarClick(car)}
          >
            <div className="car-brand">{car.brand}</div>
            <div className="car-model">{car.model}</div>
            <div className="car-details">{car.year}, {car.engine}</div>
          </div>
        ))}
      </div>
      
      {selectedCar && (
        <div className="selected-car-info">
          <h4>Выбран:</h4>
          <p><strong>{selectedCar.brand} {selectedCar.model}</strong></p>
          <p>Год: {selectedCar.year}</p>
          <p>Двигатель: {selectedCar.engine}</p>
        </div>
      )}
    </div>
  );
}

export default Sidebar;