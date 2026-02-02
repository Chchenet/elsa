import React from 'react';
import './PartsTable.css';

const partsData = [
  { id: 1, number: '06Q115611B', name: 'Масляный фильтр', price: 850, stock: 15, category: 'Фильтры' },
  { id: 2, number: '1K0123301T', name: 'Тормозной диск', price: 4200, stock: 8, category: 'Тормоза' },
  { id: 3, number: '1K0615301E', name: 'Сцепление', price: 12500, stock: 3, category: 'Трансмиссия' },
  { id: 4, number: '06A109243F', name: 'Свеча зажигания', price: 450, stock: 45, category: 'Двигатель' },
  { id: 5, number: '1K0959755', name: 'Датчик ABS', price: 3200, stock: 12, category: 'Электроника' },
];

function PartsTable({ onAddToCart }) {
  const handleAddToCart = (part) => {
    if (onAddToCart) {
      onAddToCart(part);
      alert(`Добавлено: ${part.name}`);
    }
  };

  return (
    <div className="parts-table-container">
      <h3>Доступные запчасти</h3>
      <table className="parts-table">
        <thead>
          <tr>
            <th>Номер</th>
            <th>Название</th>
            <th>Категория</th>
            <th>Цена</th>
            <th>В наличии</th>
            <th>Действие</th>
          </tr>
        </thead>
        <tbody>
          {partsData.map(part => (
            <tr key={part.id}>
              <td className="part-number">{part.number}</td>
              <td>{part.name}</td>
              <td><span className="category-badge">{part.category}</span></td>
              <td className="price">{part.price.toLocaleString()} ₽</td>
              <td>
                <span className={`stock ${part.stock > 10 ? 'in-stock' : 'low-stock'}`}>
                  {part.stock} шт.
                </span>
              </td>
              <td>
                <button 
                  className="add-to-cart-btn"
                  onClick={() => handleAddToCart(part)}
                  disabled={part.stock === 0}
                >
                  🛒 В корзину
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default PartsTable;