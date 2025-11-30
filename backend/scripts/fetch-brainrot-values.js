const axios = require('axios');
const { dbHelpers } = require('../db/config');

// List of all brainrot items to fetch values for
const BRAINROT_ITEMS = [
  "Headless Horseman", "Capitano Moby", "Dragon Cannelloni", "Burguro And Fryuro",
  "La Secret Combinasion", "La Casa Boo", "Fragrama and Chocrama", "Lavadorito Spinito",
  "Spooky and Pumpky", "Los Spaghettis", "Spaghetti Tualetti", "Garama and Madundung",
  "Ketchuru and Musturu", "La Supreme Combinasion", "Orcaledon", "Tictac Sahur",
  "Los Bros", "Ketupat Kepat", "La Taco Combinasion", "Tang Tang Keletang",
  "Los Tacoritas", "Eviledon", "Los Primos", "La Extinct Grande",
  "Fragola La La La", "Guerriro Digitale", "Boatito Auratito", "La Cucaracha",
  "Vulturino Skeletono", "Chimpanzini Spiderini", "Karkerkar Kurkur", "Los Matteos",
  "Sammyni Spyderini", "Trenostruzzo Turbo 4000", "Los Tortus", "Zombie Tralala",
  "Chachechi", "Agarini la Palini", "Jackorilla", "Blackhole Goat",
  "Bisonte Giuppitere", "La Vacca Saturno Saturnita", "Cooki and Milki",
  "LA GINGER SEKOLAH", "La Vacca Santa Clausino"
];

async function fetchBrainrotValue(itemName) {
  try {
    // Encode the item name for URL
    const encodedName = encodeURIComponent(itemName);
    const url = `https://stealabrainrot.fandom.com/wiki/${encodedName}`;
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });

    const html = response.data;
    
    // Try to extract value from the page
    // Look for common patterns like "Value:", "Worth:", numbers with M/s or B/s
    const valuePatterns = [
      /Value[:\s]+([\d,]+(?:\s*[MB]\/s)?)/i,
      /Worth[:\s]+([\d,]+(?:\s*[MB]\/s)?)/i,
      /([\d,]+)\s*([MB]\/s)/i,
      /Trading[:\s]+([\d,]+)/i
    ];
    
    let value = null;
    let rarity = 'Unknown';
    
    for (const pattern of valuePatterns) {
      const match = html.match(pattern);
      if (match) {
        // Extract numeric value
        const numStr = match[1].replace(/,/g, '');
        const numValue = parseFloat(numStr);
        if (!isNaN(numValue) && numValue > 0) {
          value = numValue;
          break;
        }
      }
    }
    
    // Try to extract rarity
    const rarityPatterns = [
      /Rarity[:\s]+(Common|Rare|Epic|Legendary|Mythic|Brainrot God|Secret|OG)/i,
      /(Common|Rare|Epic|Legendary|Mythic|Brainrot God|Secret|OG)\s*Brainrot/i
    ];
    
    for (const pattern of rarityPatterns) {
      const match = html.match(pattern);
      if (match) {
        rarity = match[1];
        break;
      }
    }
    
    return { value: value || 0, rarity };
  } catch (error) {
    console.error(`Error fetching value for ${itemName}:`, error.message);
    return { value: 0, rarity: 'Unknown' };
  }
}

async function fetchAllValues() {
  console.log('Starting to fetch brainrot values from wiki...');
  
  const values = {};
  
  for (const item of BRAINROT_ITEMS) {
    console.log(`Fetching ${item}...`);
    const data = await fetchBrainrotValue(item);
    values[item] = data;
    
    // Store in database
    try {
      await dbHelpers.run(
        'INSERT OR REPLACE INTO brainrot_values (name, value, rarity, updatedAt) VALUES (?, ?, ?, CURRENT_TIMESTAMP)',
        [item, data.value, data.rarity]
      );
      console.log(`  ✓ ${item}: ${data.value} (${data.rarity})`);
    } catch (error) {
      console.error(`  ✗ Error storing ${item}:`, error.message);
    }
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\nCompleted fetching brainrot values!');
  return values;
}

// Run if called directly
if (require.main === module) {
  fetchAllValues()
    .then(() => {
      console.log('Done!');
      process.exit(0);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { fetchBrainrotValue, fetchAllValues };




