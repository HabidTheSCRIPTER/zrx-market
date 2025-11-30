import React from 'react';
import { useAuth } from '../context/AuthContext';
import './Home.css';

const Home = () => {
  const { user, login } = useAuth();

  return (
    <div className="home">
      <div className="hero">
        <h1>Welcome to ZRX Market</h1>
        <p className="subtitle">
          The ultimate Roblox trading marketplace. 
          Trade items safely, connect with verified traders, and build your collection with confidence.
        </p>
        {!user ? (
          <a href="/auth/discord" className="cta-button">
            Get Started with Discord
          </a>
        ) : (
          <a href="/trades" className="cta-button">
            View Trades
          </a>
        )}
      </div>
      <div className="features">
        <div className="feature-card">
          <h3>🛒 Trading Hub</h3>
          <p>
            Post your trades and discover amazing deals. Browse through listings, 
            connect with traders, and find exactly what you're looking for.
          </p>
        </div>
        <div className="feature-card">
          <h3>🤝 Middleman Service</h3>
          <p>
            Request trusted middlemen for secure transactions. Our verified 
            middlemen ensure safe trades and protect both parties.
          </p>
        </div>
        <div className="feature-card">
          <h3>🛡️ Safe Trading</h3>
          <p>
            Report scammers and keep the community safe. Our moderation team 
            actively monitors and maintains a secure trading environment.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Home;
