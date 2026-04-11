export const RARITY_LEVELS = ['Unicorn', 'ASAP', 'P00', 'P0', 'P1', 'P2', 'Not Ranked'] as const;

// Notion-matching colors
export const RARITY_COLORS: Record<string, string> = {
  Unicorn: 'bg-neutral-500/20 text-neutral-200 border-neutral-500/30',   // default
  ASAP: 'bg-pink-500/20 text-pink-300 border-pink-500/30',               // pink
  P00: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',       // green
  P0: 'bg-red-500/20 text-red-300 border-red-500/30',                    // red
  P1: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',           // yellow
  P2: 'bg-blue-500/20 text-blue-300 border-blue-500/30',                 // blue
  'Not Ranked': 'bg-neutral-600/20 text-neutral-400 border-neutral-600/30', // gray
};

// Notion 1st Category colors
export const CATEGORY_1_OPTIONS = ['Clothing', 'Accessories', 'Shoe', 'Ski'] as const;
export const CATEGORY_1_COLORS: Record<string, string> = {
  Clothing: 'bg-amber-700/20 text-amber-300 border-amber-700/30',        // brown
  Accessories: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',   // yellow
  Shoe: 'bg-blue-500/20 text-blue-300 border-blue-500/30',               // blue
  Ski: 'bg-neutral-500/20 text-neutral-300 border-neutral-500/30',        // default
  Equipment: 'bg-neutral-500/20 text-neutral-300 border-neutral-500/30',
  Footwear: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  Optics: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
};

// Notion Genre colors
export const GENRE_OPTIONS = [
  'Millitary Inspired', 'Sportswear/Leisure', 'Counter Cultural', 'Quite Luxury',
  'Chic Minimalist', 'Dystopian', 'Streetwear', 'Techwear', 'Avant Grade',
  'Intellectual', 'Outdoor', 'Post Acopalyptic', 'Workwear', 'Deconstructive',
  'Opulent', 'Yama/Urban Outdoor', 'Ski', 'Camera', 'Camp', 'Experimental',
  'Quite Outdoor', 'Tactical Supply',
] as const;

export const GENRE_COLORS: Record<string, string> = {
  'Millitary Inspired': 'bg-neutral-500/20 text-neutral-300 border-neutral-500/30',
  'Sportswear/Leisure': 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  'Counter Cultural': 'bg-red-500/20 text-red-300 border-red-500/30',
  'Quite Luxury': 'bg-neutral-500/20 text-neutral-400 border-neutral-600/30',
  'Chic Minimalist': 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  'Dystopian': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  'Streetwear': 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  'Techwear': 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  'Avant Grade': 'bg-red-500/20 text-red-300 border-red-500/30',
  'Intellectual': 'bg-amber-700/20 text-amber-300 border-amber-700/30',
  'Outdoor': 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  'Post Acopalyptic': 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  'Workwear': 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  'Deconstructive': 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  'Opulent': 'bg-neutral-500/20 text-neutral-300 border-neutral-500/30',
  'Yama/Urban Outdoor': 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  'Ski': 'bg-amber-700/20 text-amber-300 border-amber-700/30',
  'Camera': 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  'Camp': 'bg-red-500/20 text-red-300 border-red-500/30',
  'Experimental': 'bg-pink-500/20 text-pink-300 border-pink-500/30',
  'Quite Outdoor': 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  'Tactical Supply': 'bg-amber-700/20 text-amber-300 border-amber-700/30',
};

// Notion Availability colors
export const AVAILABILITY_OPTIONS = [
  'Available at Retail', 'Available via Archive Webs', 'Rare',
  'Need dedicated buyer', 'Pre Order Made', 'In Transit',
] as const;

export const AVAILABILITY_COLORS: Record<string, string> = {
  'Rare': 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  'Need dedicated buyer': 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  'Available via Archive Webs': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  'Available at Retail': 'bg-amber-700/20 text-amber-300 border-amber-700/30',
  'Pre Order Made': 'bg-neutral-500/20 text-neutral-400 border-neutral-600/30',
  'In Transit': 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
};

// Notion Shipping Status colors
export const SHIPPING_OPTIONS = [
  'Arrived', 'US Custom -> Home', 'Custom Clearing',
  'Buyer → US Custom', 'Original → Buyer', 'Not Started Yet', 'Returning',
] as const;

export const SHIPPING_COLORS: Record<string, string> = {
  'Arrived': 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  'US Custom -> Home': 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  'Custom Clearing': 'bg-pink-500/20 text-pink-300 border-pink-500/30',
  'Buyer → US Custom': 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  'Original → Buyer': 'bg-red-500/20 text-red-300 border-red-500/30',
  'Not Started Yet': 'bg-neutral-500/20 text-neutral-400 border-neutral-600/30',
  'Returning': 'bg-orange-500/20 text-orange-300 border-orange-500/30',
};

export const BRANDS = [
  // Major brands (>100 objects in DB)
  'stone-island', 'arcteryx', 'sacai', 'moncler', 'rick-owens',
  'brave-star', 'helmut-lang', 'stone-island-shadow-project', 'acronym',
  'post-archive-faction', 'arcteryx-veilance', 'kiko-kostadinov',
  'and-wander', 'nanamica', 'craig-green', 'moment-skis', 'haven',
  'ten-c', 'goldwin',
  // Medium brands (10-100 objects)
  'arcteryx-resale-ca', 'chrome-hearts', 'raf-simons', 'arcteryx-priority',
  'dries-van-noten', 'enfants-riches-déprimés',
  // Smaller / Notion brands
  'fuct', 'junya-watanabe', 'no-faith-studio', 'balenciaga---demna-gvasalia',
  'brave-star-selvedge', 'burton', 'charlie-constantinou', 'massimo-osti',
  'yohji-yamamoto', 'undercover', '_j.l---a.l_', 'tilak', 'issey-miyaki',
  'aitor-throup', 'walter-van-beirendonck', 'decente', 'patagonia', 'norrona',
  // Optics
  'olympus', 'leica', 'oakley', 'hassablad', 'pentax', 'fujifilm',
  'panasonic', 'kodak', 'konica', 'yashica', 'zeiss-ikon', 'canon',
  'nikon', 'minolta', 'sony-electronics', 'rollei',
  // Other
  'y-3', 'marmot', 'peter-do', '686', 'rei-kawakubo---comme-des-garçons',
] as const;

// Acronym official categories (acrnm.com navigation)
export const ACRONYM_CATEGORIES = [
  'Jackets', 'Pants', 'Shirts', 'Dresses', 'Accessories', 'Bags', 'Shoes', 'Audio Visual',
] as const;

// Acronym official styles (acrnm.com product classification)
export const ACRONYM_STYLES = [
  'Hardshell', 'Lightshell', 'Softshell', 'Insulator', 'Nonshell',
  'Next To Skin', 'Third Arm', 'Audio Visual', 'NA',
] as const;

export const BRAND_DISPLAY: Record<string, string> = {
  // Fashion — Major
  'acronym': 'ACRONYM',
  'arcteryx': "Arc'teryx",
  'arcteryx-veilance': 'Veilance',
  'arcteryx-resale-ca': "Arc'teryx Resale",
  'arcteryx-priority': "Arc'teryx Priority",
  'stone-island': 'Stone Island',
  'stone-island-shadow-project': 'Stone Island Shadow Project',
  'rick-owens': 'Rick Owens',
  'sacai': 'SACAI',
  'moncler': 'Moncler',
  'helmut-lang': 'Helmut Lang',
  'post-archive-faction': 'Post Archive Faction',
  'kiko-kostadinov': 'Kiko Kostadinov',
  'craig-green': 'Craig Green',
  'nanamica': 'nanamica',
  'ten-c': 'Ten C',
  'goldwin': 'Goldwin',
  'and-wander': 'And Wander',
  'brave-star': 'Brave Star',
  // Fashion — Medium
  'raf-simons': 'Raf Simons',
  'dries-van-noten': 'Dries Van Noten',
  'yohji-yamamoto': 'Yohji Yamamoto',
  'junya-watanabe': 'Junya Watanabe',
  'undercover': 'Undercover',
  'balenciaga---demna-gvasalia': 'Balenciaga',
  'issey-miyaki': 'Issey Miyake',
  'enfants-riches-déprimés': 'Enfants Riches Déprimés',
  'walter-van-beirendonck': 'Walter Van Beirendonck',
  '_j.l---a.l_': 'J.L-A.L',
  'rei-kawakubo---comme-des-garçons': 'Comme des Garçons',
  'y-3': 'Y-3',
  'peter-do': 'Peter Do',
  // Fashion — Smaller / Niche
  'fuct': 'FUCT',
  'haven': 'Haven',
  'chrome-hearts': 'Chrome Hearts',
  'chrome-heart': 'Chrome Hearts',
  'no-faith-studio': 'No Faith Studios',
  'brave-star-selvedge': 'Brave Star Selvedge',
  'charlie-constantinou': 'Charlie Constantinou',
  'aitor-throup': 'Aitor Throup',
  'massimo-osti': 'Massimo Osti',
  'burton': 'Burton',
  'tilak': 'Tilak',
  'decente': 'Descente',
  // Outdoor
  'norrona': 'Norrøna',
  'patagonia': 'Patagonia',
  'marmot': 'Marmot',
  '686': '686',
  // Ski
  'moment-skis': 'Moment Skis',
  'moment-ski': 'Moment Skis',
  // Optics / Camera
  'leica': 'Leica',
  'hassablad': 'Hasselblad',
  'olympus': 'Olympus',
  'fujifilm': 'Fujifilm',
  'pentax': 'Pentax',
  'canon': 'Canon',
  'nikon': 'Nikon',
  'minolta': 'Minolta',
  'konica': 'Konica',
  'kodak': 'Kodak',
  'panasonic': 'Panasonic',
  'sony-electronics': 'Sony',
  'yashica': 'Yashica',
  'zeiss-ikon': 'Zeiss Ikon',
  'rollei': 'Rollei',
  'oakley': 'Oakley',
  'ricoh': 'Ricoh',
};

// 2nd Category colors from Notion
export const CATEGORY_2_COLORS: Record<string, string> = {
  'Shell Jacket/Cagoule/Windbreaker': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  'Non-Shell Jacket': 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  'Anorak': 'bg-neutral-500/20 text-neutral-400 border-neutral-600/30',
  'Midlayer': 'bg-pink-500/20 text-pink-300 border-pink-500/30',
  'Coat': 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  'Insulated Jacket/Insulator': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  'Insulated Hardshell': 'bg-red-500/20 text-red-300 border-red-500/30',
  'Puffer': 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  'Pants': 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  'Top': 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  'Bag': 'bg-neutral-500/20 text-neutral-300 border-neutral-500/30',
  'Boot': 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  'Sneakers': 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
};

// Database views moved to src/lib/views.ts as ViewConfig with localStorage persistence

export const MONITOR_SITES = [
  { key: 'acronym', label: 'ACRONYM', domain: 'acrnm.com' },
  { key: 'arcteryx', label: "Arc'teryx", domain: 'arcteryx.com' },
  { key: 'arcteryx-priority', label: "Arc'teryx Priority", domain: 'arcteryx.com' },
  { key: 'arcteryx-outlet', label: "Arc'teryx Outlet", domain: 'outlet.arcteryx.com' },
  { key: 'arcteryx-resale', label: "Arc'teryx Resale", domain: 'resale.arcteryx.com' },
  { key: 'rei', label: 'REI', domain: 'rei.com' },
  { key: 'mec', label: 'MEC', domain: 'mec.ca' },
  { key: 'fuct', label: 'FUCT', domain: 'fuct.com' },
  { key: 'haven', label: 'Haven', domain: 'havenshop.com' },
  { key: 'moment-skis', label: 'Moment Skis', domain: 'momentskis.com' },
  { key: 'chrome-hearts', label: 'Chrome Hearts', domain: 'chromehearts.com' },
] as const;

export const WATCH_RULES = [
  {
    label: 'GAMMA SL PANT 36/38-S',
    namePatterns: ['gamma', 'sl', 'pant'],
    targetSizes: ['36-S', '36 Short', '36S', '38-S', '38 Short', '38S', '36-SRT', '38-SRT'],
    mensOnly: true,
  },
  {
    label: 'GAMMA MX PANT 36/38-S',
    namePatterns: ['gamma', 'mx', 'pant'],
    targetSizes: ['36-S', '36 Short', '36S', '38-S', '38 Short', '38S', '36-SRT', '38-SRT'],
    mensOnly: true,
  },
  {
    label: 'GRANVILLE 10 COURIER BAG',
    namePatterns: ['granville', '10'],
    targetSizes: undefined,
    mensOnly: false,
  },
  {
    label: 'MACAI JACKET',
    namePatterns: ['macai'],
    targetSizes: undefined,
    mensOnly: true,
  },
  {
    label: 'FISSILE SV JACKET',
    namePatterns: ['fissile'],
    targetSizes: undefined,
    mensOnly: true,
  },
  {
    label: 'ALPHA SV',
    namePatterns: ['alpha', 'sv'],
    targetSizes: undefined,
    mensOnly: true,
  },
] as const;
