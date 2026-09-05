import type { RestaurantMenu } from '../types';

export const SAMPLE_RESTAURANTS: RestaurantMenu[] = [
  {
    id: 'harbor-grill',
    name: 'Harbor Grill',
    city: 'Seattle',
    cuisine: 'American seafood',
    dishes: [
      {
        name: 'Grilled Salmon',
        description: 'Atlantic salmon with lemon herb butter, rice pilaf, and steamed carrots',
      },
      {
        name: 'Garlic Butter Shrimp Pasta',
        description: 'Wheat linguine, shrimp, garlic butter sauce, parsley, parmesan',
      },
      {
        name: 'Classic Cheeseburger',
        description: 'Beef patty, cheddar, lettuce, tomato, onion, pickles, aioli, brioche bun, fries',
      },
      {
        name: 'French Onion Soup',
        description: 'Caramelized onions, beef broth, toasted baguette, melted swiss',
      },
      {
        name: 'Garden Salad',
        description: 'Mixed lettuce, cucumber, tomato, shredded carrot, balsamic vinaigrette',
      },
      {
        name: 'Fish & Chips',
        description: 'Beer-battered cod, fries, coleslaw, tartar sauce',
      },
      {
        name: 'Steak Frites',
        description: 'Grilled sirloin, herb butter, fries, side salad',
      },
    ],
  },
  {
    id: 'lotus-bowl',
    name: 'Lotus Bowl Co.',
    city: 'Portland',
    cuisine: 'Asian fusion bowls',
    dishes: [
      {
        name: 'Teriyaki Chicken Bowl',
        description: 'Chicken thigh, steamed rice, broccoli, carrot, sesame, teriyaki glaze',
      },
      {
        name: 'Spicy Tofu Stir Fry',
        description: 'Silken tofu, onion, garlic, mushrooms, cabbage, rice noodles',
      },
      {
        name: 'Sushi Combo',
        description: 'Salmon nigiri, tuna roll, cucumber roll, avocado roll, soy sauce, pickled ginger',
      },
      {
        name: 'Miso Soup',
        description: 'Miso, tofu, wakame, green onion',
      },
      {
        name: 'Edamame',
        description: 'Steamed soybeans with sea salt',
      },
      {
        name: 'Ginger Rice & Grilled Shrimp',
        description: 'Shrimp with ginger-scallion oil, jasmine rice, cucumber salad',
      },
    ],
  },
  {
    id: 'mesa-fresca',
    name: 'Mesa Fresca',
    city: 'Austin',
    cuisine: 'Mexican',
    dishes: [
      {
        name: 'Carne Asada Tacos',
        description: 'Grilled steak, corn tortillas, onion, cilantro, salsa roja',
      },
      {
        name: 'Chicken Fajitas',
        description: 'Sizzling chicken, bell peppers, onion, flour tortillas, guacamole, sour cream',
      },
      {
        name: 'Black Bean Burrito',
        description: 'Black beans, rice, cheese, pico de gallo, flour tortilla',
      },
      {
        name: 'Chips & Guacamole',
        description: 'Corn chips, avocado, lime, tomato, onion, jalapeño',
      },
      {
        name: 'Grilled Fish Tacos',
        description: 'White fish, corn tortillas, cabbage slaw, lime crema',
      },
      {
        name: 'Mexican Street Corn',
        description: 'Corn on the cob, mayo, cotija, chili powder, lime',
      },
    ],
  },
  {
    id: 'nonna-table',
    name: 'Nonna’s Table',
    city: 'Chicago',
    cuisine: 'Italian',
    dishes: [
      {
        name: 'Margherita Pizza',
        description: 'Wheat crust, tomato sauce, mozzarella, basil, garlic oil',
      },
      {
        name: 'Spaghetti Bolognese',
        description: 'Wheat spaghetti, beef ragu with onion, carrot, celery, garlic, tomato',
      },
      {
        name: 'Grilled Chicken Caprese',
        description: 'Chicken breast, tomato, mozzarella, basil, balsamic, side of roasted potatoes',
      },
      {
        name: 'Caesar Salad',
        description: 'Romaine, parmesan, croutons, caesar dressing (anchovy, garlic)',
      },
      {
        name: 'Risotto ai Funghi',
        description: 'Arborio rice, mushrooms, onion, parmesan, butter',
      },
      {
        name: 'Tiramisu',
        description: 'Mascarpone, espresso-soaked ladyfingers, cocoa',
      },
    ],
  },
];
