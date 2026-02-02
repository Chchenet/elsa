import React from 'react';
import './Header.css';

function Header() {
  return (
    <header className="header">
      <div className="logo">
        <h2>🚗 Каталог запчастей VAG</h2>
      </div>
      <div className="search">
        <input type="text" placeholder="Поиск по номеру или названию..." />
        <button>🔍</button>
      </div>
    </header>
  );
}

export default Header;