/**
 * Mock Data for Intent-to-Commerce AI Agent
 * All currency in Indian Rupees (₹).
 * Local dataset simulating Google Gemini AI reasoning & Base Sepolia on-chain verification.
 */

export interface ProductItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unitPrice: number; // in INR (₹)
  totalPrice: number; // in INR (₹)
  rationale: string;
  inStock: boolean;
  imagePlaceholder: string; // SVG icon or abstract color
  badge?: string;
}

export interface ShoppingPlanData {
  id: string;
  title: string;
  situation: string;
  budget: number; // in INR (₹)
  totalAmount: number; // in INR (₹)
  remainingAmount: number; // in INR (₹)
  version: number;
  timestamp: string;
  planHash: string;
  txHash?: string;
  blockNumber?: number;
  items: ProductItem[];
  outOfStockNotice?: {
    itemName: string;
    message: string;
  };
  validation: {
    budgetCompliant: boolean;
    catalogGrounded: boolean;
    integerPaiseExact: boolean;
    allInStock: boolean;
  };
}

export interface PresetSituation {
  id: string;
  label: string;
  chipLabel: string;
  prompt: string;
  defaultBudget: number; // in INR (₹)
  location?: string;
  category: "college" | "travel" | "home" | "festival";
}

export const PRESET_SITUATIONS: PresetSituation[] = [
  {
    id: "college-fest",
    label: "3-Day College Event in Kolkata",
    chipLabel: "College Event",
    prompt:
      "I am attending a 3-day annual cultural college fest in Kolkata. My budget is ₹3,000. I need durable hydration, weather protection for Kolkata humidity, stationery for event registrations, and an emergency mobile battery pack.",
    defaultBudget: 3000,
    location: "Kolkata, WB",
    category: "college",
  },
  {
    id: "trekking-trip",
    label: "Monsoon Trek in Western Ghats",
    chipLabel: "Trekking Trip",
    prompt:
      "Planning a weekend monsoon trek to Rajmachi with college friends. Budget is ₹4,500. Need water-resistant gear, trail snacks, hydration, electrolyte packs, and a sturdy rain poncho.",
    defaultBudget: 4500,
    location: "Western Ghats, MH",
    category: "travel",
  },
  {
    id: "hostel-setup",
    label: "First-Year Hostel Room Setup",
    chipLabel: "Hostel Setup",
    prompt:
      "Moving into university campus hostel. Budget is ₹6,000. Need bedside organizer, warm blanket, multi-plug spike buster, laundry mesh bag, and study desk lamp.",
    defaultBudget: 6000,
    location: "Campus Dormitory",
    category: "home",
  },
  {
    id: "diwali-gifting",
    label: "Diwali Family & Neighbor Gifting",
    chipLabel: "Diwali Gifting",
    prompt:
      "Buying artisanal festive gifts for 4 families within ₹5,000. Prefer brass oil diyas, organic dry fruit assortments, scented soy wax candles, and handmade greeting cards.",
    defaultBudget: 5000,
    location: "Bengaluru, KA",
    category: "festival",
  },
  {
    id: "freshers-week",
    label: "Freshers' Orientation Week",
    chipLabel: "Freshers' Week",
    prompt:
      "Need essential college supplies for orientation week under ₹2,000. Lanyard ID holder, hardbound notebook, ballpoint multipack, and campus-ready insulated mug.",
    defaultBudget: 2000,
    location: "Delhi NCR",
    category: "college",
  },
];

export const MOCK_PLANS: Record<string, ShoppingPlanData> = {
  "college-fest": {
    id: "intent_kolkata_fest_01",
    title: "Kolkata Campus Fest Essentials",
    situation:
      "3-day college event in Kolkata. Budget ₹3,000. Focused on Kolkata humidity, electronics backup, and fast registrations.",
    budget: 3000,
    totalAmount: 2890,
    remainingAmount: 110,
    version: 1,
    timestamp: "10 Oct 2026, 02:45 PM IST",
    planHash: "0x7a3f81e4b9c02d76f1839a5c8e2b4f91048a6d7c3e5a1b9f8d2c4e6a0b1c3e5d",
    txHash: "0x8e2c4a91b3d5f70a1c6e8b2d4f9013a5c7e9b1d3f5a702c4e6a8b0d2f4a6c8e0",
    blockNumber: 18421904,
    validation: {
      budgetCompliant: true,
      catalogGrounded: true,
      integerPaiseExact: true,
      allInStock: true,
    },
    items: [
      {
        id: "prod-bottle-01",
        name: "Double-Wall Insulated Steel Flask (750ml)",
        category: "Hydration",
        quantity: 1,
        unitPrice: 599,
        totalPrice: 599,
        rationale: "Keeps water ice-cold for 18 hours in humid Kolkata outdoor heat during day events.",
        inStock: true,
        imagePlaceholder: "linear-gradient(135deg, #F9D5CB 0%, #F4A28C 100%)",
        badge: "Essential",
      },
      {
        id: "prod-powerbank-02",
        name: "10,000 mAh Compact Fast-Charging Power Bank",
        category: "Electronics",
        quantity: 1,
        unitPrice: 999,
        totalPrice: 999,
        rationale: "Ensures smartphone and camera battery last through long evening concerts without wall outlets.",
        inStock: true,
        imagePlaceholder: "linear-gradient(135deg, #E9D8FF 0%, #C4B5FD 100%)",
        badge: "Top Pick",
      },
      {
        id: "prod-umbrella-03",
        name: "Windproof Compact 3-Fold UV Umbrella",
        category: "Weather Protection",
        quantity: 1,
        unitPrice: 449,
        totalPrice: 449,
        rationale: "Protects against sudden tropical Kolkata showers and harsh afternoon sun between venues.",
        inStock: true,
        imagePlaceholder: "linear-gradient(135deg, #FDE68A 0%, #F59E0B 100%)",
      },
      {
        id: "prod-notebook-04",
        name: "A5 Dot-Grid Hardbound Spiral Notebook (200 pgs)",
        category: "Stationery",
        quantity: 2,
        unitPrice: 199,
        totalPrice: 398,
        rationale: "Sturdy paper for event schedules, workshop notes, and contact exchange.",
        inStock: true,
        imagePlaceholder: "linear-gradient(135deg, #E2E8F0 0%, #CBD5E1 100%)",
      },
      {
        id: "prod-pen-05",
        name: "Quick-Dry Waterproof Gel Pen Set (Pack of 5)",
        category: "Stationery",
        quantity: 1,
        unitPrice: 195,
        totalPrice: 195,
        rationale: "Smudge-free writing on identity passes and registration forms.",
        inStock: true,
        imagePlaceholder: "linear-gradient(135deg, #BFDBFE 0%, #93C5FD 100%)",
      },
      {
        id: "prod-towel-06",
        name: "Quick-Dry Antimicrobial Microfiber Face Towel",
        category: "Personal Care",
        quantity: 2,
        unitPrice: 125,
        totalPrice: 250,
        rationale: "Ultra-compact sweat absorption for all-day outdoor stages.",
        inStock: true,
        imagePlaceholder: "linear-gradient(135deg, #FED7AA 0%, #FB923C 100%)",
      },
    ],
  },

  "trekking-trip": {
    id: "intent_trekking_rajmachi_02",
    title: "Western Ghats Trail Essentials",
    situation: "Monsoon trek to Rajmachi with college friends. Budget ₹4,500.",
    budget: 4500,
    totalAmount: 4280,
    remainingAmount: 220,
    version: 1,
    timestamp: "10 Oct 2026, 11:20 AM IST",
    planHash: "0x4b9c02d76f1839a5c8e2b4f91048a6d7c3e5a1b9f8d2c4e6a0b1c3e5d7a3f81e",
    txHash: "0x91b3d5f70a1c6e8b2d4f9013a5c7e9b1d3f5a702c4e6a8b0d2f4a6c8e08e2c4a",
    blockNumber: 18421880,
    validation: {
      budgetCompliant: true,
      catalogGrounded: true,
      integerPaiseExact: true,
      allInStock: true,
    },
    items: [
      {
        id: "prod-poncho-01",
        name: "Heavy-Duty Ripstop Rain Poncho with Hood",
        category: "Outdoor",
        quantity: 1,
        unitPrice: 899,
        totalPrice: 899,
        rationale: "Full coverage for hiker and 30L backpack in continuous heavy monsoon downpours.",
        inStock: true,
        imagePlaceholder: "linear-gradient(135deg, #A7F3D0 0%, #34D399 100%)",
        badge: "Crucial",
      },
      {
        id: "prod-drybag-02",
        name: "10L IPX6 Waterproof Dry Sack for Electronics",
        category: "Protection",
        quantity: 1,
        unitPrice: 549,
        totalPrice: 549,
        rationale: "Keeps wallet, phone, and power bank completely dry during river crossings.",
        inStock: true,
        imagePlaceholder: "linear-gradient(135deg, #BAE6FD 0%, #38BDF8 100%)",
      },
      {
        id: "prod-headlamp-03",
        name: "USB-Rechargeable 300lm Waterproof Headlamp",
        category: "Lighting",
        quantity: 1,
        unitPrice: 799,
        totalPrice: 799,
        rationale: "Hands-free trail lighting for foggy descents and dawn summit climbs.",
        inStock: true,
        imagePlaceholder: "linear-gradient(135deg, #FEF08A 0%, #EAB308 100%)",
      },
      {
        id: "prod-electrolytes-04",
        name: "Instant ORS Electrolyte Hydration Sachets (Box of 20)",
        category: "Nutrition",
        quantity: 1,
        unitPrice: 350,
        totalPrice: 350,
        rationale: "Prevents muscle cramps and dehydration over 14km steep climbs.",
        inStock: true,
        imagePlaceholder: "linear-gradient(135deg, #FED7AA 0%, #F97316 100%)",
      },
      {
        id: "prod-firstaid-05",
        name: "Compact Trail First-Aid Kit with Blister Bandages",
        category: "Safety",
        quantity: 1,
        unitPrice: 699,
        totalPrice: 699,
        rationale: "Antiseptic wipes, crepe bandage, leech repellent, and sterile dressings.",
        inStock: true,
        imagePlaceholder: "linear-gradient(135deg, #FECDD3 0%, #F43F5E 100%)",
        badge: "Safety",
      },
      {
        id: "prod-energybars-06",
        name: "Whole Nut & Oat Trail Energy Bars (Pack of 6)",
        category: "Nutrition",
        quantity: 2,
        unitPrice: 492,
        totalPrice: 984,
        rationale: "High-protein quick energy boosts during steep ridge ascents.",
        inStock: true,
        imagePlaceholder: "linear-gradient(135deg, #E9D5FF 0%, #A855F7 100%)",
      },
    ],
  },

  "hostel-setup": {
    id: "intent_hostel_setup_03",
    title: "First-Year Hostel Room Setup",
    situation: "Moving into university campus hostel. Budget ₹6,000. Bedside organizer, warm blanket, multi-plug spike buster, laundry mesh bag, and study desk lamp.",
    budget: 6000,
    totalAmount: 5640,
    remainingAmount: 360,
    version: 1,
    timestamp: "10 Oct 2026, 03:15 PM IST",
    planHash: "0x1f82b7c4a9d03e5186b4f720a3c9e1d84b2a0c6e8f4d2a9b1c7e3f5a0d2b4c6e",
    txHash: "0x3c9e1d84b2a0c6e8f4d2a9b1c7e3f5a0d2b4c6e1f82b7c4a9d03e5186b4f720a",
    blockNumber: 18421892,
    validation: {
      budgetCompliant: true,
      catalogGrounded: true,
      integerPaiseExact: true,
      allInStock: true,
    },
    items: [
      {
        id: "prod-desklamp-01",
        name: "Desk Study LED Lamp with Flexible Clamp",
        category: "Lighting",
        quantity: 1,
        unitPrice: 1199,
        totalPrice: 1199,
        rationale: "Glare-free LED task lighting for late night study sessions without disturbing roommate.",
        inStock: true,
        imagePlaceholder: "linear-gradient(135deg, #FEF08A 0%, #EAB308 100%)",
        badge: "Essential",
      },
      {
        id: "prod-spikebuster-02",
        name: "Heavy-Duty 4-Socket Spike Buster with Surge Guard",
        category: "Electronics",
        quantity: 1,
        unitPrice: 849,
        totalPrice: 849,
        rationale: "Protects laptop, smartphone, and study lamp from hostel dormitory power fluctuations.",
        inStock: true,
        imagePlaceholder: "linear-gradient(135deg, #E2E8F0 0%, #94A3B8 100%)",
        badge: "Essential",
      },
      {
        id: "prod-blanket-03",
        name: "Thermal Microfiber Lightweight Warm Dorm Blanket",
        category: "Bedding",
        quantity: 1,
        unitPrice: 1799,
        totalPrice: 1799,
        rationale: "Hypoallergenic breathable warmth for chilly hostel autumn and winter nights.",
        inStock: true,
        imagePlaceholder: "linear-gradient(135deg, #E9D5FF 0%, #C084FC 100%)",
      },
      {
        id: "prod-caddy-04",
        name: "4-Pocket Heavy Canvas Bedside Hanging Caddy",
        category: "Storage",
        quantity: 1,
        unitPrice: 599,
        totalPrice: 599,
        rationale: "Keeps glasses, phone, earphones, and novels within arm's reach of bunk beds.",
        inStock: true,
        imagePlaceholder: "linear-gradient(135deg, #FED7AA 0%, #FB923C 100%)",
      },
      {
        id: "prod-laundry-05",
        name: "Breathable Mesh Collapsible Laundry Hamper Bag",
        category: "Organization",
        quantity: 1,
        unitPrice: 395,
        totalPrice: 395,
        rationale: "Prevents mildew and makes weekly campus laundry runs organized and portable.",
        inStock: true,
        imagePlaceholder: "linear-gradient(135deg, #BAE6FD 0%, #38BDF8 100%)",
      },
      {
        id: "prod-notebook-06",
        name: "5-Subject Ruled Spiral Notebook Pack (Pack of 2)",
        category: "Stationery",
        quantity: 1,
        unitPrice: 499,
        totalPrice: 499,
        rationale: "Lecture note-taking for multiple curriculum subjects in one organized volume.",
        inStock: true,
        imagePlaceholder: "linear-gradient(135deg, #A7F3D0 0%, #34D399 100%)",
      },
      {
        id: "prod-sanitizer-07",
        name: "Pocket Hand Sanitizer Spray (Pack of 3)",
        category: "Hygiene",
        quantity: 1,
        unitPrice: 300,
        totalPrice: 300,
        rationale: "Disinfects desks and dining tables in shared university facilities.",
        inStock: true,
        imagePlaceholder: "linear-gradient(135deg, #FECDD3 0%, #F43F5E 100%)",
      },
    ],
  },

  "diwali-gifting": {
    id: "intent_diwali_gifting_04",
    title: "Artisanal Festive Family Hampers",
    situation: "Buying artisanal festive gifts for 4 families within ₹5,000. Brass oil diyas, organic dry fruit assortments, scented soy wax candles, and handmade greeting cards.",
    budget: 5000,
    totalAmount: 4760,
    remainingAmount: 240,
    version: 1,
    timestamp: "10 Oct 2026, 04:30 PM IST",
    planHash: "0x3c9e1d84b2a0c6e8f4d2a9b1c7e3f5a0d2b4c6e1f82b7c4a9d03e5186b4f720a",
    txHash: "0x1f82b7c4a9d03e5186b4f720a3c9e1d84b2a0c6e8f4d2a9b1c7e3f5a0d2b4c6e",
    blockNumber: 18421915,
    validation: {
      budgetCompliant: true,
      catalogGrounded: true,
      integerPaiseExact: true,
      allInStock: true,
    },
    items: [
      {
        id: "prod-brassdiya-01",
        name: "Handcrafted Brass Peacock Oil Diyas (Set of 4)",
        category: "Festive Decor",
        quantity: 1,
        unitPrice: 1440,
        totalPrice: 1440,
        rationale: "Authentic heavy-gauge brass oil lamps for traditional family festive puja and gifting.",
        inStock: true,
        imagePlaceholder: "linear-gradient(135deg, #FDE68A 0%, #F59E0B 100%)",
        badge: "Artisanal",
      },
      {
        id: "prod-dryfruits-02",
        name: "Premium California Almonds & Cashews Box (500g)",
        category: "Gourmet",
        quantity: 1,
        unitPrice: 1560,
        totalPrice: 1560,
        rationale: "Vacuum-sealed golden nuts in an embossed festive keepsake gift box.",
        inStock: true,
        imagePlaceholder: "linear-gradient(135deg, #FED7AA 0%, #EA580C 100%)",
        badge: "Gourmet",
      },
      {
        id: "prod-candles-03",
        name: "Aromatherapy Scented Soy Wax Candles (Pack of 4)",
        category: "Home Fragrance",
        quantity: 1,
        unitPrice: 1160,
        totalPrice: 1160,
        rationale: "Smokeless organic mogra & sandalwood candles for festive evening ambient illumination.",
        inStock: true,
        imagePlaceholder: "linear-gradient(135deg, #FECDD3 0%, #E11D48 100%)",
      },
      {
        id: "prod-cards-04",
        name: "Block-Printed Handmade Paper Greeting Cards (Pack of 8)",
        category: "Stationery",
        quantity: 1,
        unitPrice: 360,
        totalPrice: 360,
        rationale: "Recycled cotton paper with gold foil accents for handwritten family blessings.",
        inStock: true,
        imagePlaceholder: "linear-gradient(135deg, #E9D5FF 0%, #9333EA 100%)",
      },
      {
        id: "prod-burner-05",
        name: "Etched Brass Dhoop Incense Cone Burner",
        category: "Puja Accessories",
        quantity: 1,
        unitPrice: 240,
        totalPrice: 240,
        rationale: "Lidded brass holder preventing ash dispersion during festive prayers.",
        inStock: true,
        imagePlaceholder: "linear-gradient(135deg, #FEF08A 0%, #CA8A04 100%)",
      },
    ],
  },

  "freshers-week": {
    id: "intent_freshers_week_05",
    title: "Freshers' Orientation Essentials",
    situation: "Need essential college supplies for orientation week under ₹2,000. Lanyard ID holder, hardbound notebook, ballpoint multipack, and campus-ready insulated mug.",
    budget: 2000,
    totalAmount: 1788,
    remainingAmount: 212,
    version: 1,
    timestamp: "10 Oct 2026, 05:00 PM IST",
    planHash: "0x5a0d2b4c6e1f82b7c4a9d03e5186b4f720a3c9e1d84b2a0c6e8f4d2a9b1c7e3f",
    txHash: "0x7a3f81e4b9c02d76f1839a5c8e2b4f91048a6d7c3e5a1b9f8d2c4e6a0b1c3e5d",
    blockNumber: 18421922,
    validation: {
      budgetCompliant: true,
      catalogGrounded: true,
      integerPaiseExact: true,
      allInStock: true,
    },
    items: [
      {
        id: "prod-mug-01",
        name: "Stainless Steel Insulated Campus Travel Mug (450ml)",
        category: "Hydration",
        quantity: 1,
        unitPrice: 599,
        totalPrice: 599,
        rationale: "Leak-proof thermal tumbler keeping coffee hot through morning 8 AM orientation lectures.",
        inStock: true,
        imagePlaceholder: "linear-gradient(135deg, #F9D5CB 0%, #F4A28C 100%)",
        badge: "Essential",
      },
      {
        id: "prod-lanyard-02",
        name: "Durable Campus ID Card Badge & Quick-Release Lanyard",
        category: "Access",
        quantity: 1,
        unitPrice: 160,
        totalPrice: 160,
        rationale: "Transparent waterproof holder for campus library cards and hostel entry passes.",
        inStock: true,
        imagePlaceholder: "linear-gradient(135deg, #BAE6FD 0%, #0284C7 100%)",
      },
      {
        id: "prod-journal-03",
        name: "A5 Hardbound Ruled Orientation Journal (160 pgs)",
        category: "Stationery",
        quantity: 1,
        unitPrice: 399,
        totalPrice: 399,
        rationale: "Compact pocket planner for departmental schedules and senior faculty contact details.",
        inStock: true,
        imagePlaceholder: "linear-gradient(135deg, #E2E8F0 0%, #64748B 100%)",
      },
      {
        id: "prod-pens-04",
        name: "Smooth Flow Ballpoint Pen Set (Pack of 10)",
        category: "Stationery",
        quantity: 1,
        unitPrice: 240,
        totalPrice: 240,
        rationale: "Smudge-resistant ink for registration paperwork and identity validation forms.",
        inStock: true,
        imagePlaceholder: "linear-gradient(135deg, #BFDBFE 0%, #2563EB 100%)",
      },
      {
        id: "prod-highlighter-05",
        name: "Pastel Chisel Highlighters (Pack of 5)",
        category: "Stationery",
        quantity: 1,
        unitPrice: 190,
        totalPrice: 190,
        rationale: "Non-bleeding pastel highlighters to mark key orientation venue locations and exam dates.",
        inStock: true,
        imagePlaceholder: "linear-gradient(135deg, #FEF08A 0%, #CA8A04 100%)",
      },
      {
        id: "prod-firstaid-06",
        name: "Compact 20-Piece Travel First Aid Kit",
        category: "Supplies",
        quantity: 1,
        unitPrice: 200,
        totalPrice: 200,
        rationale: "Emergency bandages and antiseptic wipes for daily campus commute.",
        inStock: true,
        imagePlaceholder: "linear-gradient(135deg, #FECDD3 0%, #E11D48 100%)",
      },
    ],
  },
};

export interface PlanVersionRecord {
  version: number;
  timestamp: string;
  situation: string;
  budget: number;
  total: number;
  itemCount: number;
  planHash: string;
  txHash: string;
  blockNumber: number;
  gasFee: string;
  notes: string;
}

export const MOCK_VERSION_HISTORY: PlanVersionRecord[] = [
  {
    version: 3,
    timestamp: "10 Oct 2026, 02:45 PM IST",
    situation: "3-day college fest in Kolkata (Tightened budget, removed redundant power bank, upgraded flask)",
    budget: 3000,
    total: 2890,
    itemCount: 6,
    planHash: "0x7a3f81e4b9c02d76f1839a5c8e2b4f91048a6d7c3e5a1b9f8d2c4e6a0b1c3e5d",
    txHash: "0x8e2c4a91b3d5f70a1c6e8b2d4f9013a5c7e9b1d3f5a702c4e6a8b0d2f4a6c8e0",
    blockNumber: 18421904,
    gasFee: "0.000042 ETH (₹11.20)",
    notes: "Latest active commitment. Verified on Base Sepolia testnet.",
  },
  {
    version: 2,
    timestamp: "10 Oct 2026, 01:15 PM IST",
    situation: "3-day college fest in Kolkata (Initial bundle with premium electronic noise-cancelling earphones)",
    budget: 3500,
    total: 3420,
    itemCount: 7,
    planHash: "0x3e18a9fc77c10d3e5b882190aa6e541b9c287612f00a469d82f7198bb6c301ae",
    txHash: "0x5a702c4e6a8b0d2f4a6c8e08e2c4a91b3d5f70a1c6e8b2d4f9013a5c7e9b1d3f",
    blockNumber: 18421710,
    gasFee: "0.000039 ETH (₹10.40)",
    notes: "Previous revision superseded by user budget cap adjustment.",
  },
  {
    version: 1,
    timestamp: "09 Oct 2026, 07:30 PM IST",
    situation: "3-day college fest in Kolkata (Draft exploratory bundle with 12 items)",
    budget: 4000,
    total: 3950,
    itemCount: 8,
    planHash: "0x9b4f2c91823ab67d8120e53a19fc820a4b10de67a329ef001c9a05bc18432a10",
    txHash: "0x1c6e8b2d4f9013a5c7e9b1d3f5a702c4e6a8b0d2f4a6c8e08e2c4a91b3d5f70a",
    blockNumber: 18421155,
    gasFee: "0.000041 ETH (₹10.95)",
    notes: "Genesis version committed on Base Sepolia.",
  },
];

export const MEGA_MENU_DATA = {
  columns: [
    {
      title: "Reasoning Engine",
      items: [
        { label: "Natural Language Parser", desc: "Extracts dates, climate, events & integer budgets", href: "#how-it-works" },
        { label: "Knapsack Budget Solver", desc: "Integer paise math ensures zero budget overshoots", href: "#planner" },
        { label: "Catalog Grounding", desc: "Real inventory SKUs only, zero AI price hallucinations", href: "#planner" },
      ],
    },
    {
      title: "Integrity & Blockchain",
      items: [
        { label: "Deterministic Hashing", desc: "Sorted UTF-8 canonical Keccak-256 plan hashes", href: "#verification" },
        { label: "Base Sepolia Registry", desc: "Tamper-evident smart contract versioning", href: "#verification" },
        { label: "Client-Side Wallet Signing", desc: "User explicitly approves transactions in MetaMask", href: "#verification" },
      ],
    },
    {
      title: "Popular Occasions",
      items: [
        { label: "College & Academic Fests", desc: "Hydration, power banks & campus stationery", href: "#use-cases" },
        { label: "Monsoon & Himalayan Treks", desc: "Weatherproof gear, trail first-aid & nutrition", href: "#use-cases" },
        { label: "Hostel & Room Setup", desc: "Bedding, study lighting & space organizers", href: "#use-cases" },
      ],
    },
    {
      title: "Developer Stubs",
      items: [
        { label: "Google Gemini 2.5 API", desc: "Plug-and-play generatePlan() prompt harness", href: "#faq" },
        { label: "MetaMask Base Sepolia", desc: "Direct recordPlanOnChain() Viem contract caller", href: "#faq" },
        { label: "Contract ABI & Addresses", desc: "Deployed on Base Sepolia (Chain ID 84532)", href: "#verification" },
      ],
    },
  ],
  featured: [
    {
      tag: "Live Case Study",
      title: "Sample Plan: College Fest in Kolkata",
      desc: "How 7 items were curated under a strict ₹3,000 budget cap and committed as hash 0x7a3f...c91e.",
      href: "#planner",
    },
    {
      tag: "Cryptographic Transparency",
      title: "How On-Chain Verification Works",
      desc: "Only the 32-byte cryptographic hash and version are stored on-chain, never your private shopping list.",
      href: "#verification",
    },
  ],
};

export const TRUST_BADGES = [
  { name: "Google Gemini 2.5", category: "Reasoning Engine" },
  { name: "MetaMask", category: "Web3 Wallet" },
  { name: "Base Sepolia", category: "Ethereum L2" },
  { name: "Ethereum Keccak-256", category: "Cryptographic Proof" },
  { name: "Viem & Hardhat", category: "Smart Contracts" },
  { name: "Indian Rupee (₹)", category: "Integer Paise Math" },
];

export const STATS_ITEMS = [
  {
    number: "100%",
    label: "Integer Paise Precision",
    caption: "Zero floating-point calculation errors or budget leakage.",
  },
  {
    number: "₹0",
    label: "Over-Budget Tolerance",
    caption: "Mathematical knapsack guarantee strictly enforces price caps.",
  },
  {
    number: "< 1.2s",
    label: "Gemini Reasoning Speed",
    caption: "Fast situational context expansion into complete SKU bundles.",
  },
  {
    number: "32 Bytes",
    label: "On-Chain Storage Footprint",
    caption: "Zero private customer data stored on-chain, preserving privacy.",
  },
];

export const USE_CASES_BENTO = [
  {
    id: "case-college",
    title: "College 3-Day Fest",
    subtitle: "From chaos to curated campus readiness",
    budgetRange: "₹2,500 – ₹4,000",
    description:
      "Context-aware planning for multi-day university events. Anticipates hydration, phone battery drain during night concerts, and identity lanyard stationery.",
    highlights: ["Humid weather hydration", "Fast-charge power banks", "UV-protection rain gear"],
    accentColor: "#F4A28C",
  },
  {
    id: "case-trek",
    title: "Monsoon Trekking",
    subtitle: "Weatherproof gear tailored to the terrain",
    budgetRange: "₹3,500 – ₹6,000",
    description:
      "Heavy downpours and trail emergencies require precise packing. The agent filters for IPX6 dry sacks, trail headlamps, and instant ORS electrolytes.",
    highlights: ["Ripstop rain poncho", "Trail first-aid kit", "Compact headlamp"],
    accentColor: "#1F4D45",
  },
  {
    id: "case-hostel",
    title: "Hostel Room Setup",
    subtitle: "Turn an empty dorm into home",
    budgetRange: "₹4,000 – ₹7,500",
    description:
      "First-time hostellers forget the little essentials. Bundles spike busters, bedside storage pouches, study desk clip lamps, and laundry organizers.",
    highlights: ["Multi-plug spike buster", "Bedside pocket caddy", "Study desk LED lamp"],
    accentColor: "#E9D8FF",
  },
  {
    id: "case-festival",
    title: "Diwali Family Gifting",
    subtitle: "Thoughtful artisan gifts within a fixed family pool",
    budgetRange: "₹3,000 – ₹8,000",
    description:
      "Equitably splits a single festive budget across 4 families with artisanal brass diyas, organic dry fruit hampers, and hand-poured soy candles.",
    highlights: ["Brass oil lamps", "Organic dry fruits", "Handmade greeting cards"],
    accentColor: "#F9D5CB",
  },
];

export const FAQ_ITEMS = [
  {
    question: "How does the AI guarantee my plan won't exceed my budget?",
    answer:
      "We convert every Rupee into integer paise (e.g. ₹3,000 = 300,000 paise). The agent uses a knapsack optimization algorithm that mathematically treats your budget as an inviolable ceiling. Floats and partial decimals are banned, meaning your plan total can never exceed the budget cap.",
  },
  {
    question: "What actually gets stored on the Base Sepolia blockchain?",
    answer:
      "Only the 32-byte cryptographic Keccak-256 hash of your canonical plan JSON, your plan version number (e.g. v1, v2), and the timestamp. Your personal shopping list, item names, and private prompts are never uploaded to the public blockchain, ensuring total privacy.",
  },
  {
    question: "Can I modify my shopping plan after it has been created?",
    answer:
      "Yes! When you modify items or adjust your budget, the agent computes an incremental version (v2, v3). It records a versioned lineage on-chain that references the same Intent ID while preserving previous records immutably.",
  },
  {
    question: "How do I plug in real Google Gemini and MetaMask later?",
    answer:
      "We provide clearly marked stub functions in lib/stubs.ts (generatePlan, hashPlan, connectWallet, and recordPlanOnChain). You simply swap the mock promises with your Gemini API key and Viem contract client—the entire UI is already wired to display real responses.",
  },
  {
    question: "Why use Base Sepolia instead of Ethereum Mainnet?",
    answer:
      "Base Sepolia is Coinbase's high-speed, ultra-low-cost Layer-2 testnet. It provides near-instant confirmation times (< 1 second) and negligible gas costs (sub-cent), making on-chain intent recording frictionless for everyday shoppers.",
  },
];
