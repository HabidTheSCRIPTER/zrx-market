import React, { useState, useEffect } from 'react';

import axios from 'axios';

import { useAuth } from '../context/AuthContext';

import { useLocation, useNavigate } from 'react-router-dom';

import { GAME_CATEGORIES, getItemsForCategory, getBrainrotImage } from '../utils/tradeConstants';

import SearchableSelect from '../components/SearchableSelect';

import { PET_MUTATIONS, BRAINROT_MUTATIONS, BRAINROT_TRAITS, calculateItemValue, formatValue, getValueUnit } from '../utils/valueCalculation';

import AdvancedCategorySelect from '../components/AdvancedCategorySelect';

import ItemPicker from '../components/ItemPicker';

import ItemConfigModal from '../components/ItemConfigModal';

import './Trades.css';



const Trades = () => {

  const { user, openMessageOverlay } = useAuth();

  const location = useLocation();

  const navigate = useNavigate();

  const [trades, setTrades] = useState([]);

  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(1);

  const [totalPages, setTotalPages] = useState(1);

  const [search, setSearch] = useState('');
  const [gameCategory, setGameCategory] = useState('');
  const [sortBy, setSortBy] = useState('newest');

  const [showCreateForm, setShowCreateForm] = useState(false);

  const [formData, setFormData] = useState({

    offeredItems: [],

    wantedItems: []

  });

  const [submitting, setSubmitting] = useState(false);

  const [showItemPicker, setShowItemPicker] = useState(false);

  const [pickerContext, setPickerContext] = useState({ type: 'offered', index: null });

  const [showItemConfig, setShowItemConfig] = useState(false);

  const [configContext, setConfigContext] = useState({ type: null, index: null, item: null });

  const [wishlistIds, setWishlistIds] = useState(new Set());

  const normalizeTraitList = (input) => {
    if (Array.isArray(input)) {
      return input.filter(Boolean);
    }
    if (typeof input === 'string') {
      return input
        .split(',')
        .map(trait => trait.trim())
        .filter(Boolean);
    }
    return [];
  };



  useEffect(() => {

    fetchTrades();

  }, [page, search, gameCategory, sortBy]);



  useEffect(() => {

    if (user) {

      fetchWishlistIds();

    }

  }, [user]);



  const fetchWishlistIds = async () => {

    try {

      const response = await axios.get('/api/wishlist');

      const ids = new Set(response.data.map(trade => trade.id));

      setWishlistIds(ids);

    } catch (error) {

      console.error('Error fetching wishlist:', error);

    }

  };



  const toggleWishlist = async (tradeId, e) => {

    e.stopPropagation();

    if (!user) {

      alert('Please log in to add items to your wishlist');

      return;

    }



    try {

      if (wishlistIds.has(tradeId)) {

        await axios.delete(`/api/wishlist/${tradeId}`);

        setWishlistIds(prev => {

          const newSet = new Set(prev);

          newSet.delete(tradeId);

          return newSet;

        });

      } else {

        await axios.post(`/api/wishlist/${tradeId}`);

        setWishlistIds(prev => new Set([...prev, tradeId]));

      }

    } catch (error) {

      console.error('Error toggling wishlist:', error);

      alert(error.response?.data?.error || 'Failed to update wishlist');

    }

  };



  // Handle template loading from navigation

  useEffect(() => {

    if (location.state?.template) {

      const template = location.state.template;

      setFormData({

        offeredItems: template.offered?.length > 0 

          ? template.offered.map(item => ({

              name: item.name || '',

              gameCategory: item.gameCategory || '',

              value: item.value || '',

              valueUnit: item.valueUnit || '',

              mutation: item.mutation || item.mutation || 'Default',

              traits: normalizeTraitList(item.traits ?? (item.trait ? [item.trait] : [])),

              weight: item.weight || ''

            }))

          : [{ name: '', gameCategory: '', value: '', valueUnit: '', mutation: 'Default', traits: [], weight: '' }],

        wantedItems: template.wanted?.length > 0

          ? template.wanted.map(item => ({

              name: item.name || '',

              gameCategory: item.gameCategory || '',

              value: item.value || '',

              valueUnit: item.valueUnit || '',

              mutation: item.mutation || item.mutation || 'Default',

              traits: normalizeTraitList(item.traits ?? (item.trait ? [item.trait] : [])),

              weight: item.weight || ''

            }))

          : [{ name: '', gameCategory: '', value: '', valueUnit: '', mutation: 'Default', traits: [], weight: '' }]

      });

      setShowCreateForm(true);

      // Clear the location state

      navigate(location.pathname, { replace: true, state: {} });

    }

    // eslint-disable-next-line react-hooks/exhaustive-deps

  }, [location.state]);



  const fetchTrades = async () => {

    setLoading(true);

    try {

      const response = await axios.get('/api/trades', {

        params: { 
          page, 
          limit: 20, 
          search,
          gameCategory: gameCategory || undefined,
          sortBy: sortBy || 'newest'
        }

      });

      const tradesData = response.data?.trades;

      const pagination = response.data?.pagination;

      setTrades(Array.isArray(tradesData) ? tradesData : []);

      setTotalPages(

        typeof pagination?.totalPages === 'number' && pagination.totalPages > 0

          ? pagination.totalPages

          : 1

      );

    } catch (error) {

      console.error('Error fetching trades:', error);

      setTrades([]);

    } finally {

      setLoading(false);

    }

  };



  const copyLink = (tradeId) => {

    const link = `${window.location.origin}/trades/${tradeId}`;

    navigator.clipboard.writeText(link);

    alert('Link copied to clipboard!');

  };



  const handleAddItem = (itemsType) => {

    if (itemsType === 'offered') {

      setFormData({

        ...formData,

        offeredItems: [...formData.offeredItems, { name: '', gameCategory: '', value: '', valueUnit: '', mutation: 'Default', traits: [], weight: '' }]

      });

    } else {

      setFormData({

        ...formData,

        wantedItems: [...formData.wantedItems, { name: '', gameCategory: '', value: '', valueUnit: '', mutation: 'Default', traits: [], weight: '' }]

      });

    }

  };



  const handleRemoveItem = (itemsType, index) => {

    if (itemsType === 'offered') {

      const updated = formData.offeredItems.filter((_, i) => i !== index);

      if (updated.length === 0) {

        updated.push({ name: '', gameCategory: '', value: '', valueUnit: '', mutation: 'Default', traits: [], weight: '' });

      }

      setFormData({ ...formData, offeredItems: updated });

    } else {

      const updated = formData.wantedItems.filter((_, i) => i !== index);

      if (updated.length === 0) {

        updated.push({ name: '', gameCategory: '', value: '', valueUnit: '', mutation: 'Default', traits: [], weight: '' });

      }

      setFormData({ ...formData, wantedItems: updated });

    }

  };



  const handleItemChange = (itemsType, index, field, value) => {
    const items = itemsType === 'offered' ? formData.offeredItems : formData.wantedItems;
    const updated = [...items];
    const currentItem = updated[index] || { name: '', gameCategory: '', value: '', valueUnit: '', mutation: 'Default', traits: [], weight: '' };
    
    // If category is changing, reset the item name and value
    if (field === 'gameCategory') {
      updated[index] = { 
        ...currentItem, 
        [field]: value,
        name: '', // Reset item name when category changes
        value: '', // Reset value when category changes
        valueUnit: '', // Reset value unit when category changes
        mutation: 'Default', // Reset mutation
        traits: [], // Reset traits
        weight: '' // Reset weight
      };
    } else {
      // Auto-calculate value for Steal a Brainrot items when name, mutation, or traits change
      if (field === 'name' || field === 'mutation' || field === 'traits') {
        const nextTraits = field === 'traits'
          ? normalizeTraitList(value)
          : normalizeTraitList(currentItem.traits);
        const newItem = { 
          ...currentItem, 
          [field]: field === 'traits' ? nextTraits : value,
          mutation: field === 'mutation' ? value : (currentItem.mutation || 'Default'),
          traits: nextTraits
        };
        
        if (newItem.gameCategory === 'STEAL A BRAINROT' && newItem.name) {

          const calculatedValue = calculateItemValue(newItem);

          if (calculatedValue !== null && calculatedValue > 0) {

            updated[index] = {

              ...newItem,

              value: formatValue(calculatedValue),

              valueUnit: getValueUnit(calculatedValue)

            };

          } else {

            // If calculation fails, still update the field but clear value

            updated[index] = {

              ...newItem,

              value: '',

              valueUnit: ''

            };

          }

        } else {

          // For non-Steal a Brainrot items, just update the field

          updated[index] = { ...currentItem, [field]: value };

        }

        // For Grow a Garden, mutations don't auto-calculate value - user enters manually

      } else {

        // For other fields, just update normally

        updated[index] = { ...currentItem, [field]: value };

      }

    }

    

    if (itemsType === 'offered') {

      setFormData({ ...formData, offeredItems: updated });

    } else {

      setFormData({ ...formData, wantedItems: updated });

    }

  };



  const handleSubmit = async (e) => {

    e.preventDefault();

    if (!user) {

      alert('Please log in to create a trade');

      return;

    }



    setSubmitting(true);

    try {

      // Filter out empty items

      const offeredItems = formData.offeredItems.filter(

        item => item.name && item.gameCategory && item.name.trim() && item.gameCategory.trim()

      );

      const wantedItems = formData.wantedItems.filter(

        item => item.name && item.gameCategory && item.name.trim() && item.gameCategory.trim()

      );



      if (offeredItems.length === 0 || wantedItems.length === 0) {

        alert('Please add at least one offered item and one wanted item');

        setSubmitting(false);

        return;

      }



      await axios.post('/api/trades', {

        offered: offeredItems,

        wanted: wantedItems

      });



      // Reset form

      setFormData({

        offeredItems: [{ name: '', gameCategory: '', value: '', valueUnit: '', mutation: 'Default', traits: [], weight: '' }],

        wantedItems: [{ name: '', gameCategory: '', value: '', valueUnit: '', mutation: 'Default', traits: [], weight: '' }]

      });

      setShowCreateForm(false);

      

      // Refresh trades list

      fetchTrades();

      alert('Trade created successfully!');

    } catch (error) {

      console.error('Error creating trade:', error);

      alert(error.response?.data?.error || 'Failed to create trade');

    } finally {

      setSubmitting(false);

    }

  };



  const formatTradeItems = (items, sectionType = 'offered') => {

    if (!items) return <div className="no-items">N/A</div>;

    if (typeof items === 'string') {

      return (

        <div className="item-card">

          <div className="item-card-image-placeholder">?</div>

          <div className="item-card-name">{items}</div>

        </div>

      );

    }

    if (Array.isArray(items)) {

      // Count duplicates for quantity

      const itemCounts = {};

      items.forEach((item) => {

        const key = typeof item === 'string' ? item : `${item.name || 'Unknown'}_${item.mutation || ''}_${JSON.stringify(item.traits || [])}`;

        if (!itemCounts[key]) {

          itemCounts[key] = { item, count: 0 };

        }

        itemCounts[key].count += 1;

      });



      const itemCards = Object.values(itemCounts).map((entry, i) => {

        const { item, count } = entry;

        

        if (typeof item === 'string') {

          return (

            <div key={i} className="item-card">

              <div className="item-card-image-placeholder">?</div>

              <div className="item-card-name">{item}</div>

              {count > 1 && <div className="item-card-qty">Qty: {count}</div>}

            </div>

          );

        }



        const name = item.name || 'Unknown';

        const isBrainrot = item.gameCategory === 'STEAL A BRAINROT';

        const isGarden = item.gameCategory === 'GROW A GARDEN';

        const itemImage = isBrainrot ? getBrainrotImage(name) : null;

        const weight = item.weight || null;

        const mutation = item.mutation && item.mutation !== 'Default' ? item.mutation : null;

        const hasTraits = item.traits && Array.isArray(item.traits) && item.traits.length > 0;

        

        return (

          <div key={i} className="item-card">

            {itemImage ? (

              <img 

                src={itemImage} 

                alt={name}

                className="item-card-image"

                onError={(e) => {

                  e.target.style.display = 'none';

                  e.target.nextSibling.style.display = 'block';

                }}

              />

            ) : (

              <div className="item-card-image-placeholder">

                {isGarden ? '🌱' : isBrainrot ? '🧠' : '🎮'}

              </div>

            )}

            <div className="item-card-name">{name}</div>

            {mutation && <div className="item-card-mutation">{mutation}</div>}

            {count > 1 && <div className="item-card-qty">Qty: {count}</div>}

            {weight && <div className="item-card-weight">Weight: {weight} kg</div>}

            {hasTraits && (

              <div className="item-card-traits">

                {item.traits.map((trait, idx) => (

                  <span key={idx} className="trait-chip-small">{trait}</span>

                ))}

              </div>

            )}

          </div>

        );

      });



      return <div className="items-grid">{itemCards}</div>;

    }

    return <div className="no-items">N/A</div>;

  };



  return (

    <div className="trades">

      <div className="trades-header">

        <h1>Trading Hub</h1>

        {user && (

          <button 

            onClick={() => setShowCreateForm(!showCreateForm)} 

            className="create-trade-toggle-btn"

          >

            {showCreateForm ? '← Cancel' : '+ Create Trade'}

          </button>

        )}

      </div>



      {showCreateForm && user && (

        <div className="create-trade-form-container">

          <div className="trade-form-header">

            <h2>Make A Trade Ad</h2>

            <p className="trade-form-subtitle">Create your personal trade advertisement and find offers!</p>

          </div>

          <form onSubmit={handleSubmit} className="create-trade-form">

            <div className="form-section-grid">

              <div className="form-section-header">

                <span className="section-bullet purple">•</span>

                <h3>My Items</h3>

              </div>

              <div className="items-grid-container">

                {formData.offeredItems.map((item, index) => (

                  <div key={index} className="selected-item-card">

                    {item.gameCategory === 'STEAL A BRAINROT' && getBrainrotImage(item.name) && (

                      <img 

                        src={getBrainrotImage(item.name)} 

                        alt={item.name}

                        className="selected-item-image"

                        onError={(e) => e.target.style.display = 'none'}

                      />

                    )}

                    <div className="selected-item-name">{item.name}</div>

                    <button

                      type="button"

                      className="remove-item-card-btn"

                      onClick={() => handleRemoveItem('offered', index)}

                    >

                      ×

                    </button>

                  </div>

                ))}

                {Array.from({ length: Math.max(4 - formData.offeredItems.length, 0) }).map((_, index) => (

                  <div

                    key={`placeholder-${index}`}

                    className="add-item-card"

                    onClick={() => {

                      setPickerContext({ type: 'offered', index: formData.offeredItems.length });

                      setShowItemPicker(true);

                    }}

                  >

                    <span className="add-item-plus">+</span>

                    <span className="add-item-text">Add Item</span>

                  </div>

                ))}

              </div>

            </div>



            {/* Legacy form section for item details - hidden but kept for functionality */}

            <div className="form-section-details" style={{ display: 'none' }}>

              <h3>Offered Items</h3>

              {formData.offeredItems.map((item, index) => (

                <div key={index} className="trade-item-input-group">

                  <SearchableSelect

                    value={item.gameCategory || ''}

                    onChange={(value) => handleItemChange('offered', index, 'gameCategory', value)}

                    options={GAME_CATEGORIES.map(cat => ({ value: cat, label: cat }))}

                    placeholder="Select Category"

                    required={true}

                    style={{ flex: '1 1 200px' }}

                  />

                  <SearchableSelect

                    value={item.name || ''}

                    onChange={(value) => handleItemChange('offered', index, 'name', value)}

                    options={getItemsForCategory(item.gameCategory).map(itemName => ({ value: itemName, label: itemName }))}

                    placeholder="Select Item"

                    required={true}

                    disabled={!item.gameCategory}

                    style={{ flex: '1 1 250px' }}

                  />

                  {item.gameCategory === 'GROW A GARDEN' && (

                    <>

                      <SearchableSelect

                        value={item.mutation || 'None'}

                        onChange={(value) => handleItemChange('offered', index, 'mutation', value)}

                        options={PET_MUTATIONS.map(mut => ({ value: mut, label: mut }))}

                        placeholder="Mutation"

                        style={{ flex: '0 1 130px' }}

                      />

                      <input

                        type="text"

                        placeholder="Weight (optional)"

                        value={item.weight || ''}

                        onChange={(e) => handleItemChange('offered', index, 'weight', e.target.value)}

                        style={{ flex: '0 1 100px' }}

                      />

                    </>

                  )}

                  {item.gameCategory === 'STEAL A BRAINROT' && (

                    <>

                      <SearchableSelect

                        value={item.mutation || 'Default'}

                        onChange={(value) => handleItemChange('offered', index, 'mutation', value)}

                        options={BRAINROT_MUTATIONS.map(mut => ({ value: mut, label: mut }))}

                        placeholder="Mutation"

                        style={{ flex: '0 1 130px' }}

                      />

                      <div style={{ flex: '0 1 200px' }}>

                        <AdvancedCategorySelect

                          value={Array.isArray(item.traits) ? item.traits : []}

                          onChange={(value) => handleItemChange('offered', index, 'traits', value)}

                          options={BRAINROT_TRAITS.map(tr => ({ value: tr, label: tr }))}

                          placeholder="Traits"

                          multiSelect={true}

                          showCounts={false}

                        />

                      </div>

                    </>

                  )}

                  {item.gameCategory !== 'GROW A GARDEN' && (

                    <input

                      type="text"

                      placeholder={item.gameCategory === 'STEAL A BRAINROT' ? 'Value (auto-calculated)' : 'Value (optional)'}

                      value={item.value || ''}

                      onChange={(e) => handleItemChange('offered', index, 'value', e.target.value)}

                      readOnly={item.gameCategory === 'STEAL A BRAINROT'}

                      style={{ flex: '1 1 150px', background: item.gameCategory === 'STEAL A BRAINROT' ? '#2f3136' : 'inherit' }}

                    />

                  )}

                  {item.gameCategory !== 'GROW A GARDEN' && (

                    <SearchableSelect

                      value={item.valueUnit || ''}

                      onChange={(value) => handleItemChange('offered', index, 'valueUnit', value)}

                      options={[

                        { value: '', label: 'Unit' },

                        { value: 'M/s', label: 'M/s' },

                        { value: 'B/s', label: 'B/s' }

                      ]}

                      placeholder="Unit"

                      disabled={item.gameCategory === 'STEAL A BRAINROT'}

                      style={{ flex: '0 1 120px' }}

                    />

                  )}

                  <button 

                    type="button" 

                    className="remove-item-btn"

                    onClick={() => handleRemoveItem('offered', index)}

                  >

                    ×

                  </button>

                </div>

              ))}

            </div>



            <div className="form-section-grid">

              <div className="form-section-header">

                <span className="section-bullet blue">•</span>

                <h3>I Want</h3>

              </div>

              <div className="items-grid-container">

                {formData.wantedItems.map((item, index) => (

                  <div 

                    key={index} 

                    className="selected-item-card"

                    onClick={() => {

                      setConfigContext({ type: 'wanted', index, item });

                      setShowItemConfig(true);

                    }}

                  >

                    {item.gameCategory === 'STEAL A BRAINROT' && getBrainrotImage(item.name) && (

                      <img 

                        src={getBrainrotImage(item.name)} 

                        alt={item.name}

                        className="selected-item-image"

                        onError={(e) => e.target.style.display = 'none'}

                      />

                    )}

                    <div className="selected-item-name">{item.name}</div>

                    {item.mutation && item.mutation !== 'Default' && item.mutation !== 'None' && (

                      <div className="selected-item-mutation">{item.mutation}</div>

                    )}

                    {Array.isArray(item.traits) && item.traits.length > 0 && (

                      <div className="selected-item-traits">

                        {item.traits.length} trait{item.traits.length > 1 ? 's' : ''}

                      </div>

                    )}

                    <button

                      type="button"

                      className="remove-item-card-btn"

                      onClick={(e) => {

                        e.stopPropagation();

                        handleRemoveItem('wanted', index);

                      }}

                    >

                      ×

                    </button>

                  </div>

                ))}

                {Array.from({ length: Math.max(4 - formData.wantedItems.length, 0) }).map((_, index) => (

                  <div

                    key={`placeholder-${index}`}

                    className="add-item-card"

                    onClick={() => {

                      setPickerContext({ type: 'wanted', index: formData.wantedItems.length });

                      setShowItemPicker(true);

                    }}

                  >

                    <span className="add-item-plus">+</span>

                    <span className="add-item-text">Add Item</span>

                  </div>

                ))}

              </div>

            </div>



            {/* Legacy form section for item details - hidden but kept for functionality */}

            <div className="form-section-details" style={{ display: 'none' }}>

              <h3>Wanted Items</h3>

              {formData.wantedItems.map((item, index) => (

                <div key={index} className="trade-item-input-group">

                  <SearchableSelect

                    value={item.gameCategory || ''}

                    onChange={(value) => handleItemChange('wanted', index, 'gameCategory', value)}

                    options={GAME_CATEGORIES.map(cat => ({ value: cat, label: cat }))}

                    placeholder="Select Category"

                    required={true}

                    style={{ flex: '1 1 200px' }}

                  />

                  <SearchableSelect

                    value={item.name || ''}

                    onChange={(value) => handleItemChange('wanted', index, 'name', value)}

                    options={getItemsForCategory(item.gameCategory).map(itemName => ({ value: itemName, label: itemName }))}

                    placeholder="Select Item"

                    required={true}

                    disabled={!item.gameCategory}

                    style={{ flex: '1 1 250px' }}

                  />

                  {item.gameCategory === 'GROW A GARDEN' && (

                    <>

                      <SearchableSelect

                        value={item.mutation || 'None'}

                        onChange={(value) => handleItemChange('wanted', index, 'mutation', value)}

                        options={PET_MUTATIONS.map(mut => ({ value: mut, label: mut }))}

                        placeholder="Mutation"

                        style={{ flex: '0 1 130px' }}

                      />

                      <input

                        type="text"

                        placeholder="Weight (optional)"

                        value={item.weight || ''}

                        onChange={(e) => handleItemChange('wanted', index, 'weight', e.target.value)}

                        style={{ flex: '0 1 100px' }}

                      />

                    </>

                  )}

                  {item.gameCategory === 'STEAL A BRAINROT' && (

                    <>

                      <SearchableSelect

                        value={item.mutation || 'Default'}

                        onChange={(value) => handleItemChange('wanted', index, 'mutation', value)}

                        options={BRAINROT_MUTATIONS.map(mut => ({ value: mut, label: mut }))}

                        placeholder="Mutation"

                        style={{ flex: '0 1 130px' }}

                      />

                      <div style={{ flex: '0 1 200px' }}>

                        <AdvancedCategorySelect

                          value={Array.isArray(item.traits) ? item.traits : []}

                          onChange={(value) => handleItemChange('wanted', index, 'traits', value)}

                          options={BRAINROT_TRAITS.map(tr => ({ value: tr, label: tr }))}

                          placeholder="Traits"

                          multiSelect={true}

                          showCounts={false}

                        />

                      </div>

                    </>

                  )}

                  {item.gameCategory !== 'GROW A GARDEN' && (

                    <input

                      type="text"

                      placeholder={item.gameCategory === 'STEAL A BRAINROT' ? 'Value (auto-calculated)' : 'Value (optional)'}

                      value={item.value || ''}

                      onChange={(e) => handleItemChange('wanted', index, 'value', e.target.value)}

                      readOnly={item.gameCategory === 'STEAL A BRAINROT'}

                      style={{ flex: '1 1 150px', background: item.gameCategory === 'STEAL A BRAINROT' ? '#2f3136' : 'inherit' }}

                    />

                  )}

                  {item.gameCategory !== 'GROW A GARDEN' && (

                    <SearchableSelect

                      value={item.valueUnit || ''}

                      onChange={(value) => handleItemChange('wanted', index, 'valueUnit', value)}

                      options={[

                        { value: '', label: 'Unit' },

                        { value: 'M/s', label: 'M/s' },

                        { value: 'B/s', label: 'B/s' }

                      ]}

                      placeholder="Unit"

                      disabled={item.gameCategory === 'STEAL A BRAINROT'}

                      style={{ flex: '0 1 120px' }}

                    />

                  )}

                  <button 

                    type="button" 

                    className="remove-item-btn"

                    onClick={() => handleRemoveItem('wanted', index)}

                  >

                    ×

                  </button>

                </div>

              ))}

              <button 

                type="button" 

                className="add-item-btn"

                onClick={() => handleAddItem('wanted')}

              >

                + Add Item

              </button>

            </div>



            <button type="submit" className="create-trade-submit-btn" disabled={submitting}>

              {submitting ? 'Creating...' : 'Create Trade'}

            </button>

          </form>



          <ItemPicker

            isOpen={showItemPicker}

            onClose={() => setShowItemPicker(false)}

            onSelect={(item) => {

              if (pickerContext.type === 'offered') {

                const newItems = [...formData.offeredItems];

                if (pickerContext.index !== null && pickerContext.index < newItems.length) {

                  newItems[pickerContext.index] = item;

                } else {

                  newItems.push(item);

                }

                setFormData({ ...formData, offeredItems: newItems });

              } else {

                const newItems = [...formData.wantedItems];

                if (pickerContext.index !== null && pickerContext.index < newItems.length) {

                  newItems[pickerContext.index] = item;

                } else {

                  newItems.push(item);

                }

                setFormData({ ...formData, wantedItems: newItems });

              }

              // Auto-open config modal for Brainrot items

              if (item.gameCategory === 'STEAL A BRAINROT') {

                const finalIndex = pickerContext.index !== null && pickerContext.index < (pickerContext.type === 'offered' ? formData.offeredItems.length : formData.wantedItems.length)

                  ? pickerContext.index

                  : (pickerContext.type === 'offered' ? formData.offeredItems.length : formData.wantedItems.length);

                setTimeout(() => {

                  setConfigContext({ 

                    type: pickerContext.type, 

                    index: finalIndex, 

                    item: item 

                  });

                  setShowItemConfig(true);

                }, 100);

              }

            }}

            selectedCategory={null}

          />



          <ItemConfigModal

            isOpen={showItemConfig}

            onClose={() => setShowItemConfig(false)}

            item={configContext.item}

            gameCategory={configContext.item?.gameCategory}

            onSave={(updatedItem) => {

              if (configContext.type === 'offered') {

                const newItems = [...formData.offeredItems];

                newItems[configContext.index] = updatedItem;

                setFormData({ ...formData, offeredItems: newItems });

              } else {

                const newItems = [...formData.wantedItems];

                newItems[configContext.index] = updatedItem;

                setFormData({ ...formData, wantedItems: newItems });

              }

            }}

          />

        </div>

      )}



      <div className="modern-search-container">
        <div className="search-bar-wrapper">
          <div className="search-input-container">
            <svg className="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.35-4.35"></path>
            </svg>
            <input
              type="text"
              className="modern-search-input"
              placeholder="Search trades by item name..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
            {search && (
              <button 
                className="clear-search-btn"
                onClick={() => {
                  setSearch('');
                  setPage(1);
                }}
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>
        </div>

        <div className="filters-container">
          <div className="filter-group">
            <label className="filter-label">Category</label>
            <select
              className="filter-select"
              value={gameCategory}
              onChange={(e) => {
                setGameCategory(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Categories</option>
              <option value="ROBLOX">Roblox</option>
              <option value="STEAL A BRAINROT">Steal a Brainrot</option>
              <option value="GROW A GARDEN">Grow a Garden</option>
            </select>
          </div>

          <div className="filter-group">
            <label className="filter-label">Sort By</label>
            <select
              className="filter-select"
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                setPage(1);
              }}
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="views">Most Views</option>
              <option value="favorites">Most Favorites</option>
            </select>
          </div>

          {(search || gameCategory) && (
            <button
              className="clear-filters-btn"
              onClick={() => {
                setSearch('');
                setGameCategory('');
                setPage(1);
              }}
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {loading ? (

        <div className="loading">Loading trades...</div>

      ) : trades.length === 0 ? (

        <div className="no-trades">No trades found.</div>

      ) : (

        <>

          <div className="trades-grid">

            {trades.map((trade) => (

              <div key={trade.id} className="trade-card">

                <div className="trade-header">

                  <div className="trade-user">

                    <img

                      src={trade.avatar || 'https://cdn.discordapp.com/embed/avatars/0.png'}

                      alt={trade.username}

                      className="trade-avatar"

                    />

                    <div className="trade-user-info">

                      <span className="trade-username">{trade.username}</span>

                      <small className="trade-timestamp">{new Date(trade.createdAt).toLocaleDateString()} • {new Date(trade.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>

                    </div>

                  </div>

                  <div className="trade-header-actions">

                    {user && (

                      <button

                        onClick={(e) => toggleWishlist(trade.id, e)}

                        className={`wishlist-btn ${wishlistIds.has(trade.id) ? 'in-wishlist' : ''}`}

                        title={wishlistIds.has(trade.id) ? 'Remove from wishlist' : 'Add to wishlist'}

                      >

                        {wishlistIds.has(trade.id) ? '❤️' : '🤍'}

                      </button>

                    )}

                    {user && trade.creatorId !== user.discordId && (

                      <button

                        onClick={() => {

                          openMessageOverlay(

                            {

                              discordId: trade.creatorId,

                              username: trade.username,

                              avatar: trade.avatar

                            },

                            trade.id

                          );

                        }}

                        className="message-trade-btn"

                        title="Chat with trader"

                      >

                        💬 Chat

                      </button>

                    )}

                    <button

                      onClick={() => copyLink(trade.id)}

                      className="copy-link-btn"

                      title="Copy link"

                    >

                      🔍

                    </button>

                  </div>

                </div>

                <div className="trade-content">

                  <div className="trade-section trade-section-offered">

                    <div className="trade-section-header">

                      <span className="section-icon">→</span>

                      <h3 className="trade-section-title">Offering ({Array.isArray(trade.offered) ? trade.offered.length : 0})</h3>

                    </div>

                    <div className="trade-items-container">

                      {formatTradeItems(trade.offered, 'offered')}

                    </div>

                  </div>

                  <div className="trade-section trade-section-wanted">

                    <div className="trade-section-header">

                      <span className="section-icon">→</span>

                      <h3 className="trade-section-title">Wants ({Array.isArray(trade.wanted) ? trade.wanted.length : 0})</h3>

                    </div>

                    <div className="trade-items-container">

                      {formatTradeItems(trade.wanted, 'wanted')}

                    </div>

                  </div>

                </div>

              </div>

            ))}

          </div>

          <div className="pagination">

            <button

              onClick={() => setPage(p => Math.max(1, p - 1))}

              disabled={page === 1}

            >

              Previous

            </button>

            <span>Page {page} of {totalPages}</span>

            <button

              onClick={() => setPage(p => Math.min(totalPages, p + 1))}

              disabled={page === totalPages}

            >

              Next

            </button>

          </div>

        </>

      )}

    </div>

  );

};



export default Trades;



