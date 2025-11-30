import React, { useState, useEffect } from 'react';
import { PET_MUTATIONS, BRAINROT_MUTATIONS, BRAINROT_TRAITS, calculateItemValue, formatValue, getValueUnit } from '../utils/valueCalculation';
import SearchableSelect from './SearchableSelect';
import AdvancedCategorySelect from './AdvancedCategorySelect';
import { getBrainrotImage } from '../utils/tradeConstants';
import './ItemConfigModal.css';

const ItemConfigModal = ({ isOpen, onClose, item, onSave, gameCategory }) => {
  const [config, setConfig] = useState({
    mutation: 'Default',
    traits: [],
    value: '',
    valueUnit: '',
    weight: ''
  });

  useEffect(() => {
    if (item) {
      setConfig({
        mutation: item.mutation || (gameCategory === 'GROW A GARDEN' ? 'None' : 'Default'),
        traits: Array.isArray(item.traits) ? item.traits : (item.trait ? [item.trait] : []),
        value: item.value || '',
        valueUnit: item.valueUnit || '',
        weight: item.weight || ''
      });
    }
  }, [item, gameCategory]);

  useEffect(() => {
    // Auto-calculate value for STEAL A BRAINROT items
    if (gameCategory === 'STEAL A BRAINROT' && item?.name) {
      const calculatedValue = calculateItemValue({
        name: item.name,
        gameCategory: 'STEAL A BRAINROT',
        mutation: config.mutation,
        traits: config.traits
      });
      if (calculatedValue) {
        setConfig(prev => ({
          ...prev,
          value: calculatedValue.toString(),
          valueUnit: getValueUnit(calculatedValue)
        }));
      }
    }
  }, [config.mutation, config.traits, item, gameCategory]);

  const handleSave = () => {
    onSave({
      ...item,
      ...config
    });
    onClose();
  };

  if (!isOpen || !item) return null;

  const calculatedValue = gameCategory === 'STEAL A BRAINROT' && item.name
    ? calculateItemValue({
        name: item.name,
        gameCategory: 'STEAL A BRAINROT',
        mutation: config.mutation,
        traits: config.traits
      })
    : null;

  return (
    <div className="item-config-overlay" onClick={onClose}>
      <div className="item-config-modal" onClick={(e) => e.stopPropagation()}>
        <div className="item-config-header">
          <div className="item-config-item-info">
            {gameCategory === 'STEAL A BRAINROT' && getBrainrotImage(item.name) && (
              <img 
                src={getBrainrotImage(item.name)} 
                alt={item.name}
                className="item-config-image"
              />
            )}
            <div>
              <h3>{item.name}</h3>
              <p className="item-config-category">{gameCategory}</p>
            </div>
          </div>
          <button className="item-config-close" onClick={onClose}>×</button>
        </div>

        <div className="item-config-content">
          {gameCategory === 'STEAL A BRAINROT' && (
            <>
              <div className="config-field">
                <label>Mutation (Required)</label>
                <SearchableSelect
                  value={config.mutation || 'Default'}
                  onChange={(value) => setConfig({ ...config, mutation: value })}
                  options={BRAINROT_MUTATIONS.map(mut => ({ value: mut, label: mut }))}
                  placeholder="Select Mutation"
                />
              </div>

              <div className="config-field">
                <label>Traits (Optional)</label>
                <AdvancedCategorySelect
                  value={config.traits || []}
                  onChange={(value) => setConfig({ ...config, traits: value })}
                  options={BRAINROT_TRAITS.map(tr => ({ value: tr, label: tr }))}
                  placeholder="Select Traits"
                  multiSelect={true}
                  showCounts={false}
                />
              </div>

              <div className="config-field">
                <label>Calculated Value</label>
                <div className="calculated-value-display">
                  {calculatedValue ? (
                    <>
                      <span className="value-amount">{formatValue(calculatedValue)}</span>
                      <span className="value-unit">{getValueUnit(calculatedValue)}</span>
                    </>
                  ) : (
                    <span className="no-value">No value calculated</span>
                  )}
                </div>
              </div>
            </>
          )}

          {gameCategory === 'GROW A GARDEN' && (
            <>
              <div className="config-field">
                <label>Mutation</label>
                <SearchableSelect
                  value={config.mutation || 'None'}
                  onChange={(value) => setConfig({ ...config, mutation: value })}
                  options={PET_MUTATIONS.map(mut => ({ value: mut, label: mut }))}
                  placeholder="Select Mutation"
                />
              </div>

              <div className="config-field">
                <label>Weight (Optional)</label>
                <input
                  type="text"
                  placeholder="Enter weight"
                  value={config.weight}
                  onChange={(e) => setConfig({ ...config, weight: e.target.value })}
                  className="config-input"
                />
              </div>
            </>
          )}

          {(gameCategory === 'GROW A GARDEN' || gameCategory === 'ROBLOX') && (
            <div className="config-field">
              <label>Value (Optional)</label>
              <div className="value-input-group">
                <input
                  type="text"
                  placeholder="Enter value"
                  value={config.value}
                  onChange={(e) => setConfig({ ...config, value: e.target.value })}
                  className="config-input"
                />
                {gameCategory === 'ROBLOX' && (
                  <SearchableSelect
                    value={config.valueUnit || ''}
                    onChange={(value) => setConfig({ ...config, valueUnit: value })}
                    options={[
                      { value: '', label: 'Unit' },
                      { value: 'R$', label: 'R$' },
                      { value: 'USD', label: 'USD' }
                    ]}
                    placeholder="Unit"
                    style={{ flex: '0 1 100px' }}
                  />
                )}
              </div>
            </div>
          )}
        </div>

        <div className="item-config-footer">
          <button onClick={onClose} className="cancel-btn">Cancel</button>
          <button onClick={handleSave} className="save-btn">Save</button>
        </div>
      </div>
    </div>
  );
};

export default ItemConfigModal;

