export interface ObjectRow {
  id: string;
  brand: string;
  name: string;
  model_code: string | null;
  season: string | null;
  designer: string | null;
  collab: string | null;
  country_of_origin: string | null;
  release_date: string | null;
  category_1: string | null;
  category_2: string | null;
  category_3: string | null;
  genre: string[];
  silhouette: string | null;
  features: string[];
  specs: Record<string, unknown>;
  sizes_available: string[];
  colorway_count: number;
  retail_price: number | null;
  retail_currency: string;
  notion_page_id: string | null;
  notion_rarity: string | null;
  notion_priority: number | null;
  notion_availability: string | null;
  notion_copped: boolean;
  notion_shipping: string | null;
  notion_price_cny: number | null;
  personal_notes: string | null;
  personal_images: string[];
  personal_rating: number | null;
  personal_wear_count: number;
  acronym_category: string | null;
  acronym_style: string | null;
  model_index: number | null;
  in_stock: boolean;
  limited_edition: boolean;
  discontinued: boolean;
  is_secondary_market: boolean;
  source_url: string;
  source_site: string;
  archive_path: string | null;
  image_urls: string[];
  full_text: string | null;
  sections: Record<string, string>;
  structured_data: Record<string, unknown> | null;
  first_seen_at: string;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
}

export interface MonitorStateRow {
  site: string;
  product_id: string;
  name: string;
  url: string;
  buy_url: string | null;
  price: string | null;
  currency: string | null;
  sizes: string[];
  image_url: string | null;
  in_stock: boolean;
  stock_count: number | null;
  low_stock_alerted: boolean;
  first_seen_at: string;
  last_seen_at: string;
}

export interface ScraperHealthRow {
  id: string;
  source_slug: string;
  run_at: string;
  success: boolean;
  object_count: number | null;
  error_message: string | null;
  duration_ms: number | null;
}

export interface ObjectColorwayRow {
  id: string;
  object_id: string;
  color_name: string;
  color_hex: string | null;
  image_urls: string[];
  source_url: string | null;
  in_stock: boolean;
  created_at: string;
}

export interface ObjectMaterialRow {
  id: string;
  object_id: string;
  fabric: string;
  percentage: number | null;
  notes: string | null;
  created_at: string;
}

export interface PricePointRow {
  id: string;
  object_id: string;
  price: number;
  currency: string;
  source: string;
  source_url: string | null;
  recorded_at: string;
}

// Database type for Supabase client generic
export interface Database {
  public: {
    Tables: {
      objects: { Row: ObjectRow; Insert: Partial<ObjectRow>; Update: Partial<ObjectRow> };
      monitor_state: { Row: MonitorStateRow; Insert: Partial<MonitorStateRow>; Update: Partial<MonitorStateRow> };
      scraper_health: { Row: ScraperHealthRow; Insert: Partial<ScraperHealthRow>; Update: Partial<ScraperHealthRow> };
      object_colorways: { Row: ObjectColorwayRow; Insert: Partial<ObjectColorwayRow>; Update: Partial<ObjectColorwayRow> };
      object_materials: { Row: ObjectMaterialRow; Insert: Partial<ObjectMaterialRow>; Update: Partial<ObjectMaterialRow> };
      price_points: { Row: PricePointRow; Insert: Partial<PricePointRow>; Update: Partial<PricePointRow> };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
