const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');

const app = express();

// ===== Middlewares =====
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ===== PostgreSQL (FIX RENDER) =====
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 20000,
  connectionTimeoutMillis: 10000,
  keepAlive: true
});

// 🔥 evita crash del servidor
pool.on('error', (err) => {
  console.error('❌ DB Pool Error:', err.message);
});

// 🔥 keep alive real para Render (EVITA CAÍDA)
setInterval(() => {
  pool.query('SELECT 1').catch(() => {});
}, 20000);

// ===== TEST DB =====
app.get('/test-db', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ ok: true, time: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ===== NEXT QUOTE NUMBER =====
app.get('/next-quote-number', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT COALESCE(MAX(CAST(quote_number AS INTEGER)), 390) + 1 AS next FROM quotes`
    );
    res.json({ quote_number: result.rows[0].next });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ===== SAVE =====
app.post('/save', async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      company_name, client_name, client_ruc, client_email,
      client_phone, client_city, total, items
    } = req.body;

    await client.query('BEGIN');

    const result = await client.query(
      `INSERT INTO quotes 
      (quote_number, company_name, client_name, client_ruc, client_email, client_phone, client_city, total)
      VALUES (
        (SELECT COALESCE(MAX(CAST(quote_number AS INTEGER)), 390) + 1 FROM quotes),
        $1,$2,$3,$4,$5,$6,$7
      )
      RETURNING id, quote_number`,
      [company_name, client_name, client_ruc, client_email, client_phone, client_city, total]
    );

    const quoteId = result.rows[0].id;
    const newNumber = result.rows[0].quote_number;

    for (let it of items || []) {
      await client.query(
        `INSERT INTO quote_items (quote_id, description, qty, price)
         VALUES ($1,$2,$3,$4)`,
        [quoteId, it.desc, it.qty, it.price]
      );
    }

    await client.query('COMMIT');

    res.json({ ok: true, quote_number: newNumber });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ===== LIST =====
app.get('/quotes', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, quote_number, company_name, client_name,
             client_ruc, client_email, client_phone, client_city,
             total, currency, created_at
      FROM quotes
      ORDER BY id DESC
    `);

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json([]);
  }
});

// ===== ITEMS =====
app.get('/quotes/:id/items', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT description AS desc, qty, price
       FROM quote_items
       WHERE quote_id = $1`,
      [req.params.id]
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== GET ONE =====
app.get('/quotes/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM quotes WHERE id = $1`,
      [req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== DELETE =====
app.delete('/quotes/:id', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await client.query(`DELETE FROM quote_items WHERE quote_id = $1`, [req.params.id]);
    await client.query(`DELETE FROM quotes WHERE id = $1`, [req.params.id]);

    await client.query('COMMIT');

    res.json({ ok: true });

  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ===== FRONT =====
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ===== SERVER =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});