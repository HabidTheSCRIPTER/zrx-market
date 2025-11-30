const { dbHelpers } = require('../db/config');

// Parse the values provided by the user
const brainrotValues = {
  "Las Sis": { price: "25B", rarity: "Secret" },
  "La Vacca Saturno Saturnita": { price: "50M", rarity: "Secret" },
  "Blackhole Goat": { price: "75M", rarity: "Secret" },
  "Bisonte Giuppitere": { price: "75M", rarity: "Secret" },
  "Agarini la Palini": { price: "80M", rarity: "Secret" },
  "Chachechi": { price: "85M", rarity: "Secret" },
  "Los Tralaleritos": { price: "100M", rarity: "Secret" },
  "Los Matteos": { price: "100M", rarity: "Secret" },
  "Trenostruzzo Turbo 4000": { price: "100M", rarity: "Secret" },
  "Guerriro Digitale": { price: "120M", rarity: "Secret" },
  "Fragola La La La": { price: "125M", rarity: "Secret" },
  "Extinct Tralalero": { price: "125M", rarity: "Secret" },
  "Extinct Matteo": { price: "140M", rarity: "Secret" },
  "Las Tralaleritas": { price: "150M", rarity: "Secret" },
  "La Karkerkar Combinasion": { price: "160M", rarity: "Secret" },
  "Job Job Job Sahur": { price: "175M", rarity: "Secret" },
  "Las Vaquitas Saturnitas": { price: "200M", rarity: "Secret" },
  "Los Spyderinis": { price: "250M", rarity: "Secret" },
  "Graipuss Medussi": { price: "250M", rarity: "Secret" },
  "Nooo My Hotspot": { price: "500M", rarity: "Secret" },
  "Torrtuginni Dragonfrutini": { price: "125M", rarity: "Secret" },
  "Pot Hotspot": { price: "600M", rarity: "Secret" },
  "La Sahur Combinasion": { price: "550M", rarity: "Secret" },
  "Chicleteira Bicicleteira": { price: "750M", rarity: "Secret" },
  "Los Nooo My Hotspotsitos": { price: "1B", rarity: "Secret" },
  "67": { price: "1.2B", rarity: "Secret" },
  "Los Chicleteiras": { price: "1.2B", rarity: "Secret" },
  "Los Combinasionas": { price: "2B", rarity: "Secret" },
  "Tacorita Bicicleta": { price: "2.2B", rarity: "Secret" },
  "Nuclearo Dinossauro": { price: "2.5B", rarity: "Secret" },
  "Celularcini Viciosini": { price: "2.7B", rarity: "Secret" },
  "Los Hotspotsitos": { price: "3B", rarity: "Secret" },
  "Tralaledon": { price: "3B", rarity: "Secret" },
  "Esok Sekolah": { price: "3.5B", rarity: "Secret" },
  "Ketupat Kepat": { price: "5B", rarity: "Secret" },
  "La Supreme Combinasion": { price: "7B", rarity: "Secret" },
  "Ketchuru and Musturu": { price: "7.5B", rarity: "Secret" },
  "Garama and Madundung": { price: "10B", rarity: "Secret" },
  "Spaghetti Tualetti": { price: "15B", rarity: "Secret" },
  "Los Bros": { price: "6B", rarity: "Secret" },
  "Dragon Cannelloni": { price: "100B", rarity: "Secret" },
  "Perrito Burrito": { price: "250M", rarity: "Secret" },
  "Chillin Chili": { price: "3B", rarity: "Secret" },
  "Karker Sahur": { price: "185M", rarity: "Secret" },
  "Los Primos": { price: "3.7B", rarity: "Secret" },
  "Los Tacoritas": { price: "4B", rarity: "Secret" },
  "Yess My Examine": { price: "130M", rarity: "Secret" },
  "Noo My Examine": { price: "525M", rarity: "Secret" },
  "Money Money Puggy": { price: "2.6B", rarity: "Secret" },
  "Tang Tang Keletang": { price: "4.5B", rarity: "Secret" },
  "Los Tortus": { price: "100M", rarity: "Secret" },
  "Los Karkeritos": { price: "200M", rarity: "Secret" },
  "Los Jobcitos": { price: "500M", rarity: "Secret" },
  "La Secret Combinasion": { price: "50B", rarity: "Secret" },
  "Burguro And Fryuro": { price: "75B", rarity: "Secret" },
  "Los 67": { price: "2.7B", rarity: "Secret" },
  "La Cucaracha": { price: "110M", rarity: "Secret" },
  "To to to Sahur": { price: "575M", rarity: "Secret" },
  "Mariachi Corazoni": { price: "1.7B", rarity: "Secret" },
  "Tictac Sahur": { price: "6B", rarity: "Secret" },
  "Quesadilla Crocodila": { price: "700M", rarity: "Secret" },
  "La Extinct Grande": { price: "3.2B", rarity: "Secret" },
  "Sammyni Spyderini": { price: "100M", rarity: "Secret" },
  "Dul Dul Dul": { price: "150M", rarity: "Secret" },
  "Karkerkar Kurkur": { price: "100M", rarity: "Secret" },
  "Chimpanzini Spiderini": { price: "100M", rarity: "Secret" },
  "La Grande Combinasion": { price: "1B", rarity: "Secret" },
  "Spooky and Pumpky": { price: "25B", rarity: "Secret" },
  "Eviledon": { price: "3.8B", rarity: "Secret" },
  "La Spooky Grande": { price: "2.9B", rarity: "Secret" },
  "Los Mobilis": { price: "2.7B", rarity: "Secret" },
  "Chicleteirina Bicicleteirina": { price: "850M", rarity: "Secret" },
  "La Vacca Jacko Linterino": { price: "225M", rarity: "Secret" },
  "Frankentteo": { price: "175M", rarity: "Secret" },
  "Zombie Tralala": { price: "100M", rarity: "Secret" },
  "Vulturino Skeletono": { price: "110M", rarity: "Secret" },
  "Mieteteira Chicleteira": { price: "2.7B", rarity: "Secret" },
  "Rang Ring Bus": { price: "1.1B", rarity: "Secret" },
  "Horegini Boom": { price: "650M", rarity: "Secret" },
  "Boatito Auratito": { price: "115M", rarity: "Secret" },
  "Headless Horseman": { price: "150B", rarity: "Secret" },
  "La Casa Boo": { price: "40B", rarity: "Secret" },
  "Los Spooky Combinasionas": { price: "3B", rarity: "Secret" },
  "Noo My Candy": { price: "900M", rarity: "Secret" },
  "Pot Pumpkin": { price: "700M", rarity: "Secret" },
  "Telemorte": { price: "550M", rarity: "Secret" },
  "Trickolino": { price: "235M", rarity: "Secret" },
  "Pumpkini Spyderini": { price: "165M", rarity: "Secret" },
  "Jackorilla": { price: "80M", rarity: "Secret" },
  "1x1x1x1": { price: "256M", rarity: "Secret" },
  "Guest 666": { price: "1.1B", rarity: "Secret" },
  "Capitano Moby": { price: "125B", rarity: "Secret" },
  "Pirulitoita Bicicleteira": { price: "600M", rarity: "Secret" },
  "Los Puggies": { price: "3B", rarity: "Secret" },
  "Los Spaghettis": { price: "20B", rarity: "Secret" },
  "Fragrama and Chocrama": { price: "40B", rarity: "Secret" },
  "Swag Soda": { price: "1.8B", rarity: "Secret" },
  "Orcaledon": { price: "7B", rarity: "Secret" },
  "Los Cucarachas": { price: "300M", rarity: "Secret" },
  "Los Quesadillas": { price: "875M", rarity: "Secret" },
  "Los Burritos": { price: "1.4B", rarity: "Secret" },
  "Fishino Clownino": { price: "2.1B", rarity: "Secret" },
  "Cuadramat and Pakrahmatmamat": { price: "400M", rarity: "Secret" },
  "Los Planitos": { price: "2.7B", rarity: "Secret" },
  "Lavadorito Spinito": { price: "30B", rarity: "Secret" },
  "W or L": { price: "3B", rarity: "Secret" },
  "Gobblino Uniciclino": { price: "2.8B", rarity: "Secret" },
  "Strawberry Elephant": { price: "500B", rarity: "OG" }
};

// Convert price string (e.g., "25B", "50M", "1.2B") to number
function parsePrice(priceStr) {
  if (!priceStr) return 0;
  
  const cleanPrice = priceStr.replace(/[$,]/g, '').trim();
  const match = cleanPrice.match(/^([\d.]+)([MB])$/i);
  
  if (!match) return 0;
  
  const number = parseFloat(match[1]);
  const unit = match[2].toUpperCase();
  
  if (unit === 'B') {
    return number * 1000000000; // Billions
  } else if (unit === 'M') {
    return number * 1000000; // Millions
  }
  
  return number;
}

async function populateValues() {
  console.log('Populating brainrot values...\n');
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const [name, data] of Object.entries(brainrotValues)) {
    try {
      const value = parsePrice(data.price);
      const rarity = data.rarity || 'Secret';
      
      await dbHelpers.run(
        'INSERT OR REPLACE INTO brainrot_values (name, value, rarity, updatedAt) VALUES (?, ?, ?, CURRENT_TIMESTAMP)',
        [name, value, rarity]
      );
      
      console.log(`✓ ${name}: ${data.price} (${value.toLocaleString()}) - ${rarity}`);
      successCount++;
    } catch (error) {
      console.error(`✗ Error storing ${name}:`, error.message);
      errorCount++;
    }
  }
  
  console.log(`\nCompleted! Success: ${successCount}, Errors: ${errorCount}`);
}

// Run if called directly
if (require.main === module) {
  populateValues()
    .then(() => {
      console.log('\nDone!');
      process.exit(0);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { populateValues, parsePrice };




