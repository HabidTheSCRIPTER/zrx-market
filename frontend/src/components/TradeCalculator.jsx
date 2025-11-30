import React, { useState } from 'react';
import { BRAINROT_SECRETS, getItemsForCategory } from '../utils/tradeConstants';
import { BRAINROT_MUTATIONS, BRAINROT_TRAITS, calculateBrainrotValue, formatValue } from '../utils/valueCalculation';
import SearchableSelect from './SearchableSelect';
import AdvancedCategorySelect from './AdvancedCategorySelect';
import { getBrainrotImage } from '../utils/tradeConstants';
import './TradeCalculator.css';

const TradeCalculator = ({ onCalculate, initialOffered = [], initialWanted = [] }) => {
  const [offeredItems, setOfferedItems] = useState(
    initialOffered.length > 0 
      ? initialOffered 
      : [{ name: '', mutation: 'Default', traits: [] }]
  );
  const [wantedItems, setWantedItems] = useState(
    initialWanted.length > 0 
      ? initialWanted 
      : [{ name: '', mutation: 'Default', traits: [] }]
  );

  const addOfferedItem = () => {
    setOfferedItems([...offeredItems, { name: '', mutation: 'Default', traits: [] }]);
  };

  const removeOfferedItem = (index) => {
    const updated = offeredItems.filter((_, i) => i !== index);
    if (updated.length === 0) {
      updated.push({ name: '', mutation: 'Default', traits: [] });
    }
    setOfferedItems(updated);
  };

  const updateOfferedItem = (index, field, value) => {
    const updated = [...offeredItems];
    updated[index] = { ...updated[index], [field]: value };
    setOfferedItems(updated);
  };

  const addWantedItem = () => {
    setWantedItems([...wantedItems, { name: '', mutation: 'Default', traits: [] }]);
  };

  const removeWantedItem = (index) => {
    const updated = wantedItems.filter((_, i) => i !== index);
    if (updated.length === 0) {
      updated.push({ name: '', mutation: 'Default', traits: [] });
    }
    setWantedItems(updated);
  };

  const updateWantedItem = (index, field, value) => {
    const updated = [...wantedItems];
    updated[index] = { ...updated[index], [field]: value };
    setWantedItems(updated);
  };

  const calculateTotal = (items) => {
    return items.reduce((total, item) => {
      if (!item.name) return total;
      const value = calculateBrainrotValue(item.name, item.mutation || 'Default', item.traits || []);
      return total + value;
    }, 0);
  };

  const offeredTotal = calculateTotal(offeredItems);
  const wantedTotal = calculateTotal(wantedItems);
  const difference = offeredTotal - wantedTotal;
  const isFavorable = difference >= 0;

  const handleReset = () => {
    setOfferedItems([{ name: '', mutation: 'Default', traits: [] }]);
    setWantedItems([{ name: '', mutation: 'Default', traits: [] }]);
  };

  const handleCalculate = () => {
    if (onCalculate) {
      onCalculate({
        offered: offeredItems.filter(item => item.name),
        wanted: wantedItems.filter(item => item.name),
        offeredTotal,
        wantedTotal,
        difference,
        isFavorable
      });
    }
  };

  return (
    <div className="trade-calculator">
      <div className="calculator-header">
        <h3>💰 Trade Value Calculator</h3>
        <button onClick={handleReset} className="reset-btn">Reset</button>
      </div>

      <div className="calculator-content">
        <div className="calculator-section">
          <h4>I Give ({offeredItems.filter(i => i.name).length})</h4>
          <div className="calculator-items">
            {offeredItems.map((item, index) => (
              <div key={index} className="calculator-item-row">
                <SearchableSelect
                  value={item.name || ''}
                  onChange={(value) => updateOfferedItem(index, 'name', value)}
                  options={BRAINROT_SECRETS.map(name => ({ value: name, label: name }))}
                  placeholder="Select Brainrot"
                  style={{ flex: '1 1 200px' }}
                />
                <SearchableSelect
                  value={item.mutation || 'Default'}
                  onChange={(value) => updateOfferedItem(index, 'mutation', value)}
                  options={BRAINROT_MUTATIONS.map(mut => ({ value: mut, label: mut }))}
                  placeholder="Mutation"
                  style={{ flex: '0 1 120px' }}
                />
                <div style={{ flex: '0 1 150px' }}>
                  <AdvancedCategorySelect
                    value={Array.isArray(item.traits) ? item.traits : []}
                    onChange={(value) => updateOfferedItem(index, 'traits', value)}
                    options={BRAINROT_TRAITS.map(tr => ({ value: tr, label: tr }))}
                    placeholder="Traits"
                    multiSelect={true}
                    showCounts={false}
                  />
                </div>
                <div className="item-value-display">
                  {item.name && formatValue(calculateBrainrotValue(item.name, item.mutation || 'Default', item.traits || []))}/s
                </div>
                <button onClick={() => removeOfferedItem(index)} className="remove-item-btn">×</button>
              </div>
            ))}
            <button onClick={addOfferedItem} className="add-item-btn">+ Add Item</button>
          </div>
          <div className="section-total">
            <strong>Total: {formatValue(offeredTotal)}/s</strong>
          </div>
        </div>

        <div className="calculator-section">
          <h4>I Want ({wantedItems.filter(i => i.name).length})</h4>
          <div className="calculator-items">
            {wantedItems.map((item, index) => (
              <div key={index} className="calculator-item-row">
                <SearchableSelect
                  value={item.name || ''}
                  onChange={(value) => updateWantedItem(index, 'name', value)}
                  options={BRAINROT_SECRETS.map(name => ({ value: name, label: name }))}
                  placeholder="Select Brainrot"
                  style={{ flex: '1 1 200px' }}
                />
                <SearchableSelect
                  value={item.mutation || 'Default'}
                  onChange={(value) => updateWantedItem(index, 'mutation', value)}
                  options={BRAINROT_MUTATIONS.map(mut => ({ value: mut, label: mut }))}
                  placeholder="Mutation"
                  style={{ flex: '0 1 120px' }}
                />
                <div style={{ flex: '0 1 150px' }}>
                  <AdvancedCategorySelect
                    value={Array.isArray(item.traits) ? item.traits : []}
                    onChange={(value) => updateWantedItem(index, 'traits', value)}
                    options={BRAINROT_TRAITS.map(tr => ({ value: tr, label: tr }))}
                    placeholder="Traits"
                    multiSelect={true}
                    showCounts={false}
                  />
                </div>
                <div className="item-value-display">
                  {item.name && formatValue(calculateBrainrotValue(item.name, item.mutation || 'Default', item.traits || []))}/s
                </div>
                <button onClick={() => removeWantedItem(index)} className="remove-item-btn">×</button>
              </div>
            ))}
            <button onClick={addWantedItem} className="add-item-btn">+ Add Item</button>
          </div>
          <div className="section-total">
            <strong>Total: {formatValue(wantedTotal)}/s</strong>
          </div>
        </div>
      </div>

      <div className={`calculator-result ${isFavorable ? 'favorable' : 'unfavorable'}`}>
        <div className="result-header">
          <span className="result-icon">{isFavorable ? '✅' : '⚠️'}</span>
          <span className="result-label">{isFavorable ? 'Favorable Trade' : 'Unfavorable Trade'}</span>
        </div>
        <div className="result-details">
          <div className="result-item">
            <span>You Give:</span>
            <strong>{formatValue(offeredTotal)}/s</strong>
          </div>
          <div className="result-item">
            <span>You Want:</span>
            <strong>{formatValue(wantedTotal)}/s</strong>
          </div>
          <div className="result-difference">
            <span>Difference:</span>
            <strong className={isFavorable ? 'positive' : 'negative'}>
              {isFavorable ? '+' : ''}{formatValue(difference)}/s
            </strong>
          </div>
        </div>
        {onCalculate && (
          <button onClick={handleCalculate} className="calculate-trade-btn">
            Use This Trade
          </button>
        )}
      </div>
    </div>
  );
};

export default TradeCalculator;

