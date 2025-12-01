// Shared constants for trade item categories and items
export const GAME_CATEGORIES = ['ROBLOX', 'STEAL A BRAINROT', 'GROW A GARDEN'];

export const ROBLOX_ITEMS = ['Robux'];

export const BRAINROT_SECRETS = [
  'Headless Horseman', 'Capitano Moby', 'Dragon Cannelloni', 'Burguro And Fryuro',
  'La Secret Combinasion', 'La Casa Boo', 'Fragrama and Chocrama', 'Lavadorito Spinito',
  'Spooky and Pumpky', 'Los Spaghettis', 'Spaghetti Tualetti', 'Garama and Madundung',
  'Ketchuru and Musturu', 'La Supreme Combinasion', 'Orcaledon', 'Tictac Sahur',
  'Los Bros', 'Ketupat Kepat', 'La Taco Combinasion', 'Tang Tang Keletang',
  'Los Tacoritas', 'Eviledon', 'Los Primos', 'La Extinct Grande',
  'Fragola La La La', 'Guerriro Digitale', 'Boatito Auratito', 'La Cucaracha',
  'Vulturino Skeletono', 'Chimpanzini Spiderini', 'Karkerkar Kurkur', 'Los Matteos',
  'Sammyni Spyderini', 'Trenostruzzo Turbo 4000', 'Los Tortus', 'Zombie Tralala',
  'Chachechi', 'Agarini la Palini', 'Jackorilla', 'Blackhole Goat',
  'Bisonte Giuppitere', 'La Vacca Saturno Saturnita', 'Cooki and Milki',
  'LA GINGER SEKOLAH', 'La Vacca Santa Clausino'
];

export const GROW_A_GARDEN_PETS = [
  'Mimic Octopus', 'Golem', 'Spaghetti Sloth', 'Disco Bee', 'Raiju', 'Spinosaurus', 'T-Rex',
  'Lobster Thermidor', 'Golden Goose', 'Griffin', 'Kitsune', 'Corrupted Kitsune', 'Apple Gazelle',
  'Phoenix', 'Lemon Lion', 'Sugar Glider', 'Space Squirrel', 'Red Panda', 'Mizuchi', 'Chinchilla',
  'Headless Horseman', 'Woody', 'Hydra', 'Lion', 'Goblin Miner', 'Ruby Squid', 'Chimera',
  'Parasaurolophus', 'Kodama', 'Corrupted Kodama', 'Tanuki', 'Sushi Bear', 'Praying Mantis',
  'Squirrel', 'Bear Bee', 'Hamster', 'Cooked Owl', 'Hyacinth Macaw', 'Tanchozuru', 'Raptor',
  'Dilophosaurus', 'Pterodactyl', 'Koi', 'Chicken Zombie', 'Junkbot', 'Red Fox', 'Dragonfly',
  'Queen Bee', 'Raccoon', 'Fennec Fox', 'Peach Wasp', 'Drake', 'Luminous Sprite', 'Swan',
  'Mallard', 'Seedling', 'Firefly', 'Tiger', 'Hex Serpent', 'Lich', 'Specter', 'Rhino',
  'Mantis Shrimp', 'Diamond Panther', 'Geode Turtle', 'Sapphire Macaw', 'Bearded Dragon', 'Pack Mule'
];

export const getItemsForCategory = (category) => {
  switch (category) {
    case 'ROBLOX':
      return ROBLOX_ITEMS;
    case 'STEAL A BRAINROT':
      return BRAINROT_SECRETS;
    case 'GROW A GARDEN':
      return GROW_A_GARDEN_PETS;
    default:
      return [];
  }
};

// Brainrot item image URLs
export const BRAINROT_IMAGES = {
  'Capitano Moby': 'https://sseweb.oss-accelerate.aliyuncs.com/images/class/Capitano%20Moby%20steal%20a%20brainrot-105531.png',
  'Dragon Cannelloni': 'https://storage.beee.pro/game_items/39533/bCQgupbWRXQ6qa9yIvSkcXqg1zSsC4i64PvGTHQr.png',
  'Burguro And Fryuro': 'https://static.wikia.nocookie.net/ukradite-breinrot/images/5/5b/BurguroAndFryuro.png/revision/latest?cb=20251010143010&path-prefix=ru',
  'La Secret Combinasion': 'https://cdn.shopify.com/s/files/1/0837/8712/0919/files/PixelatedCharacterwithBubblySorbet-Photoroom_600x600.png.webp?v=1759963490',
  'La Casa Boo': 'https://cdn.shopify.com/s/files/1/0837/8712/0919/files/Casa_Booo_600x600.webp?v=1762523288',
  'Fragrama and Chocrama': 'https://img.ssegold.com/images/items/all-server-fragrama-and-chocrama.png',
  'Lavadorito Spinito': 'https://static.wikia.nocookie.net/ukradite-breinrot/images/6/64/LavadoritoSpinito.png/revision/latest/scale-to-width-down/268?cb=20251124105959&path-prefix=ru',
  'Spooky and Pumpky': 'https://static.wikia.nocookie.net/stealabr/images/d/d6/Spookypumpky.png/revision/latest?cb=20251012023638',
  'Los Spaghettis': 'https://steal-a-brainrot.org/_next/image?url=%2Fimages%2Fbrainrots%2Flos-spaghettis.webp&w=3840&q=90',
  'Spaghetti Tualetti': 'https://www.lolga.com/uploads/images/goods/steal-a-brainrot/all-server-spaghetti-tualetti.png',
  'Garama and Madundung': 'https://static.wikia.nocookie.net/stealabr/images/e/ee/Garamadundung.png/revision/latest?cb=20250816022557',
  'Ketchuru and Musturu': 'https://static.wikia.nocookie.net/stealabr/images/1/14/Ketchuru.png/revision/latest?cb=20250830231943',
  'La Supreme Combinasion': 'https://r2.bloxbrasil.com.br/5da460b9043c6b675dd6875dd9fb27d77be8dfed7c3806e5fc1e9d40d68824d1.png',
  'Orcaledon': 'https://tse4.mm.bing.net/th/id/OIP.hVIimx7CHl02NlmFOly8DwAAAA?pid=Api&P=0&h=220',
  'Tictac Sahur': 'https://steal-a-brainrot.org/images/brainrots/tictac-sahur.webp',
  'Los Bros': 'https://gamegoods.gg/cdn/shop/files/los_bros.png?v=1757274976',
  'Ketupat Kepat': 'https://www.lolga.com/uploads/images/goods/steal-a-brainrot/all-server-daimod-ketupat-kepat.png?v=1',
  'La Taco Combinasion': 'https://roloot.shop/cdn/shop/files/LaTacoCombination.png?v=1761957950&width=2000',
  'Tang Tang Keletang': 'https://static.wikia.nocookie.net/stealabr/images/8/8f/TangTang.png/revision/latest?cb=20251014024653',
  'Los Tacoritas': 'https://static.wikia.nocookie.net/stealabr/images/4/40/My_kids_will_also_rob_you.png/revision/latest?cb=20250921171602',
  'Eviledon': 'https://static.wikia.nocookie.net/stealabr/images/7/78/Eviledonn.png/revision/latest?cb=20251012023919',
  'Los Primos': 'https://static.wikia.nocookie.net/stealabr/images/9/96/LosPrimos.png/revision/latest?cb=20251006044831',
  'La Extinct Grande': 'https://www.lolga.com/uploads/images/goods/steal-a-brainrot/all-server-la-extinct-grande.png?v=2',
  'Fragola La La La': 'https://static.wikia.nocookie.net/ukradite-breinrot/images/4/4f/FragolaLaLaLa.webp/revision/latest?cb=20250913211913&path-prefix=ru',
  'Guerriro Digitale': 'https://static.wikia.nocookie.net/stealabr/images/9/98/Guerrirodigitale.png/revision/latest?cb=20250830234708',
  'Boatito Auratito': 'https://steal-a-brainrot.org/_next/image?url=%2Fimages%2Fbrainrots%2Fboatito-auratito.webp&w=3840&q=90',
  'La Cucaracha': 'https://www.lolga.com/uploads/images/goods/steal-a-brainrot/all-server-rainbow-la-cucaracha.png',
  'Vulturino Skeletono': 'https://static.wikia.nocookie.net/9851d5c9-f1da-4f38-9202-c42dfd2ab18b/scale-to-width/755',
  'Chimpanzini Spiderini': 'https://cdn.shopify.com/s/files/1/0837/8712/0919/files/ChatGPT_Image_Aug_8__2025__01_21_30_PM-removebg-preview_180x180.png.webp?v=1754655729',
  'Karkerkar Kurkur': 'https://static.wikia.nocookie.net/stealabr/images/d/d9/Karkerkar_kurkur.png/revision/latest?cb=20250819015531',
  'Los Matteos': 'https://robloxgame.jp/wp-content/uploads/2025/09/%E5%90%8D%E7%A7%B0%E6%9C%AA%E8%A8%AD%E5%AE%9A%E3%81%AE%E3%83%87%E3%82%B6%E3%82%A4%E3%83%B3-47.png',
  'Sammyni Spyderini': 'https://static.wikitide.net/italianbrainrotwiki/thumb/6/69/Sammyini_Spyderini2.png/299px-Sammyini_Spyderini2.png',
  'Trenostruzzo Turbo 4000': 'https://static.wikia.nocookie.net/stealabr/images/b/b0/Trenostruzzo4000.png/revision/latest?cb=20250906233354',
  'Los Tortus': 'https://www.picclickimg.com/p8EAAeSwDDJpAn6A/Steal-a-Brainrot-SAB-Secret-Los-Tortus-Mutation.webp',
  'Zombie Tralala': 'https://static.wikia.nocookie.net/stealabr/images/6/62/ZombieTralala.png/revision/latest?cb=20251012025915',
  'Chachechi': 'https://storage.beee.pro/game_items/46132/wdrDYli8AloykVXsPdoWi25hleAx8VVUQQlTB5BK.png',
  'Agarini la Palini': 'https://cdn.jsdelivr.net/gh/monorolls/sas@main/Agarrini-la-Palini.png',
  'Jackorilla': 'https://tse4.mm.bing.net/th/id/OIP.vvBugnX9tmecVyUZ0SCKYQAAAA?pid=Api&P=0&h=220',
  'Blackhole Goat': 'https://a.allegroimg.com/original/1e62d9/e65681a34291a66c93f929a7eef6',
  'Bisonte Giuppitere': 'https://static.wikia.nocookie.net/stealabr/images/1/1d/Bisonte_Giuppitere_normal.png/revision/latest/scale-to-width-down/268?cb=20250824143149',
  'La Vacca Saturno Saturnita': 'https://www.pngmart.com/files/24/La-Vaca-Saturno-Saturnita-PNG-File.png',
  'Cooki and Milki': 'https://static.wikia.nocookie.net/stealabr/images/9/96/Cooki_and_Milki.png/revision/latest/scale-to-width-down/1000?cb=20251106173731',
  'LA GINGER SEKOLAH': 'https://static.wikia.nocookie.net/stealabr/images/e/e5/GingerSekolah.png/revision/latest?cb=20251125160827',
  'La Vacca Santa Clausino': 'https://steal-a-brainrot.org/images/brainrots/la-vacca-santa-clausino.webp',
  'Headless Horseman': '' // Add image URL if available
};

// Helper function to get image URL for a Brainrot item
export const getBrainrotImage = (itemName) => {
  return BRAINROT_IMAGES[itemName] || null;
};


