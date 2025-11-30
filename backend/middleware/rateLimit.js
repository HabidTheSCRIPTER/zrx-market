const rateLimit = require('express-rate-limit');

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Increased to 200 requests per 15 minutes to handle polling
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict rate limiter for forms
const formLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs
  message: 'Too many form submissions, please try again later.'
});

// Auth rate limiter
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // Increased from 5 to allow more attempts during setup
  message: 'Too many authentication attempts, please try again later.'
});

// Message rate limiter - more lenient for real-time messaging and polling
const messageLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute window
  max: 120, // Allow 120 requests per minute (2 per second average) - enough for polling every 2-5 seconds
  message: 'Too many message requests, please slow down.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Message sending rate limiter - stricter for POST requests
const messageSendLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute window
  max: 30, // Allow 30 message sends per minute
  message: 'You are sending messages too quickly. Please slow down.',
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { apiLimiter, formLimiter, authLimiter, messageLimiter, messageSendLimiter };

