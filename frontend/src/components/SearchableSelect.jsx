import React, { useState, useRef, useEffect } from 'react';
import './SearchableSelect.css';

const SearchableSelect = ({
  value,
  onChange,
  options,
  placeholder = 'Select an option...',
  searchPlaceholder = 'Search...',
  required = false,
  disabled = false,
  className = '',
  style = {},
  renderOption = null,
  getOptionLabel = (option) => typeof option === 'string' ? option : option.label || option.value || option.name || '',
  getOptionValue = (option) => typeof option === 'string' ? option : option.value || option.id || option,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);
  const dropdownRef = useRef(null);

  // Filter options based on search term
  const filteredOptions = options.filter(option => {
    const label = getOptionLabel(option).toLowerCase();
    return label.includes(searchTerm.toLowerCase());
  });

  // Get the selected option label
  const selectedOption = options.find(opt => {
    const optValue = getOptionValue(opt);
    return String(optValue) === String(value);
  });
  const selectedLabel = selectedOption ? getOptionLabel(selectedOption) : placeholder;

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm('');
        setHighlightedIndex(-1);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      // Focus search input when dropdown opens
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
      if (!isOpen) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex(prev => 
            prev < filteredOptions.length - 1 ? prev + 1 : prev
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex(prev => prev > 0 ? prev - 1 : -1);
          break;
        case 'Enter':
          e.preventDefault();
          if (highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
            handleSelect(filteredOptions[highlightedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setIsOpen(false);
          setSearchTerm('');
          setHighlightedIndex(-1);
          break;
        default:
          break;
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, highlightedIndex, filteredOptions]);

  // Scroll highlighted option into view
  useEffect(() => {
    if (highlightedIndex >= 0 && dropdownRef.current) {
      const optionElement = dropdownRef.current.children[highlightedIndex];
      if (optionElement) {
        optionElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [highlightedIndex]);

  const handleSelect = (option) => {
    if (!option) return;
    const optionValue = getOptionValue(option);
    if (optionValue !== undefined && optionValue !== null) {
      onChange(optionValue);
      setIsOpen(false);
      setSearchTerm('');
      setHighlightedIndex(-1);
    }
  };

  const handleToggle = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
      if (!isOpen) {
        setSearchTerm('');
        setHighlightedIndex(-1);
      }
    }
  };

  return (
    <div 
      ref={containerRef}
      className={`searchable-select ${isOpen ? 'open' : ''} ${disabled ? 'disabled' : ''} ${className}`}
      style={style}
    >
      <div 
        className="searchable-select-trigger"
        onClick={handleToggle}
      >
        <span className={value ? 'selected-value' : 'placeholder'}>
          {selectedLabel}
        </span>
        <svg 
          className="searchable-select-arrow"
          width="12" 
          height="12" 
          viewBox="0 0 12 12" 
          fill="none"
        >
          <path 
            d="M2 4L6 8L10 4" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {isOpen && (
        <div className="searchable-select-dropdown" ref={dropdownRef}>
          <div className="searchable-select-search">
            <svg 
              className="search-icon" 
              width="16" 
              height="16" 
              viewBox="0 0 16 16" 
              fill="none"
            >
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
              className="searchable-select-input"
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setHighlightedIndex(-1);
              }}
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          <div className="searchable-select-options">
            {filteredOptions.length === 0 ? (
              <div className="searchable-select-no-results">
                No results found
              </div>
            ) : (
              filteredOptions.map((option, index) => {
                const optionValue = getOptionValue(option);
                const optionLabel = getOptionLabel(option);
                const isSelected = value === optionValue;
                const isHighlighted = index === highlightedIndex;

                return (
                  <div
                    key={`${optionValue}-${index}`}
                    className={`searchable-select-option ${isSelected ? 'selected' : ''} ${isHighlighted ? 'highlighted' : ''}`}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleSelect(option);
                    }}
                    onMouseEnter={() => setHighlightedIndex(index)}
                  >
                    {renderOption ? renderOption(option, isSelected) : optionLabel}
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

export default SearchableSelect;



