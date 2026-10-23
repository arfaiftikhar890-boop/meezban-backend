// Mezbaan menu, taken from the client's rate list (WhatsApp, 21 Oct 2026).
// Only items in that list are loaded. Items that are not in the list are kept in PENDING_CONFIRMATION
// below and are NOT loaded until the client confirms them.
export const SAMPLE_MENU = [
  // Pulao (per kg / half / quarter)
  { category: 'Pulao', name: 'Beef Yakhni Pulao (1 KG)', price: 1200, description: 'Beef yakhni pulao, 1 kg.', featured: true, photo: 'beef-yakhni-pulao.jpg' },
  { category: 'Pulao', name: 'Beef Yakhni Pulao (1/2 KG)', price: 600, description: 'Beef yakhni pulao, half kg.', photo: 'beef-yakhni-pulao.jpg' },
  { category: 'Pulao', name: 'Beef Yakhni Pulao (1/4 KG)', price: 300, description: 'Beef yakhni pulao, quarter kg.', photo: 'beef-yakhni-pulao.jpg' },
  { category: 'Pulao', name: 'Mutton Yakhni Pulao (1 KG)', price: 1800, description: 'Mutton yakhni pulao, 1 kg.', featured: true },
  { category: 'Pulao', name: 'Mutton Yakhni Pulao (1/2 KG)', price: 900, description: 'Mutton yakhni pulao, half kg.' },
  { category: 'Pulao', name: 'Mutton Yakhni Pulao (1/4 KG)', price: 450, description: 'Mutton yakhni pulao, quarter kg.' },
  { category: 'Pulao', name: 'White Chicken Pulao (1 KG)', price: 1000, description: 'White chicken pulao, 1 kg.', photo: 'white-chicken-pulao.jpg' },
  { category: 'Pulao', name: 'White Chicken Pulao (1/2 KG)', price: 500, description: 'White chicken pulao, half kg.', photo: 'white-chicken-pulao.jpg' },
  { category: 'Pulao', name: 'White Chicken Pulao (1/4 KG)', price: 250, description: 'White chicken pulao, quarter kg.', photo: 'white-chicken-pulao.jpg' },
  { category: 'Pulao', name: 'Chana Pulao (1 KG)', price: 520, description: 'Chana pulao, 1 kg.', photo: 'chana-pulao.jpg' },
  { category: 'Pulao', name: 'Chana Pulao (1/2 KG)', price: 260, description: 'Chana pulao, half kg.', photo: 'chana-pulao.jpg' },
  { category: 'Pulao', name: 'Chana Pulao (1/4 KG)', price: 130, description: 'Chana pulao, quarter kg.', photo: 'chana-pulao.jpg' },

  // Halwa Puri
  { category: 'Halwa Puri', name: 'Halwa Puri (Single Puri)', price: 60, description: 'One puri with halwa and chana.' },
  { category: 'Halwa Puri', name: 'Halwa Puri Thali', price: 150, description: 'Halwa puri thali.', featured: true, photo: 'halwa-puri-thali.jpg' },
  { category: 'Halwa Puri', name: 'Halwa (1 Pao)', price: 250, description: 'Halwa, 1 pao.' },

  // Parathas
  { category: 'Parathas', name: 'Nutella Paratha', price: 500, description: 'Paratha with Nutella.', photo: 'nutella-paratha.jpg' },
  { category: 'Parathas', name: 'Chicken Cheese Paratha', price: 600, description: 'Chicken and cheese paratha.', featured: true },
  { category: 'Parathas', name: 'Chicken Tikka Paratha', price: 600, description: 'Chicken tikka paratha.', photo: 'chicken-tikka-paratha.jpg' },
  { category: 'Parathas', name: 'BBQ Paratha', price: 600, description: 'BBQ paratha.', photo: 'bbq-paratha.jpg' },
  { category: 'Parathas', name: 'Qeema Paratha', price: 600, description: 'Qeema paratha.', photo: 'qeema-paratha.jpg' },
  { category: 'Parathas', name: 'Cheese Paratha', price: 400, description: 'Cheese paratha.', photo: 'cheese-paratha.jpg' },
  { category: 'Parathas', name: 'Aloo Paratha', price: 300, description: 'Aloo paratha.', photo: 'aloo-paratha.jpg' },

  // Lassi & Flavored Milk
  { category: 'Lassi & Flavored Milk', name: 'Namkeen Lassi', price: 150, description: 'Salted lassi.', photo: 'namkeen-lassi.jpg' },
  { category: 'Lassi & Flavored Milk', name: 'Meethi Lassi', price: 180, description: 'Sweet lassi.', photo: 'meethi-lassi.jpg' },
  { category: 'Lassi & Flavored Milk', name: 'Mango Lassi', price: 250, description: 'Mango lassi.', featured: true, photo: 'mango-lassi.jpg' },
  { category: 'Lassi & Flavored Milk', name: 'Chocolate Lassi', price: 250, description: 'Chocolate lassi.', photo: 'chocolate-lassi.jpg' },
  { category: 'Lassi & Flavored Milk', name: 'Strawberry Lassi', price: 250, description: 'Strawberry lassi.' },
  { category: 'Lassi & Flavored Milk', name: 'Chocolate Milk Can', price: 250, description: 'Chocolate flavored milk in a can.', photo: 'chocolate-milk.jpg' },
  { category: 'Lassi & Flavored Milk', name: 'Strawberry Milk Can', price: 250, description: 'Strawberry flavored milk in a can.', photo: 'strawberry-milk.jpg' },
  { category: 'Lassi & Flavored Milk', name: 'Pista Milk Can', price: 280, description: 'Pista flavored milk in a can.', photo: 'pista-milk.jpg' },
  { category: 'Lassi & Flavored Milk', name: 'Thanda Meetha Doodh', price: 200, description: 'Cold sweet milk.', featured: true, photo: 'thanda-meetha-doodh-can.jpg' },

  // Beverages
  { category: 'Beverages', name: 'Cold Drink 300 ml', price: 100, description: '' },
  { category: 'Beverages', name: 'Cold Drink 500 ml', price: 120, description: '' },
  { category: 'Beverages', name: 'Cold Drink 1 Litre', price: 200, description: '' },
  { category: 'Beverages', name: 'Manzil Water', price: 0, description: 'As needed.' },
]

// NOT loaded. These came from the older PDF menu or earlier drafts and are not in the client's
// current rate list. Move an item into SAMPLE_MENU only after the client confirms it and its rate.
export const PENDING_CONFIRMATION = [
  // Biryani pot and platters (old PDF)
  { category: 'Biryani Pot', name: 'Beef Yakhni Pulao (1 KG Pot)', price: 3200, description: 'Full pot, 1 kg.', photo: 'beef-yakhni-pot.jpg' },
  { category: 'Biryani Pot', name: 'Beef Biryani (1 KG Pot)', price: 3000, description: 'Full pot, 1 kg.', photo: 'beef-biryani-pot.jpg' },
  { category: 'Biryani Pot', name: 'Chicken White Biryani (1 KG Pot)', price: 2700, description: 'Full pot, 1 kg.', photo: 'chicken-white-biryani-pot.jpg' },
  { category: 'Biryani Pot', name: 'Chicken Biryani (1 KG Pot)', price: 2500, description: 'Full pot, 1 kg.', photo: 'chicken-biryani-pot.jpg' },
  { category: 'Platters', name: '2 Person Platter', price: 1799, description: 'Platter for two.', photo: 'platter-2-person.jpg' },
  { category: 'Platters', name: '4 Person Platter', price: 3199, description: 'Platter for four.', photo: 'platter-4-person.jpg' },
  { category: 'Platters', name: 'Family Platter', price: 5000, description: 'Family-size platter.', photo: 'platter-family.jpg' },
  { category: 'Platters', name: 'Tikka Platter', price: 1200, description: 'Tikka platter.', photo: 'platter-tikka.jpg' },
  // Not in the rate list
  { category: 'Halwa Puri', name: 'Halwa Puri Platter', price: 200, description: 'Halwa puri platter.', photo: 'halwa-puri-thali.jpg' },
  { category: 'Parathas', name: 'Aloo Cheese Paratha', price: 300, description: 'Aloo and cheese paratha.', photo: 'aloo-cheese-paratha.jpg' },
  { category: 'Beverages', name: 'Cold Drink 1.5 Litre', price: 260, description: 'Chilled soft drink, family bottle.' },
  { category: 'Beverages', name: 'Mineral Water 500 ml', price: 80, description: 'Chilled mineral water.' },
  { category: 'Beverages', name: 'Mineral Water 1.5 Litre', price: 140, description: 'Chilled mineral water, large bottle.' },
  { category: 'Beverages', name: 'Fresh Lime Soda', price: 200, description: 'Fresh lime with soda, sweet or salted.' },
  { category: 'Beverages', name: 'Rooh Afza Sharbat', price: 150, description: 'Classic rose sharbat served over ice.' },
  { category: 'Beverages', name: 'Doodh Soda', price: 180, description: 'Chilled milk and soda with rose syrup.' },
  { category: 'Beverages', name: 'Jaljeera', price: 120, description: 'Tangy cumin and mint cooler.' },
  { category: 'Beverages', name: 'Fresh Orange Juice', price: 300, description: 'Freshly squeezed orange juice.' },
  { category: 'Beverages', name: 'Energy Drink', price: 250, description: 'Chilled energy drink can.' },
]
