const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');

const app = express();

// ===== Middlewares =====
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ===== PostgreSQL (Render) =====
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false }
});

// ===== TEST DB =====
app.get('/test-db', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ ok: true, time: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false });
  }
});

// ===== GUARDAR =====
app.post('/save', async (req, res) => {
  try {
    const {
      quote_number,
      company_name,
      client_name,
      client_ruc,
      client_email,
      client_phone,
      client_city,
      total,
      items
    } = req.body;

    const result = await pool.query(
      `INSERT INTO quotes 
      (quote_number, company_name, client_name, client_ruc, client_email, client_phone, client_city, total)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING id`,
      [quote_number, company_name, client_name, client_ruc, client_email, client_phone, client_city, total]
    );

    const quoteId = result.rows[0].id;

    for (let it of items || []) {
      await pool.query(
        `INSERT INTO quote_items (quote_id, description, qty, price)
         VALUES ($1,$2,$3,$4)`,
        [quoteId, it.desc, it.qty, it.price]
      );
    }

    res.json({ ok: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ===== LISTAR =====
app.get('/quotes', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, quote_number, company_name, client_name, 
              client_ruc, client_email, client_phone, client_city, 
              total, created_at
       FROM quotes ORDER BY id DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.json([]);
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
    console.error(err);
    res.status(500).json({ error: 'Error al obtener items' });
  }
});

// ===== ELIMINAR =====
app.delete('/quotes/:id', async (req, res) => {
  try {
    await pool.query(`DELETE FROM quote_items WHERE quote_id = $1`, [req.params.id]);
    await pool.query(`DELETE FROM quotes WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ===== FRONTEND =====
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ===== SERVER =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});