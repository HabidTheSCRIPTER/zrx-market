const { body, validationResult } = require('express-validator');

// Validation middleware
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      error: errors.array().map(e => e.msg).join(', '),
      errors: errors.array() 
    });
  }
  next();
};

// Trade validation rules
const validateTrade = [
  body('offered')
    .isArray()
    .withMessage('Offered items must be an array'),
  body('wanted')
    .isArray()
    .withMessage('Wanted items must be an array'),
  body('value').optional().trim(),
  body('notes').optional().trim(),
  validate
];

// Middleman request validation is now handled via file upload middleware

// Report validation is now handled via file upload middleware

module.exports = {
  validate,
  validateTrade
};

