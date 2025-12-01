// Mutations for Steal a Brainrot items
export const BRAINROT_MUTATIONS = [
  'Default',      // 1x - Base mutation
  'Gold',         // 1.25x
  'Diamond',      // 1.5x
  'Rainbow',      // 10x
  'Lava',         // 6x
  'Bloodrot',     // 2x
  'Celestial',    // 4x
  'Candy',        // 4x
  'Galaxy',       // 6x (7x when event runs)
  'Yin and Yang'  // 7.5x
];

// Traits for Steal a Brainrot items
export const BRAINROT_TRAITS = [
  'La Vacca Saturno Saturnita',  // 4x
  'Bombardiro',                   // 4x
  'Raining Tacos',                // 3x
  'Tung Tung Attack',             // 4x
  'Glitch',                       // 5x
  'Crab Rave',                    // 5x
  'Fire',                         // 5x
  '4th of July',                  // 6x
  'Nyan Cats',                    // 6x
  'Rain',                         // 2.5x
  'Snow',                         // 3x
  'Starfall',                     // 3.5x
  'Concert',                      // 5x
  '10B',                          // 3x
  'Shark',                        // 3x
  'Matteo',                       // 5x
  'Brazil',                       // 6x
  'UFO',                          // 3x
  'Sleepy',                       // 0.5x (divide by 2)
  'Lightning',                    // 6x
  'Strawberry',                   // 8x
  'Mexico',                       // 5x
  'Witch',                        // 4.5x
  'Indonesia',                    // 5x
  'Meowl',                        // 7x
  'RIP',                          // 5x
  'Extinct',                      // 4x
  'Spider',                       // 4.5x
  'Paint',                        // 6x
  'Tie'                           // 4.75x
];

// Mutations for Grow a Garden pets - from official game data
export const PET_MUTATIONS = [
  'None',
  'Shiny',
  'Inverted',
  'Frozen',
  'Windy',
  'Golden',
  'Mega',
  'Tiny',
  'IronSkin',
  'Radiant',
  'Rainbow',
  'Shocked',
  'Ascended',
  'Tranquil',
  'Corrupted',
  'Fried',
  'Aromatic',
  'GiantBean',
  'Silver',
  'Glimmering',
  'Luminous',
  'Nutty',
  'Dreadbound',
  'Soulflame',
  'Spectral',
  'Nightmare',
  'Aurora',
  'Jumbo',
  'Oxpecker',
  'Giraffe',
  'Forger'
];

// NOTE: Grow a Garden pets do not have base monetary values
// They only have mutations which affect gameplay mechanics, not trade value
// Users must manually enter trade values for Grow a Garden pets

// Base income/sec values for Steal a Brainrot items - from provided secret values
const BRAINROT_BASE_INCOME = {
  'La Vacca Saturno Saturnita': 300000,        // 300K/s
  'Bisonte Giuppitere': 300000,                // 300K/s
  'Karkerkar Kurkur': 300000,                  // 300K/s
  'Los Matteos': 300000,                       // 300K/s
  'Trenostruzzo Turbo 4000': 310000,           // 310K/s
  'Jackorilla': 315000,                        // 315K/s
  'Sammyni Spyderini': 325000,                 // 325K/s
  'Torrtuginni Dragonfrutini': 350000,         // 350K/s
  'Dul Dul Dul': 375000,                       // 375K/s
  'Blackhole Goat': 400000,                    // 400K/s
  'Chachechi': 400000,                         // 400K/s
  'Agarini la Palini': 425000,                 // 425K/s
  'Los Spyderinis': 425000,                    // 425K/s
  'Fragola La La La': 450000,                  // 450K/s
  'Extinct Tralalero': 450000,                 // 450K/s
  'La Cucaracha': 475000,                      // 475K/s
  'Los Tralaleritos': 500000,                  // 500K/s
  'Los Tortus': 500000,                        // 500K/s
  'Zombie Tralala': 500000,                    // 500K/s
  'Vulturino Skeletono': 500000,               // 500K/s
  'Boatito Auratito': 525000,                  // 525K/s
  'Guerriro Digitale': 550000,                 // 550K/s
  'Yess My Examine': 575000,                   // 575K/s
  'La Karkerkar Combinasion': 600000,          // 600K/s
  'Extinct Matteo': 625000,                    // 625K/s
  'Las Tralaleritas': 650000,                  // 650K/s
  'Pumpkini Spyderini': 650000,                // 650K/s
  'job job job Sahur': 700000,                 // 700K/s
  'Frankentteo': 700000,                       // 700K/s
  'Karker Sahur': 725000,                      // 725K/s
  'Las Vaquitas Saturnitas': 750000,           // 750K/s
  'Los Karkeritos': 750000,                    // 750K/s
  'La Vacca Jacko Linterino': 850000,          // 850K/s
  'Trickolino': 900000,                        // 900K/s
  'Graipuss Medussi': 1000000,                 // 1M/s
  'Perrito Burrito': 1000000,                  // 1M/s
  '1x1x1x1': 1100000,                          // 1.1M/s
  'Nooo My Hotspot': 1500000,                  // 1.5M/s
  'Los Jobcitos': 1500000,                     // 1.5M/s
  'Noo My Examine': 1700000,                    // 1.7M/s
  'La Sahur Combinasion': 2000000,             // 2M/s
  'Telemorte': 2000000,                        // 2M/s
  'To to to Sahur': 2200000,                   // 2.2M/s
  'Pirulitoita Bicicleteira': 2500000,         // 2.5M/s
  'Pot Hotspot': 2500000,                      // 2.5M/s
  'Horegini Boom': 2700000,                    // 2.7M/s
  'Quesadilla Crocodila': 3000000,             // 3M/s
  'Pot Pumpkin': 3000000,                      // 3M/s
  'Chicleteira Bicicleteira': 3500000,         // 3.5M/s
  'Quesadillo Vampiro': 3500000,               // 3.5M/s
  'Chicleteirina Bicicleteirina': 4000000,     // 4M/s
  'Burrito Bandito': 4000000,                  // 4M/s
  'Noo My Candy': 5000000,                     // 5M/s
  'Los Nooo My Hotspotsitos': 5000000,         // 5M/s
  'Rang Ring Bus': 6000000,                    // 6M/s
  'Guest 666': 6600000,                        // 6.6M/s
  'Los Chicleteiras': 7000000,                 // 7M/s
  '67': 7500000,                               // 7.5M/s
  'La Grande Combinasion': 10000000,           // 10M/s
  'Mariachi Corazoni': 12500000,               // 12.5M/s
  'Los Combinasionas': 15000000,               // 15M/s
  'Nuclearo Dinossauro': 15000000,             // 15M/s
  'Tacorita Bicicleta': 16500000,              // 16.5M/s
  'Las Sis': 17500000,                         // 17.5M/s
  'Los Hotspotsitos': 20000000,                // 20M/s
  'Los Spooky Combinasionas': 20000000,        // 20M/s
  'Money Money Puggy': 21000000,               // 21M/s
  'Los Mobilis': 22000000,                     // 22M/s
  'Celularcini Viciosini': 22500000,           // 22.5M/s
  'Los 67': 22500000,                          // 22.5M/s
  'La Extinct Grande': 23500000,               // 23.5M/s
  'Los Bros': 24000000,                        // 24M/s
  'La Spooky Grande': 24500000,                // 24.5M/s
  'Chillin Chili': 25000000,                   // 25M/s
  'Chipso and Queso': 25000000,                // 25M/s
  'Mieteteira Chicleteira': 26000000,          // 26M/s
  'Tralaledon': 27500000,                      // 27.5M/s
  'Los Puggies': 30000000,                     // 30M/s
  'Esok Sekolah': 30000000,                    // 30M/s
  'Los Primos': 31000000,                      // 31M/s
  'Eviledon': 31500000,                        // 31.5M/s
  'Los Tacoritas': 32000000,                   // 32M/s
  'Tang Tang Keletang': 33500000,              // 33.5M/s
  'Ketupat Kepat': 35000000,                   // 35M/s
  'La Taco Combinasion': 35000000,             // 35M/s
  'Tictac Sahur': 37500000,                    // 37.5M/s
  'La Supreme Combinasion': 40000000,           // 40M/s
  'Ketchuru and Musturu': 42500000,             // 42.5M/s
  'Garama and Madundung': 50000000,            // 50M/s
  'Spaghetti Tualetti': 60000000,              // 60M/s
  'Los Spaghettis': 70000000,                  // 70M/s
  'Spooky and Pumpky': 80000000,               // 80M/s
  'La Casa Boo': 100000000,                    // 100M/s
  'Fragrama and Chocrama': 100000000,          // 100M/s
  'La Secret Combinasion': 125000000,           // 125M/s
  'Burguro And Fryuro': 150000000,             // 150M/s
  'Capitano Moby': 160000000,                  // 160M/s
  'Headless Horseman': 175000000,              // 175M/s
  'Dragon Cannelloni': 200000000,              // 200M/s
  'Lavadorito Spinito': 45000000,              // 45M/s (not in provided list, keeping)
  'Orcaledon': 40000000,                       // 40M/s (not in provided list, keeping)
  'Cooki and Milki': 0,                        // $0/s
  'LA GINGER SEKOLAH': 0,                      // $0/s
  'La Vacca Santa Clausino': 0                 // $0/s
};

/**
 * Calculate the value of a Grow a Garden pet
 * NOTE: Grow a Garden pets don't have base values - they only have mutations
 * This function returns null to indicate no auto-calculation should be done
 */
export function calculatePetValue(petName, trait = 'Normal', mutation = 'None', weight = null) {
  // Grow a Garden pets don't have monetary values - only mutations
  // Return null to indicate manual value entry is required
  return null;
}

// Mutation multipliers for Steal a Brainrot
const BRAINROT_MUTATION_MULTIPLIERS = {
  'Default': 1.0,
  'Gold': 1.25,
  'Diamond': 1.5,
  'Rainbow': 10.0,
  'Lava': 6.0,
  'Bloodrot': 2.0,
  'Celestial': 4.0,
  'Candy': 4.0,
  'Galaxy': 6.0,  // 7x when event runs, but defaulting to 6x
  'Yin and Yang': 7.5
};

// Trait multipliers for Steal a Brainrot
const BRAINROT_TRAIT_MULTIPLIERS = {
  'La Vacca Saturno Saturnita': 4.0,
  'Bombardiro': 4.0,
  'Raining Tacos': 3.0,
  'Tung Tung Attack': 4.0,
  'Glitch': 5.0,
  'Crab Rave': 5.0,
  'Fire': 5.0,
  '4th of July': 6.0,
  'Nyan Cats': 6.0,
  'Rain': 2.5,
  'Snow': 3.0,
  'Starfall': 3.5,
  'Concert': 5.0,
  '10B': 3.0,
  'Shark': 3.0,
  'Matteo': 5.0,
  'Brazil': 6.0,
  'UFO': 3.0,
  'Sleepy': 0.5,  // Divide by 2
  'Lightning': 6.0,
  'Strawberry': 8.0,
  'Mexico': 5.0,
  'Witch': 4.5,
  'Indonesia': 5.0,
  'Meowl': 7.0,
  'RIP': 5.0,
  'Extinct': 4.0,
  'Spider': 4.5,
  'Paint': 6.0,
  'Tie': 4.75
};

/**
 * Get the base income/sec for a Steal a Brainrot item
 */
export function getBrainrotValue(itemName) {
  if (!itemName) return 0;
  const value = BRAINROT_BASE_INCOME[itemName];
  if (value === undefined) {
    // Try to find a case-insensitive match
    const itemKey = Object.keys(BRAINROT_BASE_INCOME).find(
      key => key.toLowerCase() === itemName.toLowerCase()
    );
    if (itemKey) {
      return BRAINROT_BASE_INCOME[itemKey];
    }
    return 0;
  }
  return value;
}

/**
 * Calculate the value for a Steal a Brainrot item with mutation and trait multipliers
 * Formula: Base Value × Mutation Multiplier × (Sum of Trait Multipliers - number of traits + 1)
 * OR: Base Value × Mutation Multiplier × Max Trait Multiplier
 * Mutations and traits multiply with the base value only, traits don't stack multiplicatively
 * 
 * Current implementation: Uses the highest trait multiplier only (traits don't stack)
 */
export function calculateBrainrotValue(itemName, mutation = 'Default', traits = []) {
  const baseValue = getBrainrotValue(itemName);
  if (baseValue === 0) return 0;
  
  // Get mutation multiplier
  const mutationMultiplier = BRAINROT_MUTATION_MULTIPLIERS[mutation] || 1.0;
  
  // Start with base value multiplied by mutation
  let finalValue = baseValue * mutationMultiplier;
  
  // Traits multiply with the base value only - use highest trait multiplier (traits don't stack)
  const traitArray = Array.isArray(traits) ? traits : (traits ? [traits] : []);
  if (traitArray.length > 0) {
    // Find the highest trait multiplier (traits don't stack, only the best one applies)
    const maxTraitMultiplier = traitArray.reduce((max, trait) => {
      const multiplier = BRAINROT_TRAIT_MULTIPLIERS[trait] || 1.0;
      return Math.max(max, multiplier);
    }, 1.0);
    
    // Apply the highest trait multiplier to the base value
    finalValue = baseValue * mutationMultiplier * maxTraitMultiplier;
  }
  
  return Math.round(finalValue);
}

/**
 * Format a value to a readable string (e.g., "1.5B", "250M", "350K")
 */
export function formatValue(value) {
  if (!value || value === 0) return '0';
  
  if (value >= 1000000000) {
    const billions = value / 1000000000;
    return billions % 1 === 0 ? `${billions}B` : `${billions.toFixed(1)}B`;
  } else if (value >= 1000000) {
    const millions = value / 1000000;
    return millions % 1 === 0 ? `${millions}M` : `${millions.toFixed(1)}M`;
  } else if (value >= 1000) {
    const thousands = value / 1000;
    return thousands % 1 === 0 ? `${thousands}K` : `${thousands.toFixed(1)}K`;
  }
  
  return value.toString();
}

/**
 * Parse a value string (e.g., "1.5B", "250M") to a number
 */
export function parseValue(valueString) {
  if (!valueString || typeof valueString !== 'string') return 0;
  
  const clean = valueString.trim().replace(/[$,]/g, '');
  const match = clean.match(/^([\d.]+)\s*([KMkm]?|B|b|M|m)?$/i);
  
  if (!match) return 0;
  
  const number = parseFloat(match[1]);
  const unit = match[2]?.toUpperCase() || '';
  
  if (unit === 'B') return number * 1000000000;
  if (unit === 'M') return number * 1000000;
  if (unit === 'K') return number * 1000;
  
  return number;
}

/**
 * Auto-calculate value for an item based on its properties
 */
export function calculateItemValue(item) {
  if (!item || !item.name || !item.gameCategory) return null;

  const { name, gameCategory, mutation, traits } = item;

  // Grow a Garden pets - no auto-calculation (mutations don't affect monetary value)
  if (gameCategory === 'GROW A GARDEN') {
    return null; // Users must manually enter values for Grow a Garden pets
  }

  // Steal a Brainrot items - use base income/sec only
  if (gameCategory === 'STEAL A BRAINROT') {
    const traitArray = Array.isArray(traits) ? traits : (traits ? [traits] : []);
    return calculateBrainrotValue(name, mutation || 'Default', traitArray);
  }

  // Roblox items (no auto-calculation)
  if (gameCategory === 'ROBLOX') {
    return null;
  }

  return null;
}

/**
 * Get the appropriate value unit for a value
 */
export function getValueUnit(value) {
  if (!value || value === 0) return '';
  
  if (value >= 1000000000) {
    return 'B/s';
  } else if (value >= 1000000) {
    return 'M/s';
  } else if (value >= 1000) {
    return 'K/s';
  }
  
  return '/s';
}
