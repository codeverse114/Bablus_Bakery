const express = require('express');
const path = require('path');
const cors = require('cors');
const apiRouter = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve API
app.use('/api', apiRouter);

// Blueprint Test W8: Wholesaler opens admin URL -> Denied (403)
app.all('/admin*', (req, res) => {
  res.status(403).send('<!DOCTYPE html><html><head><title>403 Access Denied</title></head><body style="font-family:sans-serif;text-align:center;padding:50px;"><h1>403 Forbidden</h1><p>Access Denied: Admin panel is restricted to system administrators.</p><a href="/">Return to Storefront</a></body></html>');
});

// Blueprint Section 2 & Milestone 8: QR Landing Page (short link tagged as In-shop)
app.get('/qr', (req, res) => {
  res.redirect('/?tag=in-shop');
});

// Serve static frontend assets
app.use(express.static(path.join(__dirname, '../public')));

// Fallback to index.html for client routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Backrey Bases server running at http://localhost:${PORT}`);
  });
}

module.exports = app;
