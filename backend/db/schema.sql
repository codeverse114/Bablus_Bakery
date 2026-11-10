-- Backrey Bases - PostgreSQL Schema (Supabase Compatible)
-- Matches Blueprint Addendum Section 10 Data Model

CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  password TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  pack_size TEXT NOT NULL,
  retail_price NUMERIC NOT NULL,
  wholesale_price NUMERIC NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER NOT NULL DEFAULT 20,
  is_live BOOLEAN NOT NULL DEFAULT TRUE,
  min_wholesale_qty INTEGER NOT NULL DEFAULT 1,
  image TEXT DEFAULT '',
  tagline TEXT DEFAULT '',
  description TEXT DEFAULT '',
  hsn_code TEXT DEFAULT '',
  gst_rate NUMERIC NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS price_lists (
  id TEXT PRIMARY KEY,
  section TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS price_list_items (
  price_list_id TEXT NOT NULL REFERENCES price_lists(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'pack',
  pack_size INTEGER NOT NULL DEFAULT 1,
  price NUMERIC NOT NULL,
  price_paise INTEGER NOT NULL,
  moq INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (price_list_id, product_id)
);

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  section TEXT NOT NULL,
  name TEXT NOT NULL,
  shop_name TEXT DEFAULT '',
  mobile TEXT UNIQUE NOT NULL,
  email TEXT DEFAULT '',
  address TEXT DEFAULT '',
  state TEXT DEFAULT 'Karnataka',
  gstin TEXT DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  can_login BOOLEAN NOT NULL DEFAULT TRUE,
  price_list_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS price_change_log (
  id TEXT PRIMARY KEY,
  admin_id TEXT NOT NULL,
  section TEXT DEFAULT '',
  list_name TEXT DEFAULT '',
  price_list_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  old_price NUMERIC,
  new_price NUMERIC,
  old_moq INTEGER,
  new_moq INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stock_locations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS location_stock (
  location_id TEXT NOT NULL REFERENCES stock_locations(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  qty INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (location_id, product_id)
);

CREATE TABLE IF NOT EXISTS stock_transfers (
  id TEXT PRIMARY KEY,
  from_location TEXT NOT NULL,
  to_location TEXT NOT NULL,
  product_id TEXT NOT NULL,
  qty INTEGER NOT NULL,
  admin_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
  order_no TEXT PRIMARY KEY,
  invoice_no TEXT UNIQUE,
  reservation_id TEXT,
  payment_id TEXT,
  customer_id TEXT,
  wholesaler_id TEXT,
  section TEXT NOT NULL DEFAULT 'regular',
  price_list_id TEXT,
  stock_location_id TEXT DEFAULT 'loc-shop',
  customer_json JSONB NOT NULL,
  items_json JSONB NOT NULL,
  subtotal NUMERIC NOT NULL,
  delivery_charge NUMERIC NOT NULL DEFAULT 0,
  tax_gst NUMERIC NOT NULL DEFAULT 0,
  grand_total NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'Paid',
  status_steps_json JSONB NOT NULL,
  channel TEXT DEFAULT 'Online',
  tag TEXT DEFAULT 'Retail',
  payment_mode TEXT DEFAULT 'Online Gateway',
  internal_notes TEXT DEFAULT '',
  expected_delivery TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_log (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  type TEXT NOT NULL,
  quantity_change INTEGER NOT NULL,
  previous_stock INTEGER NOT NULL,
  new_stock INTEGER NOT NULL,
  reason TEXT DEFAULT '',
  order_no TEXT,
  user_name TEXT DEFAULT 'System',
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS otp_log (
  id TEXT PRIMARY KEY,
  mobile TEXT NOT NULL,
  device_id TEXT DEFAULT 'web',
  otp TEXT,
  requested_at BIGINT NOT NULL,
  status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS wholesalers (
  id TEXT PRIMARY KEY,
  shop_name TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  mobile TEXT NOT NULL,
  email TEXT NOT NULL,
  address TEXT DEFAULT '',
  state TEXT DEFAULT 'Karnataka',
  gstin TEXT DEFAULT '',
  password TEXT NOT NULL,
  price_overrides_json JSONB DEFAULT '{}'::jsonb
);
