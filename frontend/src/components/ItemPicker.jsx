import React, { useState, useMemo } from 'react';
import { GAME_CATEGORIES, getItemsForCategory, getBrainrotImage } from '../utils/tradeConstants';
import './ItemPicker.css';

const ItemPicker = ({ isOpen, onClose, onSelect, selectedCategory = null }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGameCategory, setSelectedGameCategory] = useState(selectedCategory || GAME_CATEGORIES[0]);

  const items = useMemo(() => {
    if (!selectedGameCategory) return [];
    return getItemsForCategory(selectedGameCategory);
  }, [selectedGameCategory]);

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    return items.filter(item => 
      item.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [items, searchQuery]);

  const handleItemSelect = (itemName) => {
    onSelect({
      name: itemName,
      gameCategory: selectedGameCategory,
      mutation: selectedGameCategory === 'STEAL A BRAINROT' ? 'Default' : 
                selectedGameCategory === 'GROW A GARDEN' ? 'None' : null,
      traits: selectedGameCategory === 'STEAL A BRAINROT' ? [] : null,
      value: '',
      valueUnit: '',
      weight: ''
    });
    onClose();
  };

  if (!isOpen) return null;

  const getItemImage = (itemName) => {
    if (selectedGameCategory === 'STEAL A BRAINROT') {
      return getBrainrotImage(itemName);
    }
    // For GROW A GARDEN and ROBLOX, we can add placeholder images later
    return null;
  };

  return (
    <div className="item-picker-overlay" onClick={onClose}>
      <div className="item-picker-modal" onClick={(e) => e.stopPropagation()}>
        <div className="item-picker-header">
          <div className="item-picker-title">
            <span className="search-icon">🔍</span>
            <h2>Select Item</h2>
          </div>
          <p className="item-picker-subtitle">Pick an item to include in your trade</p>
          <button className="item-picker-close" onClick={onClose}>×</button>
        </div>

        <div className="item-picker-filters">
          <div className="category-selector">
            {GAME_CATEGORIES.map(category => (
              <button
                key={category}
                className={`category-btn ${selectedGameCategory === category ? 'active' : ''}`}
                onClick={() => {
                  setSelectedGameCategory(category);
                  setSearchQuery('');
                }}
              >
                {category}
              </button>
            ))}
          </div>
          <div className="search-bar-wrapper">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              className="item-picker-search"
              placeholder="Search items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="item-picker-content">
          <h3 className="items-list-title">Items List</h3>
          <div className="items-grid">
            {filteredItems.length === 0 ? (
              <div className="no-items">No items found</div>
            ) : (
              filteredItems.map((itemName, index) => {
                const imageUrl = getItemImage(itemName);
                return (
                  <div
                    key={index}
                    className="item-card"
                    onClick={() => handleItemSelect(itemName)}
                  >
                    {imageUrl ? (
                      <img 
                        src={imageUrl} 
                        alt={itemName}
                        className="item-card-image"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div 
                      className="item-card-image-placeholder"
                      style={{ display: imageUrl ? 'none' : 'flex' }}
                    >
                      <span className="item-icon">📦</span>
                    </div>
                    <div className="item-card-name">{itemName}</div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ItemPicker;

