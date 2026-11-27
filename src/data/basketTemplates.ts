// Ready-made baskets. Each line is typed the way a shopper would write it, so the same matching used for pasted lists finds the products.
// The database table `basket_templates` (see the 20261127 migration) can replace or add to these without a new app version.
export interface BasketTemplate { id: string; name: string; blurb: string; items: string[] }

export const BASKET_TEMPLATES: BasketTemplate[] = [
  { id: "monthly-staples", name: "Monthly staples (family of 4)", blurb: "Flour, rice, sugar, oil and the basics", items: ["2 maize flour 2kg", "wheat flour 2kg", "rice pishori 2kg", "sugar 2kg", "cooking oil 2L", "salt", "beans 1kg", "tea leaves", "fresh milk", "eggs"] },
  { id: "student-essentials", name: "Student essentials", blurb: "Cheap food and soap for the hostel", items: ["rice long grain 1kg", "spaghetti", "bread brown", "eggs", "tea bags", "sugar 1kg", "cooking oil 500ml", "bar soap", "toothpaste", "toilet paper"] },
  { id: "breakfast-basics", name: "Breakfast basics", blurb: "Bread, milk, tea, eggs and spread", items: ["bread white", "fresh milk", "eggs", "tea leaves", "sugar 1kg", "margarine", "peanut butter", "oats"] },
  { id: "cooking-basics", name: "Cooking basics", blurb: "What every kitchen runs out of", items: ["cooking oil 1L", "tomato paste", "stock cubes", "curry powder", "salt", "onions", "tomatoes", "potatoes"] },
  { id: "veggie-run", name: "Veggie market run", blurb: "Weekly fresh vegetables", items: ["sukuma wiki", "spinach", "cabbage", "carrots", "tomatoes", "onions", "potatoes"] },
  { id: "fruit-basket", name: "Fruit basket", blurb: "Fruit for the week", items: ["bananas", "avocado", "oranges", "watermelon", "mangoes"] },
  { id: "nyama-choma", name: "Nyama choma party", blurb: "Meat, charcoal and drinks for a weekend", items: ["beef", "sausages", "charcoal", "matchbox", "tomatoes", "onions", "2 soda", "bottled water"] },
  { id: "cleaning-pack", name: "Cleaning pack", blurb: "Soap, bleach and paper", items: ["washing powder", "bar soap", "dish soap", "bleach", "toilet paper", "tissue paper"] },
  { id: "personal-care", name: "Personal care", blurb: "Daily toiletries", items: ["toothpaste", "shower gel", "body lotion", "deodorant", "shampoo", "petroleum jelly"] },
  { id: "baby-starter", name: "Baby starter", blurb: "Diapers, formula and wipes", items: ["diapers", "baby milk formula", "baby wipes", "petroleum jelly", "bar soap"] },
  { id: "back-to-school", name: "Back to school", blurb: "Books, pens and lunchbox snacks", items: ["5 exercise book", "pens", "pencils", "biscuits", "juice", "bread brown"] },
  { id: "tea-time", name: "Tea time", blurb: "Tea, milk, sugar and something sweet", items: ["tea leaves", "fresh milk", "sugar 1kg", "biscuits", "bread white"] },
  { id: "office-snacks", name: "Office snack run", blurb: "Coffee, crisps and drinks", items: ["instant coffee", "tea bags", "sugar 1kg", "crisps", "biscuits", "bottled water", "soda"] },
  { id: "protein-week", name: "Protein week", blurb: "Meat, fish and eggs", items: ["beef", "chicken whole", "tilapia", "eggs", "sausages", "beans 1kg"] },
];
