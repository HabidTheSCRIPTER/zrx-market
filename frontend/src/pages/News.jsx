import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import AdvancedCategorySelect from '../components/AdvancedCategorySelect';
import './News.css';

const News = () => {
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeCategory, setActiveCategory] = useState('all'); // 'all', 'stealabrainrot', 'growagarden'

  useEffect(() => {
    fetchNews();
  }, []);

  const fetchNews = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get('/api/news');
      
      // Check if response is an error object
      if (response.data && response.data.error) {
        throw new Error(response.data.error);
      }
      
      // Ensure we have an array
      const updatesData = Array.isArray(response.data) ? response.data : [];
      
      if (updatesData.length === 0) {
        setError('No news updates available. The news feed might be temporarily unavailable.');
      }
      
      setUpdates(updatesData);
    } catch (error) {
      console.error('Error fetching news:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Failed to load news updates. Please try again later.';
      setError(errorMessage);
      setUpdates([]);
    } finally {
      setLoading(false);
    }
  };

  // Organize updates by game category
  const categorizedUpdates = useMemo(() => {
    const categories = {
      'Steal a Brainrot': [],
      'Grow a Garden': [],
      'Other': []
    };

    updates.forEach(update => {
      const game = update.game || 'Other';
      if (game in categories) {
        categories[game].push(update);
      } else {
        categories['Other'].push(update);
      }
    });

    return categories;
  }, [updates]);

  // Filter updates based on active category
  const filteredUpdates = useMemo(() => {
    if (activeCategory === 'all') {
      return updates;
    } else if (activeCategory === 'stealabrainrot') {
      return categorizedUpdates['Steal a Brainrot'];
    } else if (activeCategory === 'growagarden') {
      return categorizedUpdates['Grow a Garden'];
    }
    return [];
  }, [updates, activeCategory, categorizedUpdates]);

  const formatDate = (dateString) => {
    // Try to parse and format the date
    try {
      // Handle various date formats from the wiki
      const cleaned = dateString.replace(/[^\d\/\s\w,]/g, '').trim();
      return cleaned;
    } catch (e) {
      return dateString;
    }
  };

  const formatContent = (content) => {
    if (!content) return [];
    // Split by common separators and format as list
    const lines = content
      .split(/\n|•|-\s+|•\s+/)
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.match(/^Update \d+$/i));
    
    return lines;
  };

  const renderUpdateCard = (update, index) => {
    const contentLines = formatContent(update.content);
    return (
      <div key={index} className="update-card">
        <div className="update-header">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h2 className="update-title">{update.update || 'Update'}</h2>
          </div>
          <div style={{ marginTop: '0.5rem', color: '#a0a0a0', fontSize: '0.9em' }}>
            {formatDate(update.date || '')}
          </div>
        </div>
        <div className="update-content">
          {contentLines.length > 0 ? (
            <ul className="update-list">
              {contentLines.slice(0, 15).map((line, lineIndex) => (
                <li key={lineIndex}>{line}</li>
              ))}
              {contentLines.length > 15 && (
                <li className="more-content">... and more</li>
              )}
            </ul>
          ) : (
            <p className="update-text">{update.content?.substring(0, 500) || 'No content available'}</p>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="news-page">
        <h1>Game News & Updates</h1>
        <div className="loading">Loading updates...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="news-page">
        <h1>Game News & Updates</h1>
        <div className="error-message">{error}</div>
        <button onClick={fetchNews} className="retry-btn">Retry</button>
      </div>
    );
  }

  return (
    <div className="news-page">
      <div className="news-header">
        <h1>Game Updates & News</h1>
        <p className="news-subtitle">Latest updates from Steal a Brainrot and Grow a Garden</p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap', marginTop: '1rem' }}>
          <a 
            href="https://stealabrainrot.fandom.com/wiki/Steal_a_Brainrot_(Game)/Updates" 
            target="_blank" 
            rel="noopener noreferrer"
            className="wiki-link"
          >
            Steal a Brainrot Updates →
          </a>
          <a 
            href="https://growagarden.fandom.com/wiki/Update_Log" 
            target="_blank" 
            rel="noopener noreferrer"
            className="wiki-link"
          >
            Grow a Garden Updates →
          </a>
        </div>
      </div>

      {/* Advanced Category Filter */}
      {updates.length > 0 && (
        <div className="news-category-filter-container">
          <AdvancedCategorySelect
            value={activeCategory}
            onChange={setActiveCategory}
            options={[
              {
                value: 'all',
                label: 'All Updates',
                count: updates.length,
                icon: '📰'
              },
              {
                value: 'stealabrainrot',
                label: 'Steal a Brainrot',
                count: categorizedUpdates['Steal a Brainrot'].length,
                icon: '🎮'
              },
              {
                value: 'growagarden',
                label: 'Grow a Garden',
                count: categorizedUpdates['Grow a Garden'].length,
                icon: '🌱'
              }
            ]}
            placeholder="Filter by category..."
            showCounts={true}
            className="news-category-select"
          />
        </div>
      )}

      {updates.length === 0 && !error && (
        <div className="no-updates">
          <p>No updates available at the moment. This could mean:</p>
          <ul style={{ textAlign: 'left', maxWidth: '500px', margin: '1rem auto' }}>
            <li>The news feed is temporarily unavailable</li>
            <li>The wiki page structure has changed</li>
            <li>No recent updates have been published</li>
          </ul>
          <button onClick={fetchNews} className="retry-btn">Try Refreshing</button>
          <p style={{ marginTop: '1rem', fontSize: '0.9em', color: '#888' }}>
            You can also visit the <a href="https://stealabrainrot.fandom.com/wiki/Steal_a_Brainrot_(Game)/Updates" target="_blank" rel="noopener noreferrer" style={{ color: '#7289DA' }}>Steal a Brainrot updates</a> or <a href="https://growagarden.fandom.com/wiki/Update_Log" target="_blank" rel="noopener noreferrer" style={{ color: '#7289DA' }}>Grow a Garden updates</a> directly.
          </p>
        </div>
      )}
      
      {/* Organized by Category View */}
      {updates.length > 0 && activeCategory === 'all' && (
        <div className="news-by-category">
          {/* Steal a Brainrot Section */}
          {categorizedUpdates['Steal a Brainrot'].length > 0 && (
            <div className="update-category-section">
              <div className="category-header">
                <h2 className="category-title">
                  <span className="category-icon">🎮</span>
                  Steal a Brainrot Updates
                </h2>
                <span className="category-count">{categorizedUpdates['Steal a Brainrot'].length} updates</span>
              </div>
              <div className="updates-list">
                {categorizedUpdates['Steal a Brainrot'].map((update, index) => renderUpdateCard(update, index))}
              </div>
            </div>
          )}

          {/* Grow a Garden Section */}
          {categorizedUpdates['Grow a Garden'].length > 0 && (
            <div className="update-category-section">
              <div className="category-header">
                <h2 className="category-title">
                  <span className="category-icon">🌱</span>
                  Grow a Garden Updates
                </h2>
                <span className="category-count">{categorizedUpdates['Grow a Garden'].length} updates</span>
              </div>
              <div className="updates-list">
                {categorizedUpdates['Grow a Garden'].map((update, index) => renderUpdateCard(update, index))}
              </div>
            </div>
          )}

          {/* Other Section (if any) */}
          {categorizedUpdates['Other'].length > 0 && (
            <div className="update-category-section">
              <div className="category-header">
                <h2 className="category-title">
                  <span className="category-icon">📰</span>
                  Other Updates
                </h2>
                <span className="category-count">{categorizedUpdates['Other'].length} updates</span>
              </div>
              <div className="updates-list">
                {categorizedUpdates['Other'].map((update, index) => renderUpdateCard(update, index))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filtered View (Single Category) */}
      {updates.length > 0 && activeCategory !== 'all' && (
        <div className="updates-list">
          {filteredUpdates.length > 0 ? (
            filteredUpdates.map((update, index) => renderUpdateCard(update, index))
          ) : (
            <div className="no-updates">
              <p>No updates found in this category.</p>
            </div>
          )}
        </div>
      )}

      <div className="news-footer">
        <p>Updates are fetched from the <a href="https://stealabrainrot.fandom.com/wiki/Steal_a_Brainrot_(Game)/Updates" target="_blank" rel="noopener noreferrer">Steal a Brainrot Wiki</a> and <a href="https://growagarden.fandom.com/wiki/Update_Log" target="_blank" rel="noopener noreferrer">Grow a Garden Wiki</a></p>
        <p className="last-updated">Last updated: {new Date().toLocaleString()}</p>
      </div>
    </div>
  );
};

export default News;
