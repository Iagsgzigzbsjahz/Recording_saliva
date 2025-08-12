require('dotenv').config();
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const db = require('./db');
const villages = require('./villages');
const { stringify } = require('csv-stringify');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_CODE = process.env.ADMIN_CODE || 'BADAN2025';

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Helpers
const insertPlayer = db.prepare(`
  INSERT INTO players (name, phone, village, team, ip) VALUES (?, ?, ?, ?, ?)
`);
const listPlayers = db.prepare(`
  SELECT id, name, phone, village, team, created_at FROM players ORDER BY id DESC
`);
const existsPlayer = db.prepare(`
  SELECT COUNT(*) as c FROM players WHERE name = ? AND village = ?
`);

// Routes
app.get('/', (req, res) => {
  res.render('index', { villagesCount: villages.length });
});

app.get('/register', (req, res) => {
  res.render('register', { villages });
});

app.post('/register', (req, res) => {
  const { name, phone, village, team } = req.body;

  // Basic validation
  if (!name || !village || !villages.includes(village)) {
    return res.status(400).render('register', {
      villages,
      error: 'فضلاً اكمل البيانات واختر قرية صحيحة.',
      old: { name, phone, village, team }
    });
  }

  // Prevent exact duplicate (same name + village)
  const dup = existsPlayer.get(name.trim(), village);
  if (dup.c > 0) {
    return res.status(409).render('register', {
      villages,
      error: 'هذا اللاعب مُسجّل مسبقاً من نفس القرية.',
      old: { name, phone, village, team }
    });
  }

  try {
    insertPlayer.run(
      String(name).trim(),
      phone ? String(phone).trim() : null,
      village,
      team ? String(team).trim() : null,
      req.ip
    );
  } catch (e) {
    console.error(e);
    return res.status(500).render('register', {
      villages,
      error: 'حدث خطأ غير متوقع. حاول لاحقاً.',
      old: { name, phone, village, team }
    });
  }

  res.redirect('/thankyou');
});

app.get('/thankyou', (req, res) => {
  res.render('thankyou');
});

// Admin (simple code gate)
function requireAdmin(req, res, next) {
  const code = req.query.code || req.headers['x-admin-code'];
  if (code === ADMIN_CODE) return next();
  res.status(401).send(`
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <div style="font-family: system-ui; max-width: 560px; margin: 40px auto;">
      <h3>🔒 Admin</h3>
      <p>أدخل الكود للوصول إلى لوحة الإدارة:</p>
      <form method="GET" action="/admin">
        <input name="code" placeholder="ADMIN CODE" style="padding:10px;border:1px solid #ccc;border-radius:10px;width:100%;margin-bottom:10px">
        <button style="padding:10px 14px;border-radius:10px;background:black;color:white;">دخول</button>
      </form>
    </div>
  `);
}

app.get('/admin', requireAdmin, (req, res) => {
  const rows = listPlayers.all();
  res.render('admin', { rows });
});

app.get('/admin/export', requireAdmin, (req, res) => {
  const rows = listPlayers.all();
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="badan_players.csv"');

  const stringifier = stringify({
    header: true,
    columns: ['id', 'name', 'phone', 'village', 'team', 'created_at']
  });
  rows.forEach(r => stringifier.write(r));
  stringifier.end();
  stringifier.pipe(res);
});

// API villages (لو حبيت تستخدمها AJAX)
app.get('/api/villages', (_req, res) => {
  res.json(villages);
});

app.listen(PORT, () => {
  console.log(Badan Cup running on http://localhost:${PORT});
});