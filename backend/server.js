require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const store = require('./models/store');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Persist mutating API changes automatically to Supabase PostgreSQL when connected
app.use('/api', (req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && !req.path.startsWith('/test')) {
    res.on('finish', () => {
      if (res.statusCode < 400 && store.persistenceEnabled) {
        store.persist().catch(err => console.error('[DB Persist Error]', err.message));
      }
    });
  }
  next();
});

// Mount API and redirect routes
app.use(routes);

// Blueprint Test W8: Wholesaler or section customer opens admin URL -> Denied (403)
app.use('/admin', (req, res, next) => {
  const auth = req.headers['authorization'] || '';
  if (req.headers['x-wholesale-token'] || req.headers['x-customer-token'] || auth.includes('token-')) {
    return res.status(403).send('Access Denied: Customer or wholesaler cannot access the admin portal.');
  }
  next();
});

// Serve Admin UI at /admin
const adminDir = path.join(__dirname, '..', 'admin', 'public');
app.use('/admin', express.static(adminDir));
app.get('/admin/*', (req, res) => {
  res.sendFile(path.join(adminDir, 'index.html'));
});

// Serve Customer Storefront at /
const websiteDir = path.join(__dirname, '..', 'website', 'public');
const fallbackPublicDir = path.join(__dirname, '..', 'public');

app.use(express.static(websiteDir));
app.use(express.static(fallbackPublicDir));

// Fallback routing for HTML5 pushState if needed
app.get('/wholesale', (req, res) => {
  res.sendFile(path.join(websiteDir, 'wholesale.html'));
});

app.get('/track', (req, res) => {
  res.sendFile(path.join(websiteDir, 'track.html'));
});

app.get('/checkout', (req, res) => {
  res.sendFile(path.join(websiteDir, 'checkout.html'));
});

if (require.main === module) {
  store.initDatabase()
    .catch(err => {
      console.error('[DB Init Warning] Falling back to in-memory store:', err.message);
    })
    .finally(() => {
      app.listen(PORT, () => {
        console.log(`Backrey Bases Unified Server running at http://localhost:${PORT}`);
        console.log(`- Customer Storefront: http://localhost:${PORT}/`);
        console.log(`- Admin Panel: http://localhost:${PORT}/admin/`);
      });
    });
}

module.exports = app;
