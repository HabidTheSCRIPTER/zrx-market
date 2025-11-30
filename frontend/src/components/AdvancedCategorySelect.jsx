import React, { useState, useRef, useEffect } from 'react';
import './AdvancedCategorySelect.css';

const AdvancedCategorySelect = ({
  value,
  onChange,
  options = [],
  placeholder = 'Select category...',
  showCounts = true,
  multiSelect = false,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);
  const dropdownRef = useRef(null);

  // Filter options based on search
  const filteredOptions = options.filter(opt => {
    const label = (opt.label || opt.name || '').toLowerCase();
    return label.includes(searchTerm.toLowerCase());
  });

  // Get selected option(s)
  const selectedOptions = multiSelect
    ? options.filter(opt => value && value.includes(opt.value))
    : options.filter(opt => opt.value === value);

  const selectedLabel = multiSelect
    ? selectedOptions.length > 0
      ? `${selectedOptions.length} selected`
      : placeholder
    : selectedOptions.length > 0
    ? selectedOptions[0].label || selectedOptions[0].name
    : placeholder;
  
  const showChips = multiSelect && selectedOptions.length > 0 && selectedOptions.length <= 3;
  
  // Get all selected options for display (not just the filtered ones)
  const allSelectedOptions = multiSelect && Array.isArray(value)
    ? options.filter(opt => value.includes(opt.value))
    : selectedOptions;

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, 100);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setIsOpen(true);
        }
        return;
      }

      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          setIsOpen(false);
          setSearchTerm('');
          break;
        default:
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleToggle = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      setSearchTerm('');
    }
  };

  const handleSelect = (optionValue) => {
    if (multiSelect) {
      const currentValues = Array.isArray(value) ? value : [];
      const newValues = currentValues.includes(optionValue)
        ? currentValues.filter(v => v !== optionValue)
        : [...currentValues, optionValue];
      onChange(newValues);
    } else {
      onChange(optionValue);
      setIsOpen(false);
      setSearchTerm('');
    }
  };

  const isSelected = (optionValue) => {
    if (multiSelect) {
      return Array.isArray(value) && value.includes(optionValue);
    }
    return value === optionValue;
  };

  return (
    <div
      ref={containerRef}
      className={`advanced-category-select ${isOpen ? 'open' : ''} ${className}`}
    >
      <div
        className="advanced-category-trigger"
        onClick={handleToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleToggle();
          }
        }}
      >
        <div className="advanced-category-trigger-content">
          {showChips ? (
            <div className="selected-chips-container">
              {allSelectedOptions.slice(0, 3).map((opt) => (
                <span key={opt.value} className="selected-chip">
                  {opt.label || opt.name}
                </span>
              ))}
              {allSelectedOptions.length > 3 && (
                <span className="selected-chip-count">+{allSelectedOptions.length - 3}</span>
              )}
            </div>
          ) : (
            <span className={selectedOptions.length > 0 ? 'selected-value' : 'placeholder'}>
              {selectedLabel}
            </span>
          )}
        </div>
        <div className="advanced-category-indicator">
          {selectedOptions.length > 0 && !multiSelect && (
            <span className="selected-badge">{selectedOptions.length}</span>
          )}
          <svg
            className={`advanced-category-arrow ${isOpen ? 'open' : ''}`}
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
          >
            <path
              d="M4 6L8 10L12 6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>

      {isOpen && (
        <div className="advanced-category-dropdown" ref={dropdownRef}>
          {options.length > 5 && (
            <div className="advanced-category-search" onClick={(e) => e.stopPropagation()}>
              <svg className="search-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M7 12C9.76142 12 12 9.76142 12 7C12 4.23858 9.76142 2 7 2C4.23858 2 2 4.23858 2 7C2 9.76142 4.23858 12 7 12Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M10 10L14 14"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <input
                ref={searchInputRef}
                type="text"
                className="advanced-category-input"
                placeholder="Search traits..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                onFocus={(e) => e.stopPropagation()}
              />
            </div>
          )}

          <div className="advanced-category-options">
            {filteredOptions.length === 0 ? (
              <div className="advanced-category-no-results">
                No categories found
              </div>
            ) : (
              filteredOptions.map((option) => {
                const selected = isSelected(option.value);
                return (
                  <div
                    key={option.value}
                    className={`advanced-category-option ${selected ? 'selected' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelect(option.value);
                    }}
                  >
                    <div className="option-content">
                      {option.icon && <span className="option-icon">{option.icon}</span>}
                      <span className="option-label">{option.label || option.name}</span>
                    </div>
                    <div className="option-meta">
                      {showCounts && option.count !== undefined && (
                        <span className="option-count">{option.count}</span>
                      )}
                      {selected && (
                        <svg
                          className="check-icon"
                          width="16"
                          height="16"
                          viewBox="0 0 16 16"
                          fill="none"
                        >
                          <path
                            d="M13 4L6 11L3 8"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdvancedCategorySelect;

