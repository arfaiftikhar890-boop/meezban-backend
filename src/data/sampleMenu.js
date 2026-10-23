// Mezbaan menu, taken from the client's latest menu list (New Note PDF, 23 Oct 2026).
// Only these items are loaded by reset-menu.js. Item names, prices and categories follow the client's list.
export const SAMPLE_MENU = [
  // Pulao
  { category: 'Pulao', name: 'Beef Yakhni Pulao (1 KG)', price: 1200, description: 'Beef yakhni pulao, 1 kg.', featured: true, photo: 'beef-yakhni-pulao.jpg' },
  { category: 'Pulao', name: 'Beef Yakhni Pulao (1/2 KG)', price: 600, description: 'Beef yakhni pulao, half kg.', photo: 'beef-yakhni-pulao.jpg' },
  { category: 'Pulao', name: 'Beef Yakhni Pulao (1/4 KG)', price: 300, description: 'Beef yakhni pulao, quarter kg.', photo: 'beef-yakhni-pulao.jpg' },
  { category: 'Pulao', name: 'Mutton Yakhni Pulao (1 KG)', price: 1800, description: 'Mutton yakhni pulao, 1 kg.', featured: true },
  { category: 'Pulao', name: 'Mutton Yakhni Pulao (1/2 KG)', price: 900, description: 'Mutton yakhni pulao, half kg.' },
  { category: 'Pulao', name: 'Mutton Yakhni Pulao (1/4 KG)', price: 450, description: 'Mutton yakhni pulao, quarter kg.' },
  { category: 'Pulao', name: 'Chicken White Pulao (1 KG)', price: 800, description: 'Chicken white pulao, 1 kg.', photo: 'white-chicken-pulao.jpg' },
  { category: 'Pulao', name: 'Chicken White Pulao (1/2 KG)', price: 400, description: 'Chicken white pulao, half kg.', photo: 'white-chicken-pulao.jpg' },
  { category: 'Pulao', name: 'Chicken White Pulao (1/4 KG)', price: 200, description: 'Chicken white pulao, quarter kg.', photo: 'white-chicken-pulao.jpg' },
  { category: 'Pulao', name: 'Chana Pulao (1 KG)', price: 520, description: 'Chana pulao, 1 kg.', photo: 'chana-pulao.jpg' },
  { category: 'Pulao', name: 'Chana Pulao (1/2 KG)', price: 260, description: 'Chana pulao, half kg.', photo: 'chana-pulao.jpg' },
  { category: 'Pulao', name: 'Chana Pulao (1/4 KG)', price: 130, description: 'Chana pulao, quarter kg.', photo: 'chana-pulao.jpg' },

  // Biryani Pot
  { category: 'Biryani Pot', name: 'Beef Yakhni Pulao (1 KG Pot)', price: 3200, description: 'Full pot, 1 kg.', photo: 'beef-yakhni-pot.jpg' },
  { category: 'Biryani Pot', name: 'Beef Biryani (1 KG Pot)', price: 3000, description: 'Full pot, 1 kg.', photo: 'beef-biryani-pot.jpg' },
  { category: 'Biryani Pot', name: 'Chicken White Biryani (1 KG Pot)', price: 2700, description: 'Full pot, 1 kg.', photo: 'chicken-white-biryani-pot.jpg' },
  { category: 'Biryani Pot', name: 'Chicken Biryani (1 KG Pot)', price: 2500, description: 'Full pot, 1 kg.', photo: 'chicken-biryani-pot.jpg' },

  // Platters
  { category: 'Platters', name: '2 Person Platter', price: 1799, description: 'Platter for two.', featured: true, photo: 'platter-2-person.jpg' },
  { category: 'Platters', name: '4 Person Platter', price: 3199, description: 'Platter for four.', photo: 'platter-4-person.jpg' },
  { category: 'Platters', name: 'Family Platter', price: 5000, description: 'Family-size platter.', photo: 'platter-family.jpg' },
  { category: 'Platters', name: 'Tikka Platter', price: 1200, description: 'Tikka platter.', photo: 'platter-tikka.jpg' },

  // Halwa Puri
  { category: 'Halwa Puri', name: 'Halwa Puri (Single Puri)', price: 70, description: 'One puri with halwa and chana.' },
  { category: 'Halwa Puri', name: 'Halwa Puri Platter', price: 200, description: 'Halwa puri platter.', photo: 'halwa-puri-thali.jpg' },

  // Parathas
  { category: 'Parathas', name: 'Nutella Paratha', price: 500, description: 'Paratha with Nutella.', photo: 'nutella-paratha.jpg' },
  { category: 'Parathas', name: 'Chicken Cheese Paratha', price: 600, description: 'Chicken and cheese paratha.', featured: true },
  { category: 'Parathas', name: 'Chicken Tikka Paratha', price: 600, description: 'Chicken tikka paratha.', photo: 'chicken-tikka-paratha.jpg' },
  { category: 'Parathas', name: 'BBQ Paratha', price: 600, description: 'BBQ paratha.', photo: 'bbq-paratha.jpg' },
  { category: 'Parathas', name: 'Qeema Paratha', price: 600, description: 'Qeema paratha.', photo: 'qeema-paratha.jpg' },
  { category: 'Parathas', name: 'Cheese Paratha', price: 400, description: 'Cheese paratha.', photo: 'cheese-paratha.jpg' },
  { category: 'Parathas', name: 'Aloo Cheese Paratha', price: 300, description: 'Aloo and cheese paratha.', photo: 'aloo-cheese-paratha.jpg' },

  // Lassi & Flavored Milk
  { category: 'Lassi & Flavored Milk', name: 'Namkeen Lassi', price: 170, description: 'Salted lassi.', photo: 'namkeen-lassi.jpg' },
  { category: 'Lassi & Flavored Milk', name: 'Meethi Lassi', price: 180, description: 'Sweet lassi.', photo: 'meethi-lassi.jpg' },
  { category: 'Lassi & Flavored Milk', name: 'Mango Lassi', price: 300, description: 'Mango lassi.', featured: true, photo: 'mango-lassi.jpg' },
  { category: 'Lassi & Flavored Milk', name: 'Chocolate Lassi', price: 300, description: 'Chocolate lassi.', photo: 'chocolate-lassi.jpg' },
  { category: 'Lassi & Flavored Milk', name: 'Strawberry Lassi', price: 250, description: 'Strawberry lassi.' },
  { category: 'Lassi & Flavored Milk', name: 'Chocolate Milk', price: 300, description: 'Chocolate flavored milk.', photo: 'chocolate-milk.jpg' },
  { category: 'Lassi & Flavored Milk', name: 'Strawberry Milk', price: 300, description: 'Strawberry flavored milk.', photo: 'strawberry-milk.jpg' },
  { category: 'Lassi & Flavored Milk', name: 'Pista Milk', price: 320, description: 'Pista flavored milk.', photo: 'pista-milk.jpg' },
  { category: 'Lassi & Flavored Milk', name: 'Thanda Meetha Doodh', price: 250, description: 'Cold sweet milk.', featured: true, photo: 'thanda-meetha-doodh-can.jpg' },

  // Beverages
  { category: 'Beverages', name: 'Cold Drink 300 ml', price: 110, description: 'Chilled soft drink.' },
  { category: 'Beverages', name: 'Cold Drink 500 ml', price: 130, description: 'Chilled soft drink.' },
  { category: 'Beverages', name: 'Cold Drink 1 Litre', price: 170, description: 'Chilled soft drink.' },
  { category: 'Beverages', name: 'Cold Drink 1.5 Litre', price: 230, description: 'Chilled soft drink.' },

]

// Nothing is pending right now. Add items here only after the client confirms them.
export const PENDING_CONFIRMATION = []
