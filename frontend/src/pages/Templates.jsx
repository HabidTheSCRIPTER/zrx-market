import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { GAME_CATEGORIES, getItemsForCategory } from '../utils/tradeConstants';
import SearchableSelect from '../components/SearchableSelect';
import './Templates.css';

const Templates = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    offeredItems: [{ name: '', gameCategory: '', value: '', valueUnit: '' }],
    wantedItems: [{ name: '', gameCategory: '', value: '', valueUnit: '' }]
  });

  useEffect(() => {
    if (user) {
      fetchTemplates();
    }
  }, [user]);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/templates');
      setTemplates(response.data);
    } catch (error) {
      console.error('Error fetching templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = (items, setItems) => {
    setItems([...items, { name: '', gameCategory: '', value: '', valueUnit: '' }]);
  };

  const handleRemoveItem = (items, setItems, index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (items, setItems, index, field, value) => {
    const updated = [...items];
    const currentItem = updated[index];
    
    // If category is changing, reset the item name and value
    if (field === 'gameCategory') {
      updated[index] = { 
        ...currentItem, 
        [field]: value,
        name: '', // Reset item name when category changes
        value: '', // Reset value when category changes
        valueUnit: '' // Reset value unit when category changes
      };
    } else {
      updated[index] = { ...currentItem, [field]: value };
    }
    
    setItems(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        name: formData.name,
        offered: formData.offeredItems,
        wanted: formData.wantedItems
      };

      if (editingTemplate) {
        await axios.put(`/api/templates/${editingTemplate.id}`, payload);
      } else {
        await axios.post('/api/templates', payload);
      }

      setShowCreateForm(false);
      setEditingTemplate(null);
      setFormData({
        name: '',
        offeredItems: [{ name: '', gameCategory: '', value: '', valueUnit: '' }],
        wantedItems: [{ name: '', gameCategory: '', value: '', valueUnit: '' }]
      });
      fetchTemplates();
    } catch (error) {
      console.error('Error saving template:', error);
      alert('Failed to save template');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this template?')) return;
    try {
      await axios.delete(`/api/templates/${id}`);
      fetchTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      alert('Failed to delete template');
    }
  };

  const handleUseTemplate = (template) => {
    navigate('/trades', { state: { template } });
  };

  const handleEdit = (template) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      offeredItems: template.offered || [{ name: '', gameCategory: '', value: '', valueUnit: '' }],
      wantedItems: template.wanted || [{ name: '', gameCategory: '', value: '', valueUnit: '' }]
    });
    setShowCreateForm(true);
  };

  if (!user) {
    return (
      <div className="templates-page">
        <h1>Templates</h1>
        <p>Please log in to manage your templates.</p>
      </div>
    );
  }

  return (
    <div className="templates-page">
      <div className="templates-header">
        <h1>Trade Templates</h1>
        <button onClick={() => setShowCreateForm(true)} className="create-template-btn">
          + Create Template
        </button>
      </div>

      {showCreateForm && (
        <div className="template-form-container">
          <h2>{editingTemplate ? 'Edit Template' : 'Create New Template'}</h2>
          <form onSubmit={handleSubmit} className="template-form">
            <div className="form-group">
              <label>Template Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                placeholder="e.g., Robux for Brainrot Secrets"
              />
            </div>

            <div className="form-section">
              <h3>Offered Items</h3>
              {formData.offeredItems.map((item, index) => (
                <div key={index} className="item-input-group">
                  <SearchableSelect
                    value={item.gameCategory || ''}
                    onChange={(value) => handleItemChange(formData.offeredItems, (items) => setFormData({ ...formData, offeredItems: items }), index, 'gameCategory', value)}
                    options={GAME_CATEGORIES.map(cat => ({ value: cat, label: cat }))}
                    placeholder="Select Category"
                    required={true}
                    style={{ flex: '1 1 200px' }}
                  />
                  <SearchableSelect
                    value={item.name || ''}
                    onChange={(value) => handleItemChange(formData.offeredItems, (items) => setFormData({ ...formData, offeredItems: items }), index, 'name', value)}
                    options={getItemsForCategory(item.gameCategory).map(itemName => ({ value: itemName, label: itemName }))}
                    placeholder="Select Item"
                    required={true}
                    disabled={!item.gameCategory}
                    style={{ flex: '1 1 250px' }}
                  />
                  <input
                    type="text"
                    placeholder="Value"
                    value={item.value}
                    onChange={(e) => handleItemChange(formData.offeredItems, (items) => setFormData({ ...formData, offeredItems: items }), index, 'value', e.target.value)}
                  />
                  <SearchableSelect
                    value={item.valueUnit || ''}
                    onChange={(value) => handleItemChange(formData.offeredItems, (items) => setFormData({ ...formData, offeredItems: items }), index, 'valueUnit', value)}
                    options={[
                      { value: '', label: 'Unit' },
                      { value: 'M/s', label: 'M/s' },
                      { value: 'B/s', label: 'B/s' }
                    ]}
                    placeholder="Unit"
                    style={{ flex: '0 1 120px' }}
                  />
                  <button type="button" onClick={() => handleRemoveItem(formData.offeredItems, (items) => setFormData({ ...formData, offeredItems: items }), index)}>×</button>
                </div>
              ))}
              <button type="button" onClick={() => handleAddItem(formData.offeredItems, (items) => setFormData({ ...formData, offeredItems: items }))}>+ Add Item</button>
            </div>

            <div className="form-section">
              <h3>Wanted Items</h3>
              {formData.wantedItems.map((item, index) => (
                <div key={index} className="item-input-group">
                  <SearchableSelect
                    value={item.gameCategory || ''}
                    onChange={(value) => handleItemChange(formData.wantedItems, (items) => setFormData({ ...formData, wantedItems: items }), index, 'gameCategory', value)}
                    options={GAME_CATEGORIES.map(cat => ({ value: cat, label: cat }))}
                    placeholder="Select Category"
                    required={true}
                    style={{ flex: '1 1 200px' }}
                  />
                  <SearchableSelect
                    value={item.name || ''}
                    onChange={(value) => handleItemChange(formData.wantedItems, (items) => setFormData({ ...formData, wantedItems: items }), index, 'name', value)}
                    options={getItemsForCategory(item.gameCategory).map(itemName => ({ value: itemName, label: itemName }))}
                    placeholder="Select Item"
                    required={true}
                    disabled={!item.gameCategory}
                    style={{ flex: '1 1 250px' }}
                  />
                  <input
                    type="text"
                    placeholder="Value"
                    value={item.value}
                    onChange={(e) => handleItemChange(formData.wantedItems, (items) => setFormData({ ...formData, wantedItems: items }), index, 'value', e.target.value)}
                  />
                  <SearchableSelect
                    value={item.valueUnit || ''}
                    onChange={(value) => handleItemChange(formData.wantedItems, (items) => setFormData({ ...formData, wantedItems: items }), index, 'valueUnit', value)}
                    options={[
                      { value: '', label: 'Unit' },
                      { value: 'M/s', label: 'M/s' },
                      { value: 'B/s', label: 'B/s' }
                    ]}
                    placeholder="Unit"
                    style={{ flex: '0 1 120px' }}
                  />
                  <button type="button" onClick={() => handleRemoveItem(formData.wantedItems, (items) => setFormData({ ...formData, wantedItems: items }), index)}>×</button>
                </div>
              ))}
              <button type="button" onClick={() => handleAddItem(formData.wantedItems, (items) => setFormData({ ...formData, wantedItems: items }))}>+ Add Item</button>
            </div>

            <div className="form-actions">
              <button type="submit">{editingTemplate ? 'Update' : 'Create'} Template</button>
              <button type="button" onClick={() => {
                setShowCreateForm(false);
                setEditingTemplate(null);
                setFormData({
                  name: '',
                  offeredItems: [{ name: '', gameCategory: '', value: '', valueUnit: '' }],
                  wantedItems: [{ name: '', gameCategory: '', value: '', valueUnit: '' }]
                });
              }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="loading">Loading templates...</div>
      ) : templates.length === 0 ? (
        <div className="empty-templates">
          <p>No templates yet. Create one to quickly post similar trades!</p>
        </div>
      ) : (
        <div className="templates-grid">
          {templates.map(template => (
            <div key={template.id} className="template-card">
              <div className="template-card-header">
                <h3>{template.name}</h3>
                <div className="template-actions">
                  <button onClick={() => handleUseTemplate(template)} className="use-btn">Use</button>
                  <button onClick={() => handleEdit(template)} className="edit-btn">Edit</button>
                  <button onClick={() => handleDelete(template.id)} className="delete-btn">Delete</button>
                </div>
              </div>
              <div className="template-content">
                <div className="template-section">
                  <strong>Offered:</strong>
                  <div className="items-list">
                    {template.offered?.map((item, i) => (
                      <span key={i} className="item-tag">
                        {item.name} {item.value && `(${item.value} ${item.valueUnit || ''})`}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="template-section">
                  <strong>Wanted:</strong>
                  <div className="items-list">
                    {template.wanted?.map((item, i) => (
                      <span key={i} className="item-tag">
                        {item.name} {item.value && `(${item.value} ${item.valueUnit || ''})`}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Templates;

