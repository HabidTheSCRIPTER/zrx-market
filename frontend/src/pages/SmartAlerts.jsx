import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { GAME_CATEGORIES, getItemsForCategory } from '../utils/tradeConstants';
import { BRAINROT_MUTATIONS, BRAINROT_TRAITS } from '../utils/valueCalculation';
import SearchableSelect from '../components/SearchableSelect';
import AdvancedCategorySelect from '../components/AdvancedCategorySelect';
import './SmartAlerts.css';

const SmartAlerts = () => {
  const { user, showAlert } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    itemName: '',
    gameCategory: '',
    maxPrice: '',
    minPrice: '',
    priceUnit: '',
    mutation: '',
    traits: []
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      fetchAlerts();
    }
  }, [user]);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/smart-alerts');
      setAlerts(response.data);
    } catch (error) {
      console.error('Error fetching alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      showAlert('Please log in to create alerts', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      await axios.post('/api/smart-alerts', formData);
      setFormData({
        name: '',
        itemName: '',
        gameCategory: '',
        maxPrice: '',
        minPrice: '',
        priceUnit: '',
        mutation: '',
        traits: []
      });
      setShowForm(false);
      fetchAlerts();
    } catch (error) {
      console.error('Error creating alert:', error);
      showAlert(error.response?.data?.error || 'Failed to create alert', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this alert?')) return;

    try {
      await axios.delete(`/api/smart-alerts/${id}`);
      fetchAlerts();
    } catch (error) {
      console.error('Error deleting alert:', error);
      showAlert('Failed to delete alert', 'error');
    }
  };

  const handleToggleActive = async (id, isActive) => {
    try {
      await axios.patch(`/api/smart-alerts/${id}`, { isActive: !isActive });
      fetchAlerts();
    } catch (error) {
      console.error('Error toggling alert:', error);
    }
  };

  const formatAlertCondition = (alert) => {
    const parts = [];
    if (alert.itemName) {
      parts.push(alert.itemName);
      if (alert.mutation && alert.mutation !== 'Default') {
        parts.push(`(${alert.mutation})`);
      }
    }
    if (alert.maxPrice || alert.minPrice) {
      const priceParts = [];
      if (alert.minPrice) priceParts.push(`≥ ${alert.minPrice}`);
      if (alert.maxPrice) priceParts.push(`≤ ${alert.maxPrice}`);
      if (alert.priceUnit) priceParts.push(alert.priceUnit);
      parts.push(`Price: ${priceParts.join(' ')}`);
    }
    if (alert.traits) {
      try {
        const traits = JSON.parse(alert.traits);
        if (Array.isArray(traits) && traits.length > 0) {
          parts.push(`Traits: ${traits.join(', ')}`);
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
    return parts.join(' • ');
  };

  if (!user) {
    return (
      <div className="smart-alerts-page">
        <h1>Smart Alerts</h1>
        <p>Please log in to use Smart Alerts.</p>
      </div>
    );
  }

  return (
    <div className="smart-alerts-page">
      <div className="smart-alerts-header">
        <h1>Smart Alerts</h1>
        <button onClick={() => setShowForm(!showForm)} className="create-alert-btn">
          {showForm ? '− Cancel' : '+ Create Alert'}
        </button>
      </div>

      <p className="smart-alerts-description">
        Get notified when items matching your criteria are listed. Example: "Notify me when a Diamond Capitano Moby is listed for under 1 Billion."
      </p>

      {showForm && (
        <div className="alert-form-container">
          <h2>Create New Alert</h2>
          <form onSubmit={handleSubmit} className="alert-form">
            <div className="form-group">
              <label>Alert Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Diamond Capitano Moby Alert"
                required
              />
            </div>

            <div className="form-group">
              <label>Game Category</label>
              <SearchableSelect
                value={formData.gameCategory}
                onChange={(value) => setFormData({ ...formData, gameCategory: value, itemName: '', mutation: '', traits: [] })}
                options={GAME_CATEGORIES.map(cat => ({ value: cat, label: cat }))}
                placeholder="Select Category"
              />
            </div>

            {formData.gameCategory && (
              <div className="form-group">
                <label>Item Name</label>
                <SearchableSelect
                  value={formData.itemName}
                  onChange={(value) => setFormData({ ...formData, itemName: value })}
                  options={getItemsForCategory(formData.gameCategory).map(item => ({ value: item, label: item }))}
                  placeholder="Select Item"
                  required
                />
              </div>
            )}

            {formData.gameCategory === 'STEAL A BRAINROT' && formData.itemName && (
              <>
                <div className="form-group">
                  <label>Mutation (Optional)</label>
                  <SearchableSelect
                    value={formData.mutation}
                    onChange={(value) => setFormData({ ...formData, mutation: value })}
                    options={BRAINROT_MUTATIONS.map(mut => ({ value: mut, label: mut }))}
                    placeholder="Select Mutation"
                  />
                </div>

                <div className="form-group">
                  <label>Traits (Optional)</label>
                  <AdvancedCategorySelect
                    value={formData.traits}
                    onChange={(value) => setFormData({ ...formData, traits: value })}
                    options={BRAINROT_TRAITS.map(tr => ({ value: tr, label: tr }))}
                    placeholder="Select Traits"
                    multiSelect={true}
                  />
                </div>
              </>
            )}

            <div className="form-row">
              <div className="form-group">
                <label>Minimum Price (Optional)</label>
                <input
                  type="number"
                  value={formData.minPrice}
                  onChange={(e) => setFormData({ ...formData, minPrice: e.target.value })}
                  placeholder="0"
                  step="0.01"
                />
              </div>

              <div className="form-group">
                <label>Maximum Price (Optional)</label>
                <input
                  type="number"
                  value={formData.maxPrice}
                  onChange={(e) => setFormData({ ...formData, maxPrice: e.target.value })}
                  placeholder="1000000000"
                  step="0.01"
                />
              </div>

              <div className="form-group">
                <label>Price Unit (Optional)</label>
                <SearchableSelect
                  value={formData.priceUnit}
                  onChange={(value) => setFormData({ ...formData, priceUnit: value })}
                  options={[
                    { value: '', label: 'None' },
                    { value: 'M/s', label: 'M/s' },
                    { value: 'B/s', label: 'B/s' }
                  ]}
                  placeholder="Unit"
                />
              </div>
            </div>

            <button type="submit" disabled={submitting} className="submit-btn">
              {submitting ? 'Creating...' : 'Create Alert'}
            </button>
          </form>
        </div>
      )}

      {loading ? (
        <div className="loading">Loading alerts...</div>
      ) : alerts.length === 0 ? (
        <div className="no-alerts">
          <p>No alerts yet. Create your first alert to get started!</p>
        </div>
      ) : (
        <div className="alerts-list">
          {alerts.map((alert) => (
            <div key={alert.id} className={`alert-card ${!alert.isActive ? 'inactive' : ''}`}>
              <div className="alert-card-header">
                <h3>{alert.name}</h3>
                <div className="alert-actions">
                  <button
                    onClick={() => handleToggleActive(alert.id, alert.isActive)}
                    className={`toggle-btn ${alert.isActive ? 'active' : 'inactive'}`}
                    title={alert.isActive ? 'Disable' : 'Enable'}
                  >
                    {alert.isActive ? '✓' : '○'}
                  </button>
                  <button
                    onClick={() => handleDelete(alert.id)}
                    className="delete-btn"
                    title="Delete"
                  >
                    ×
                  </button>
                </div>
              </div>
              <div className="alert-card-body">
                <p className="alert-condition">{formatAlertCondition(alert)}</p>
                {alert.lastTriggered && (
                  <p className="alert-last-triggered">
                    Last triggered: {new Date(alert.lastTriggered).toLocaleString()}
                  </p>
                )}
                <p className="alert-created">
                  Created: {new Date(alert.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SmartAlerts;

