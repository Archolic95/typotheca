-- Typotheca — Supabase Schema
-- "The Gallery of Types" — definitive repository of intentionally designed objects
--
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query)
-- Safe to re-run: uses IF NOT EXISTS + idempotent migration blocks
--
-- Covers: fashion, footwear, accessories, outdoor equipment, optics (cameras), ski

-- ─── Extensions ─────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- fast fuzzy text search

-- ─── Migration: garments → objects ──────────────────────────────────────────
-- Rename old tables if they exist and the new ones don't yet.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'garments' AND schemaname = 'public')
     AND NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'objects' AND schemaname = 'public') THEN
    ALTER TABLE garments RENAME TO objects;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'garment_colorways' AND schemaname = 'public')
     AND NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'object_colorways' AND schemaname = 'public') THEN
    ALTER TABLE garment_colorways RENAME TO object_colorways;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'garment_materials' AND schemaname = 'public')
     AND NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'object_materials' AND schemaname = 'public') THEN
    ALTER TABLE garment_materials RENAME TO object_materials;
  END IF;
  -- Rename garment_id → object_id in colorways/materials if still using old column name
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='object_colorways' AND column_name='garment_id') THEN
    ALTER TABLE object_colorways RENAME COLUMN garment_id TO object_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='object_materials' AND column_name='garment_id') THEN
    ALTER TABLE object_materials RENAME COLUMN garment_id TO object_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='price_points' AND column_name='garment_id') THEN
    ALTER TABLE price_points RENAME COLUMN garment_id TO object_id;
  END IF;
END $$;

-- ─── Objects ─────────────────────────────────────────────────────────────────
-- Core table. One row per unique designed object (brand + model_code + season).
-- Covers clothing, footwear, accessories, ski equipment, cameras, and any
-- future category of intentionally designed objects.
CREATE TABLE IF NOT EXISTS objects (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- ── Identity ────────────────────────────────────────────────────────────
  brand            TEXT NOT NULL,       -- 'acronym', 'arcteryx', 'stone-island', 'contax', ...
  name             TEXT NOT NULL,       -- "P60-E Pant", "T3", "G2 Rangefinder"
  model_code       TEXT,                -- "P60-E", "J1A-GT", "G2" (brand-canonical SKU)
  season           TEXT,                -- "SS26", "FW24", "2024 AW" — null for timeless objects

  -- ── Authorship ──────────────────────────────────────────────────────────
  designer         TEXT,                -- "Errolson Hugh", "Yohji Yamamoto", "Raf Simons"
  collab           TEXT,                -- "Burton", "BEAMS", "Nike" — null if not a collab
  country_of_origin TEXT,               -- "Japan", "Switzerland", "Italy", "China"
  release_date     DATE,                -- specific release date when known

  -- ── Typotheca Classification ─────────────────────────────────────────────
  -- 3-level hierarchy matching your Notion typology (1st / 2nd / 3rd)
  category_1       TEXT,                -- 'Clothing' | 'Footwear' | 'Accessories' | 'Equipment' | 'Optics'
  category_2       TEXT,                -- e.g. 'Shell Jacket', 'Ski', 'Camera', 'Sneakers', 'Bag'
  category_3       TEXT,                -- e.g. 'Hardshell', 'Park Ski', '35mm Rangefinder', 'BDU Pant'
  genre            TEXT[]  DEFAULT '{}', -- ['Techwear', 'Avant Grade', 'Outdoor', 'Dystopian', ...]
  silhouette       TEXT,                -- 'relaxed', 'fitted', 'oversized' (clothing only)
  features         TEXT[]  DEFAULT '{}', -- ['waterproof', 'packable', 'TEC SYS', 'GORE-TEX', ...]

  -- ── Category-Specific Specs (JSONB — flexible per category_1) ───────────
  -- Clothing:  { weight_g, layers, waterproof_rating_mm, breathability_mvt, generation }
  -- Equipment: { length_cm, tip_width_mm, waist_width_mm, tail_width_mm, radius_m, flex, binding_standard }
  -- Optics:    { format, film_type, lens_mount, shutter_min, shutter_max, meter_type, production_years }
  -- Eyewear:   { lens_type, frame_material, uv_protection }
  specs            JSONB   DEFAULT '{}',

  -- ── Sizing ──────────────────────────────────────────────────────────────
  sizes_available  TEXT[]  DEFAULT '{}', -- ['XS','S','M','L','XL'] or ['165','172','179']
  colorway_count   INT     DEFAULT 1,

  -- ── Pricing ─────────────────────────────────────────────────────────────
  retail_price     NUMERIC(10,2),
  retail_currency  TEXT    DEFAULT 'USD',

  -- ── Notion Personal Tracking ─────────────────────────────────────────────
  -- Imported from your "My Ultimate Anti-Trend Wardrobe" database.
  -- These are your personal classification and acquisition fields.
  notion_page_id   TEXT,                -- Notion page UUID
  notion_rarity    TEXT,                -- 'Unicorn' | 'ASAP' | 'P00' | 'P0' | 'P1' | 'P2'
  notion_priority  INT,                 -- Order field (lower = higher priority to acquire)
  notion_availability TEXT,             -- 'Available at Retail' | 'Available via Archive Webs' | 'Rare' | 'Need dedicated buyer' | 'Pre Order Made'
  notion_copped    BOOLEAN DEFAULT false, -- true = acquired / in collection
  notion_shipping  TEXT,                -- 'Arrived' | 'Not Started Yet' | 'Buyer → US Custom' | ...
  notion_price_cny NUMERIC(10,2),       -- Price in CNY from 初始问价 negotiations

  -- ── Flags ───────────────────────────────────────────────────────────────
  in_stock         BOOLEAN DEFAULT true,
  limited_edition  BOOLEAN DEFAULT false,
  discontinued     BOOLEAN DEFAULT false,
  is_secondary_market BOOLEAN DEFAULT false,

  -- ── Source ──────────────────────────────────────────────────────────────
  source_url       TEXT NOT NULL,       -- canonical product URL
  source_site      TEXT NOT NULL,       -- 'acrnm.com', 'arcteryx.com', 'web.archive.org', ...
  archive_path     TEXT,                -- local path or R2 object key

  -- ── Rich Content ────────────────────────────────────────────────────────
  image_urls       TEXT[]  DEFAULT '{}',
  full_text        TEXT,                -- complete brand description text
  sections         JSONB   DEFAULT '{}', -- { "Fabric Technology": "...", "Sizing": "...", ... }
  structured_data  JSONB,               -- JSON-LD from page (when available)

  -- ── Timestamps ──────────────────────────────────────────────────────────
  first_seen_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add new columns to existing objects table (idempotent — safe to re-run)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='objects' AND column_name='designer')           THEN ALTER TABLE objects ADD COLUMN designer TEXT; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='objects' AND column_name='collab')             THEN ALTER TABLE objects ADD COLUMN collab TEXT; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='objects' AND column_name='country_of_origin')  THEN ALTER TABLE objects ADD COLUMN country_of_origin TEXT; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='objects' AND column_name='category_1')         THEN ALTER TABLE objects ADD COLUMN category_1 TEXT; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='objects' AND column_name='category_2')         THEN ALTER TABLE objects ADD COLUMN category_2 TEXT; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='objects' AND column_name='category_3')         THEN ALTER TABLE objects ADD COLUMN category_3 TEXT; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='objects' AND column_name='genre')              THEN ALTER TABLE objects ADD COLUMN genre TEXT[] DEFAULT '{}'; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='objects' AND column_name='specs')              THEN ALTER TABLE objects ADD COLUMN specs JSONB DEFAULT '{}'; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='objects' AND column_name='limited_edition')    THEN ALTER TABLE objects ADD COLUMN limited_edition BOOLEAN DEFAULT false; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='objects' AND column_name='discontinued')       THEN ALTER TABLE objects ADD COLUMN discontinued BOOLEAN DEFAULT false; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='objects' AND column_name='notion_rarity')      THEN ALTER TABLE objects ADD COLUMN notion_rarity TEXT; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='objects' AND column_name='notion_priority')    THEN ALTER TABLE objects ADD COLUMN notion_priority INT; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='objects' AND column_name='notion_availability') THEN ALTER TABLE objects ADD COLUMN notion_availability TEXT; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='objects' AND column_name='notion_copped')      THEN ALTER TABLE objects ADD COLUMN notion_copped BOOLEAN DEFAULT false; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='objects' AND column_name='notion_shipping')    THEN ALTER TABLE objects ADD COLUMN notion_shipping TEXT; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='objects' AND column_name='notion_price_cny')   THEN ALTER TABLE objects ADD COLUMN notion_price_cny NUMERIC(10,2); END IF;
  -- category column was too vague — replaced by category_1/2/3; keep for migration
  -- silhouette already existed in some versions
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='objects' AND column_name='silhouette')        THEN ALTER TABLE objects ADD COLUMN silhouette TEXT; END IF;
  -- Personal extension fields (Typotheca frontend)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='objects' AND column_name='personal_notes')      THEN ALTER TABLE objects ADD COLUMN personal_notes TEXT; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='objects' AND column_name='personal_images')     THEN ALTER TABLE objects ADD COLUMN personal_images TEXT[] DEFAULT '{}'; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='objects' AND column_name='personal_rating')     THEN ALTER TABLE objects ADD COLUMN personal_rating INT; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='objects' AND column_name='personal_wear_count') THEN ALTER TABLE objects ADD COLUMN personal_wear_count INT DEFAULT 0; END IF;
  -- Brand-specific category system (start with Acronym — expand to SI/SISP/Arc'teryx later)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='objects' AND column_name='acronym_category')    THEN ALTER TABLE objects ADD COLUMN acronym_category TEXT; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='objects' AND column_name='acronym_style')       THEN ALTER TABLE objects ADD COLUMN acronym_style TEXT; END IF;
END $$;

-- ─── Object Colorways ────────────────────────────────────────────────────────
-- One row per colorway variant of an object.
CREATE TABLE IF NOT EXISTS object_colorways (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  object_id    UUID NOT NULL REFERENCES objects(id) ON DELETE CASCADE,
  color_name   TEXT NOT NULL,
  color_hex    TEXT,
  image_urls   TEXT[]  DEFAULT '{}',
  source_url   TEXT,
  in_stock     BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Object Materials ────────────────────────────────────────────────────────
-- Normalized material composition per object (queryable: find all Gore-Tex pieces).
CREATE TABLE IF NOT EXISTS object_materials (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  object_id    UUID NOT NULL REFERENCES objects(id) ON DELETE CASCADE,
  fabric       TEXT NOT NULL,           -- 'gore-tex', 'nylon', 'merino', 'schoeller', ...
  percentage   NUMERIC(5,2),            -- 87.5 (percent)
  notes        TEXT,                    -- 'face fabric', 'lining', 'fill'
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Price Points ─────────────────────────────────────────────────────────────
-- Primary market price history (retail changes over time).
-- Secondary market removed — first-hand only per Typotheca strategy.
CREATE TABLE IF NOT EXISTS price_points (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  object_id    UUID REFERENCES objects(id) ON DELETE CASCADE,
  price        NUMERIC(10,2) NOT NULL,
  currency     TEXT NOT NULL DEFAULT 'USD',
  source       TEXT NOT NULL,           -- 'acrnm.com', 'arcteryx.com', 'web.archive.org', ...
  source_url   TEXT,
  recorded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Sources ─────────────────────────────────────────────────────────────────
-- Registry of all data sources the crawlers know about.
CREATE TABLE IF NOT EXISTS sources (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug         TEXT NOT NULL UNIQUE,   -- 'acronym-live', 'arcteryx-live', 'wayback-acronym', ...
  type         TEXT NOT NULL,          -- 'primary-live' | 'primary-archive' | 'wayback'
  display_name TEXT NOT NULL,
  base_url     TEXT,
  scraper_class TEXT,
  brands       TEXT[] DEFAULT '{}',
  enabled      BOOLEAN DEFAULT true,
  config       JSONB   DEFAULT '{}',
  last_run_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Scraper Health ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scraper_health (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_slug  TEXT NOT NULL,
  run_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  success      BOOLEAN NOT NULL,
  object_count INT,
  error_message TEXT,
  duration_ms  INT
);

-- ─── Monitor State ───────────────────────────────────────────────────────────
-- Real-time "seen" table for live drop monitors. Replaces state.json.
CREATE TABLE IF NOT EXISTS monitor_state (
  site         TEXT NOT NULL,
  product_id   TEXT NOT NULL,
  name         TEXT NOT NULL,
  url          TEXT NOT NULL,
  buy_url      TEXT,
  price        TEXT,
  currency     TEXT,
  sizes        TEXT[] DEFAULT '{}',
  image_url    TEXT,
  in_stock     BOOLEAN DEFAULT true,
  stock_count  INT,
  low_stock_alerted BOOLEAN DEFAULT false,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (site, product_id)
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────
-- Unique constraint on source_url (required for upsert conflict resolution)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'objects_source_url_unique') THEN
    ALTER TABLE objects ADD CONSTRAINT objects_source_url_unique UNIQUE (source_url);
  END IF;
  -- Also drop old constraint name if it exists (from garments era)
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'garments_source_url_unique') THEN
    ALTER TABLE objects DROP CONSTRAINT garments_source_url_unique;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_objects_brand           ON objects(brand);
CREATE INDEX IF NOT EXISTS idx_objects_brand_season    ON objects(brand, season);
CREATE INDEX IF NOT EXISTS idx_objects_model_code      ON objects(model_code);
CREATE INDEX IF NOT EXISTS idx_objects_category_1      ON objects(category_1);
CREATE INDEX IF NOT EXISTS idx_objects_category_1_2    ON objects(category_1, category_2);
CREATE INDEX IF NOT EXISTS idx_objects_genre           ON objects USING GIN(genre);
CREATE INDEX IF NOT EXISTS idx_objects_features        ON objects USING GIN(features);
CREATE INDEX IF NOT EXISTS idx_objects_source_site     ON objects(source_site);
CREATE INDEX IF NOT EXISTS idx_objects_in_stock        ON objects(in_stock);
CREATE INDEX IF NOT EXISTS idx_objects_notion_copped   ON objects(notion_copped);
CREATE INDEX IF NOT EXISTS idx_objects_notion_rarity   ON objects(notion_rarity);
CREATE INDEX IF NOT EXISTS idx_objects_updated_at      ON objects(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_objects_acronym_category ON objects(acronym_category);
CREATE INDEX IF NOT EXISTS idx_objects_acronym_style    ON objects(acronym_style);
CREATE INDEX IF NOT EXISTS idx_objects_fulltext        ON objects USING GIN(to_tsvector('english', coalesce(name,'') || ' ' || coalesce(full_text,'')));
CREATE INDEX IF NOT EXISTS idx_objects_sections        ON objects USING GIN(sections);
CREATE INDEX IF NOT EXISTS idx_objects_specs           ON objects USING GIN(specs);
CREATE INDEX IF NOT EXISTS idx_price_points_object     ON price_points(object_id);
CREATE INDEX IF NOT EXISTS idx_colorways_object        ON object_colorways(object_id);
CREATE INDEX IF NOT EXISTS idx_materials_object        ON object_materials(object_id);
CREATE INDEX IF NOT EXISTS idx_monitor_state_site      ON monitor_state(site);
CREATE INDEX IF NOT EXISTS idx_scraper_health_source   ON scraper_health(source_slug, run_at DESC);

-- ─── Updated-at trigger ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_objects_updated_at') THEN
    CREATE TRIGGER trg_objects_updated_at
      BEFORE UPDATE ON objects
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
  -- Drop old trigger name if it exists
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_garments_updated_at') THEN
    DROP TRIGGER trg_garments_updated_at ON objects;
  END IF;
END $$;

-- ─── Row Level Security ──────────────────────────────────────────────────────
ALTER TABLE objects          ENABLE ROW LEVEL SECURITY;
ALTER TABLE object_colorways ENABLE ROW LEVEL SECURITY;
ALTER TABLE object_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_points     ENABLE ROW LEVEL SECURITY;
ALTER TABLE sources          ENABLE ROW LEVEL SECURITY;

ALTER TABLE monitor_state  DISABLE ROW LEVEL SECURITY;
ALTER TABLE scraper_health DISABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'public_read_objects'      AND tablename = 'objects')          THEN CREATE POLICY "public_read_objects"       ON objects          FOR SELECT USING (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'public_read_colorways'    AND tablename = 'object_colorways') THEN CREATE POLICY "public_read_colorways"     ON object_colorways FOR SELECT USING (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'public_read_materials'    AND tablename = 'object_materials') THEN CREATE POLICY "public_read_materials"     ON object_materials FOR SELECT USING (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'public_read_price_points' AND tablename = 'price_points')    THEN CREATE POLICY "public_read_price_points"  ON price_points     FOR SELECT USING (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'public_read_sources'      AND tablename = 'sources')         THEN CREATE POLICY "public_read_sources"       ON sources          FOR SELECT USING (true); END IF;
END $$;

-- ─── Smart object upsert ─────────────────────────────────────────────────────
-- Called by all crawlers and monitors instead of a plain table upsert.
--
-- Merge strategy (three cases):
--
--   1. PROMOTE: a notion:// placeholder exists matching (brand, model_code, season)
--      → update its source_url to the real URL and fill content fields
--      → Notion typology fields (category_*, genre, notion_*) are preserved
--
--   2. UPDATE: a real-URL row already exists
--      → update content fields only; never touch typology or notion_* fields
--      → first_seen_at kept as earliest; last_seen_at updated
--
--   3. INSERT: no match → insert new row with content only
--      (typology fields will be filled later by import:notion or Claude enrichment)
--
-- Ownership:
--   Typotheca layer (owned by import:notion):  name, category_*, genre, notion_*
--   Content layer   (owned by crawlers):        image_urls, full_text, sections,
--                                               retail_price, sizes_available, in_stock
CREATE OR REPLACE FUNCTION upsert_object(obj jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  placeholder_id  UUID;
  brand_val       TEXT  := obj->>'brand';
  model_code_val  TEXT  := obj->>'model_code';
  season_val      TEXT  := obj->>'season';
  source_url_val  TEXT  := obj->>'source_url';
  arr_images      TEXT[];
  arr_sizes       TEXT[];
  arr_genre       TEXT[];
BEGIN
  -- Parse array fields from JSON
  SELECT array_agg(x) INTO arr_images FROM jsonb_array_elements_text(obj->'image_urls') x;
  SELECT array_agg(x) INTO arr_sizes  FROM jsonb_array_elements_text(obj->'sizes_available') x;
  SELECT array_agg(x) INTO arr_genre  FROM jsonb_array_elements_text(obj->'genre') x;

  -- ── Case 1: Find a notion:// placeholder to promote ───────────────────────
  -- Match on normalized model_code (strip hyphens/spaces, case-insensitive)
  -- Try with season first, fall back to model_code-only if season doesn't match
  IF model_code_val IS NOT NULL THEN
    -- Try exact match (brand + normalized model_code + season)
    IF season_val IS NOT NULL THEN
      SELECT id INTO placeholder_id
      FROM objects
      WHERE source_url LIKE 'notion://%'
        AND brand = brand_val
        AND UPPER(REPLACE(REPLACE(model_code, '-', ''), ' ', ''))
          = UPPER(REPLACE(REPLACE(model_code_val, '-', ''), ' ', ''))
        AND UPPER(REPLACE(season, ' ', '')) = UPPER(REPLACE(season_val, ' ', ''))
      LIMIT 1;
    END IF;
    -- Fall back: match on brand + model_code only (ignoring season)
    IF placeholder_id IS NULL THEN
      SELECT id INTO placeholder_id
      FROM objects
      WHERE source_url LIKE 'notion://%'
        AND brand = brand_val
        AND UPPER(REPLACE(REPLACE(model_code, '-', ''), ' ', ''))
          = UPPER(REPLACE(REPLACE(model_code_val, '-', ''), ' ', ''))
      LIMIT 1;
    END IF;
  END IF;

  IF placeholder_id IS NOT NULL THEN
    -- Promote: give the placeholder a real URL and fill content
    UPDATE objects SET
      source_url      = source_url_val,
      source_site     = obj->>'source_site',
      image_urls      = COALESCE(arr_images, image_urls),
      full_text       = COALESCE(obj->>'full_text', full_text),
      sections        = COALESCE(obj->'sections', sections),
      structured_data = COALESCE(obj->'structured_data', structured_data),
      retail_price    = COALESCE((obj->>'retail_price')::numeric, retail_price),
      retail_currency = COALESCE(obj->>'retail_currency', retail_currency),
      sizes_available = COALESCE(arr_sizes, sizes_available),
      colorway_count  = COALESCE((obj->>'colorway_count')::int, colorway_count),
      in_stock        = COALESCE((obj->>'in_stock')::boolean, in_stock),
      archive_path    = COALESCE(obj->>'archive_path', archive_path),
      first_seen_at   = LEAST(first_seen_at, COALESCE((obj->>'first_seen_at')::timestamptz, NOW())),
      last_seen_at    = GREATEST(last_seen_at, NOW())
      -- name, category_*, genre, notion_* intentionally NOT updated here
    WHERE id = placeholder_id;
    RETURN;
  END IF;

  -- ── Cases 2 & 3: Upsert on source_url ────────────────────────────────────
  INSERT INTO objects (
    brand, name, model_code, season,
    source_url, source_site, archive_path,
    category_1,
    image_urls, full_text, sections, structured_data,
    retail_price, retail_currency, sizes_available, colorway_count,
    in_stock, is_secondary_market,
    first_seen_at, last_seen_at
  ) VALUES (
    brand_val,
    obj->>'name',
    model_code_val,
    season_val,
    source_url_val,
    obj->>'source_site',
    obj->>'archive_path',
    obj->>'category_1',
    COALESCE(arr_images, '{}'),
    obj->>'full_text',
    COALESCE(obj->'sections', '{}'),
    obj->'structured_data',
    (obj->>'retail_price')::numeric,
    COALESCE(obj->>'retail_currency', 'USD'),
    COALESCE(arr_sizes, '{}'),
    COALESCE((obj->>'colorway_count')::int, 1),
    COALESCE((obj->>'in_stock')::boolean, true),
    COALESCE((obj->>'is_secondary_market')::boolean, false),
    COALESCE((obj->>'first_seen_at')::timestamptz, NOW()),
    NOW()
  )
  ON CONFLICT (source_url) DO UPDATE SET
    -- Content fields: always refresh
    image_urls      = COALESCE(arr_images, objects.image_urls),
    full_text       = COALESCE(EXCLUDED.full_text, objects.full_text),
    sections        = COALESCE(EXCLUDED.sections, objects.sections),
    structured_data = COALESCE(EXCLUDED.structured_data, objects.structured_data),
    retail_price    = COALESCE(EXCLUDED.retail_price, objects.retail_price),
    retail_currency = COALESCE(EXCLUDED.retail_currency, objects.retail_currency),
    sizes_available = CASE WHEN array_length(arr_sizes, 1) > 0
                          THEN arr_sizes ELSE objects.sizes_available END,
    colorway_count  = COALESCE(EXCLUDED.colorway_count, objects.colorway_count),
    in_stock        = EXCLUDED.in_stock,
    archive_path    = COALESCE(EXCLUDED.archive_path, objects.archive_path),
    last_seen_at    = GREATEST(objects.last_seen_at, NOW()),
    first_seen_at   = LEAST(objects.first_seen_at, EXCLUDED.first_seen_at),
    -- Typotheca fields: fill gaps only — never overwrite existing values
    name            = COALESCE(objects.name, EXCLUDED.name),
    model_code      = COALESCE(objects.model_code, EXCLUDED.model_code),
    season          = COALESCE(objects.season, EXCLUDED.season),
    category_1      = COALESCE(objects.category_1, EXCLUDED.category_1);
    -- category_2/3, genre, notion_* : never touched by crawlers
END;
$$;

-- Allow the anon/service role to call this function
GRANT EXECUTE ON FUNCTION upsert_object(jsonb) TO anon, authenticated, service_role;

-- ─── Brand Videos ────────────────────────────────────────────────────────────
-- Season-level lookbook/promotional videos. One row per video.
-- Segments (JSONB array) hold ChatGPT-extracted per-piece cuts.
CREATE TABLE IF NOT EXISTS brand_videos (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand            TEXT NOT NULL,           -- 'acronym'
  season           TEXT,                    -- 'FW04', 'SS17', 'LFDB' — null for timeless
  title            TEXT NOT NULL,           -- 'ACRONYM® Acronymjutsu [FW-1213]'
  slug             TEXT NOT NULL UNIQUE,    -- 'acr-fw-1213' — used in URL and file paths
  vimeo_url        TEXT,                    -- 'https://vimeo.com/50626032'
  video_url        TEXT,                    -- R2/public URL to mp4 file
  thumbnail_url    TEXT,                    -- poster frame URL
  duration_seconds INT,                     -- total video length
  width            INT,
  height           INT,
  description      TEXT,                    -- Vimeo description (credits, cast, etc.)
  director         TEXT,                    -- 'Ken-Tonio Yamamoto'
  performers       TEXT[] DEFAULT '{}',     -- ['Errolson Hugh', 'Sarnai Manschuk']
  upload_date      DATE,                    -- original Vimeo upload date
  segments         JSONB DEFAULT '[]',      -- [{start_s, end_s, model_code, label, thumbnail_url}]
  tags             TEXT[] DEFAULT '{}',     -- ['acronymjutsu', 'lookbook', 'werkverzeichnis']
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for brand_videos
CREATE INDEX IF NOT EXISTS idx_brand_videos_brand        ON brand_videos(brand);
CREATE INDEX IF NOT EXISTS idx_brand_videos_brand_season  ON brand_videos(brand, season);
CREATE INDEX IF NOT EXISTS idx_brand_videos_slug          ON brand_videos(slug);
CREATE INDEX IF NOT EXISTS idx_brand_videos_segments      ON brand_videos USING GIN(segments);

-- RLS: public read
ALTER TABLE brand_videos ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'public_read_brand_videos' AND tablename = 'brand_videos') THEN
    CREATE POLICY "public_read_brand_videos" ON brand_videos FOR SELECT USING (true);
  END IF;
END $$;

-- Updated-at trigger for brand_videos
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_brand_videos_updated_at') THEN
    CREATE TRIGGER trg_brand_videos_updated_at
      BEFORE UPDATE ON brand_videos
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

-- ─── Views ───────────────────────────────────────────────────────────────────
-- objects_full: everything you'd want in a single query
CREATE OR REPLACE VIEW objects_full AS
SELECT
  o.*,
  COUNT(DISTINCT oc.id)  AS colorway_variants,
  COUNT(DISTINCT om.id)  AS material_count,
  COUNT(DISTINCT pp.id)  AS price_history_count,
  MIN(pp.price)          AS price_low,
  MAX(pp.price)          AS price_high,
  MAX(pp.recorded_at)    AS last_price_recorded_at
FROM objects o
LEFT JOIN object_colorways oc ON oc.object_id = o.id
LEFT JOIN object_materials om ON om.object_id = o.id
LEFT JOIN price_points pp     ON pp.object_id = o.id
GROUP BY o.id;

-- notion_wishlist: your acquisition tracker view
CREATE OR REPLACE VIEW notion_wishlist AS
SELECT
  id, brand, name, model_code, season, category_1, category_2, category_3,
  genre, notion_rarity, notion_priority, notion_availability,
  notion_copped, notion_shipping, notion_price_cny,
  retail_price, retail_currency, source_url, image_urls,
  collab, designer, limited_edition, discontinued
FROM objects
WHERE notion_page_id IS NOT NULL
ORDER BY notion_priority ASC NULLS LAST, notion_rarity ASC;
