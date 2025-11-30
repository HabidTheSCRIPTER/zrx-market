import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import './ReviewForm.css';

const ReviewForm = ({ tradeId, revieweeId, revieweeUsername, onClose, onSuccess }) => {
  const { user } = useAuth();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      await axios.post('/api/reviews', {
        tradeId,
        revieweeId,
        rating,
        comment: comment.trim() || null
      });

      if (onSuccess) onSuccess();
      if (onClose) onClose();
    } catch (error) {
      setError(error.response?.data?.error || 'Error submitting review');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="review-form-overlay" onClick={onClose}>
      <div className="review-form-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Review {revieweeUsername}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Rating *</label>
            <div className="rating-input">
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  type="button"
                  className={`star-btn ${star <= rating ? 'active' : ''}`}
                  onClick={() => setRating(star)}
                >
                  ⭐
                </button>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label>Comment (optional)</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows="4"
              placeholder="Share your experience..."
            />
          </div>
          {error && <div className="error-message">{error}</div>}
          <div className="form-actions">
            <button type="button" onClick={onClose} className="cancel-btn">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="submit-btn">
              {submitting ? 'Submitting...' : 'Submit Review'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReviewForm;




