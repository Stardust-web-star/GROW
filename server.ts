import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { INITIAL_POLES, INITIAL_SPANS, INITIAL_SPKS } from './src/data/initialPoles.js';
import { PoleData, CableSpan, MaintenanceWorkOrder, InspectionRecord, UserAccount } from './src/types/index.js';
import { analyzePoleDataWithGemini, askGeminiAiAssistant } from './src/server/geminiService.js';
import { getClearanceStatus } from './src/utils/kmzParser.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

app.use(express.json({ limit: '50mb' }));

// Enable CORS for cross-platform access (Google AI Studio ⇄ Vercel)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Path to Persistent Master Data (TITIK TIANG BGL.kml)
const MASTER_DATA_PATH = path.join(__dirname, 'src/data/masterPoles.json');

function loadMasterData(): { poles: PoleData[]; spans: CableSpan[] } {
  try {
    if (fs.existsSync(MASTER_DATA_PATH)) {
      const raw = fs.readFileSync(MASTER_DATA_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.poles) && parsed.poles.length > 0) {
        console.log(`[MasterData] Loaded ${parsed.poles.length} master poles and ${parsed.spans?.length || 0} spans from ${MASTER_DATA_PATH}`);
        return {
          poles: parsed.poles as PoleData[],
          spans: (parsed.spans || []) as CableSpan[]
        };
      }
    }
  } catch (err) {
    console.error('[MasterData] Error reading master file:', err);
  }
  return {
    poles: [...INITIAL_POLES],
    spans: [...INITIAL_SPANS]
  };
}

function saveMasterData() {
  try {
    const dataToSave = {
      masterName: 'TITIK TIANG BGL.kml',
      source: 'Google Earth Pro PLN ULP Baguala',
      lastUpdated: new Date().toISOString(),
      polesCount: polesDatabase.length,
      spansCount: spansDatabase.length,
      poles: polesDatabase,
      spans: spansDatabase
    };
    fs.writeFileSync(MASTER_DATA_PATH, JSON.stringify(dataToSave, null, 2), 'utf-8');
    console.log(`[MasterData] Persisted ${polesDatabase.length} poles to ${MASTER_DATA_PATH}`);
  } catch (err) {
    console.error('[MasterData] Error writing master file:', err);
  }
}

// Persistent Database for PLN ULP Baguala System
const initialData = loadMasterData();
let polesDatabase: PoleData[] = initialData.poles;
let spansDatabase: CableSpan[] = initialData.spans;
let spksDatabase: MaintenanceWorkOrder[] = [...INITIAL_SPKS];

// Persistent Users Database for GROW PLN System
const USERS_DATA_PATH = path.join(__dirname, 'src/data/usersData.json');

const INITIAL_USERS: UserAccount[] = [
  {
    id: 'USR-9925045ZY',
    userId: '9925045ZY',
    name: 'Administrator ULP Baguala',
    role: 'Administrator',
    password: 'admin123',
    unit: 'ULP Baguala',
    email: 'fikiilham56@gmail.com',
    status: 'Aktif',
    createdAt: '2026-01-01',
    lastLogin: '2026-10-15'
  },
  {
    id: 'USR-SPV-8816024',
    userId: '8816024BT',
    name: 'Ir. Ahmad Zulkarnaen',
    role: 'Supervisor Teknik',
    password: 'admin123',
    unit: 'ULP Baguala',
    email: 'supervisor.baguala@pln.co.id',
    status: 'Aktif',
    createdAt: '2026-02-15'
  }
];

function loadUsersData(): UserAccount[] {
  try {
    if (fs.existsSync(USERS_DATA_PATH)) {
      const raw = fs.readFileSync(USERS_DATA_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const hasMain = parsed.some((u: UserAccount) => u.userId.toUpperCase() === '9925045ZY');
        if (!hasMain) {
          return [INITIAL_USERS[0], ...parsed];
        }
        return parsed;
      }
    }
  } catch (err) {
    console.error('[Users] Error reading users file:', err);
  }
  return [...INITIAL_USERS];
}

function saveUsersData() {
  try {
    fs.writeFileSync(USERS_DATA_PATH, JSON.stringify(usersDatabase, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Users] Error writing users file:', err);
  }
}

let usersDatabase: UserAccount[] = loadUsersData();

// API Routes
app.get('/api/poles', (req, res) => {
  res.json({
    poles: polesDatabase,
    spans: spansDatabase,
    masterName: 'TITIK TIANG BGL.kml',
    isMasterData: true
  });
});

app.get('/api/master/info', (req, res) => {
  res.json({
    masterName: 'TITIK TIANG BGL.kml',
    polesCount: polesDatabase.length,
    spansCount: spansDatabase.length,
    lastUpdated: new Date().toISOString()
  });
});

app.post('/api/master/restore', (req, res) => {
  const reloaded = loadMasterData();
  polesDatabase = reloaded.poles;
  spansDatabase = reloaded.spans;
  res.json({
    success: true,
    message: 'Master data TITIK TIANG BGL.kml berhasil dimuat ulang.',
    polesCount: polesDatabase.length,
    spansCount: spansDatabase.length
  });
});

app.post('/api/poles', (req, res) => {
  const newPole = req.body as PoleData;
  if (!newPole.id) {
    return res.status(400).json({ error: 'ID tiang wajib diisi' });
  }
  polesDatabase.unshift(newPole);
  saveMasterData();
  res.status(201).json({ success: true, pole: newPole });
});

app.post('/api/poles/bulk-import', (req, res) => {
  const { poles, spans, replaceExisting } = req.body;
  if (!Array.isArray(poles)) {
    return res.status(400).json({ error: 'Data poles harus berupa array' });
  }

  if (replaceExisting) {
    polesDatabase = [...poles];
    spansDatabase = Array.isArray(spans) ? [...spans] : [];
  } else {
    // Merge avoiding exact ID duplicates
    const existingIds = new Set(polesDatabase.map(p => p.id));
    const uniqueNewPoles = poles.filter((p: PoleData) => !existingIds.has(p.id));
    polesDatabase = [...uniqueNewPoles, ...polesDatabase];
    if (Array.isArray(spans)) {
      spansDatabase = [...spans, ...spansDatabase];
    }
  }

  saveMasterData();

  res.json({
    success: true,
    totalPoles: polesDatabase.length,
    totalSpans: spansDatabase.length,
    message: `Berhasil menyimpan ${poles.length} tiang ke master data tersimpan.`
  });
});

app.put('/api/poles/:id', (req, res) => {
  const { id } = req.params;
  const updatedData = req.body;

  const index = polesDatabase.findIndex(p => p.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Tiang tidak ditemukan' });
  }

  polesDatabase[index] = { ...polesDatabase[index], ...updatedData };
  saveMasterData();
  res.json({ success: true, pole: polesDatabase[index] });
});

app.delete('/api/poles/:id', (req, res) => {
  const { id } = req.params;
  const initialLength = polesDatabase.length;
  
  // Case-insensitive match or code match for exact target removal
  polesDatabase = polesDatabase.filter(p => p.id.toLowerCase() !== id.toLowerCase() && p.code.toLowerCase() !== id.toLowerCase());
  spansDatabase = spansDatabase.filter(s => s.fromPoleId.toLowerCase() !== id.toLowerCase() && s.toPoleId.toLowerCase() !== id.toLowerCase());

  if (polesDatabase.length === initialLength) {
    return res.status(404).json({ error: 'Tiang tidak ditemukan' });
  }

  saveMasterData();
  res.json({ success: true, message: `Tiang ${id} berhasil dihapus dari sistem GIS.` });
});

// Cable Spans CRUD Routes
app.post('/api/spans', (req, res) => {
  const newSpan = req.body as CableSpan;
  if (!newSpan.fromPoleId || !newSpan.toPoleId) {
    return res.status(400).json({ error: 'fromPoleId dan toPoleId wajib diisi' });
  }

  if (!newSpan.id) {
    newSpan.id = `SPAN-USER-${Date.now()}`;
  }

  // Check if span already exists between these two poles
  const existingIndex = spansDatabase.findIndex(s => 
    (s.fromPoleId === newSpan.fromPoleId && s.toPoleId === newSpan.toPoleId) ||
    (s.fromPoleId === newSpan.toPoleId && s.toPoleId === newSpan.fromPoleId)
  );

  if (existingIndex !== -1) {
    spansDatabase[existingIndex] = { ...spansDatabase[existingIndex], ...newSpan };
    saveMasterData();
    return res.json({ success: true, span: spansDatabase[existingIndex], updated: true });
  }

  spansDatabase.push(newSpan);
  saveMasterData();
  res.status(201).json({ success: true, span: newSpan, created: true });
});

app.put('/api/spans/:id', (req, res) => {
  const { id } = req.params;
  const updatedData = req.body;

  const index = spansDatabase.findIndex(s => s.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Bentangan kabel tidak ditemukan' });
  }

  spansDatabase[index] = { ...spansDatabase[index], ...updatedData };
  saveMasterData();
  res.json({ success: true, span: spansDatabase[index] });
});

app.delete('/api/spans/:id', (req, res) => {
  const { id } = req.params;
  const decodedId = decodeURIComponent(id).trim().toLowerCase();
  const fromPoleId = req.query.from ? decodeURIComponent(String(req.query.from)).trim().toLowerCase() : undefined;
  const toPoleId = req.query.to ? decodeURIComponent(String(req.query.to)).trim().toLowerCase() : undefined;

  const initialLength = spansDatabase.length;

  spansDatabase = spansDatabase.filter(s => {
    const sId = (s.id || '').trim().toLowerCase();
    if (sId === decodedId) {
      return false;
    }
    if (fromPoleId && toPoleId) {
      const sFrom = (s.fromPoleId || '').trim().toLowerCase();
      const sTo = (s.toPoleId || '').trim().toLowerCase();
      if ((sFrom === fromPoleId && sTo === toPoleId) || (sFrom === toPoleId && sTo === fromPoleId)) {
        return false;
      }
    }
    return true;
  });

  saveMasterData();
  res.json({
    success: true,
    message: `Bentangan kabel ${id} berhasil dihapus dari sistem.`,
    remainingSpans: spansDatabase.length
  });
});

app.post('/api/poles/:id/inspections', (req, res) => {
  const { id } = req.params;
  const inspection = req.body as InspectionRecord;

  const index = polesDatabase.findIndex(p => p.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Tiang tidak ditemukan' });
  }

  const pole = polesDatabase[index];
  pole.lastInspectionDate = inspection.date || new Date().toISOString().split('T')[0];
  pole.physicalCondition = inspection.condition || pole.physicalCondition;
  pole.clearanceDistanceMeters = inspection.cableClearanceMeters ?? pole.clearanceDistanceMeters;
  pole.clearanceStatus = getClearanceStatus(pole.clearanceDistanceMeters, pole.type);
  pole.clearanceObject = inspection.clearanceObject || pole.clearanceObject;

  if (!pole.inspectionHistory) {
    pole.inspectionHistory = [];
  }
  pole.inspectionHistory.unshift(inspection);

  saveMasterData();
  res.json({ success: true, pole });
});

app.get('/api/spk', (req, res) => {
  res.json({ spks: spksDatabase });
});

app.post('/api/spk', (req, res) => {
  const newSpk = req.body as MaintenanceWorkOrder;
  if (!newSpk.spkNumber) {
    newSpk.spkNumber = `SPK/ULP-BGL/2026/${String(spksDatabase.length + 101).padStart(3, '0')}`;
  }
  newSpk.id = `SPK-${Date.now()}`;
  newSpk.createdAt = new Date().toISOString().split('T')[0];
  spksDatabase.unshift(newSpk);

  // Update target pole spkStatus
  if (newSpk.poleId) {
    const poleIndex = polesDatabase.findIndex(p => p.id === newSpk.poleId);
    if (poleIndex !== -1) {
      polesDatabase[poleIndex].spkStatus = 'SPK Diterbitkan';
    }
  }

  res.status(201).json({ success: true, spk: newSpk });
});

// Authentication Endpoint
app.post('/api/auth/login', (req, res) => {
  const { userId, username, email, password } = req.body;
  const targetId = (userId || username || email || '').trim().toUpperCase();
  const inputPassword = (password || '').trim();

  if (!targetId || !inputPassword) {
    return res.status(400).json({ error: 'User ID dan Password wajib diisi' });
  }

  const user = usersDatabase.find(u => 
    u.userId.trim().toUpperCase() === targetId || 
    (u.email && u.email.trim().toLowerCase() === targetId.toLowerCase())
  );

  if (!user) {
    return res.status(401).json({ error: 'User ID atau Email tidak terdaftar dalam sistem GROW' });
  }

  if (user.status === 'Nonaktif') {
    return res.status(403).json({ error: 'Akun ini sedang dinonaktifkan oleh Administrator. Hubungi ULP Baguala.' });
  }

  if (user.password !== inputPassword) {
    return res.status(401).json({ error: 'Password yang Anda masukkan salah. Silakan coba lagi.' });
  }

  // Update last login
  user.lastLogin = new Date().toISOString().split('T')[0];
  saveUsersData();

  const { password: _, ...safeUser } = user;
  res.json({ success: true, user: safeUser, message: 'Login berhasil. Selamat datang di Dashboard GROW.' });
});

// Users Management CRUD
app.get('/api/users', (req, res) => {
  res.json({ users: usersDatabase });
});

app.post('/api/users', (req, res) => {
  const { userId, name, role, password, unit, email, status } = req.body;
  if (!userId || !name || !password) {
    return res.status(400).json({ error: 'User ID, Nama Lengkap, dan Password wajib diisi' });
  }

  const cleanUserId = userId.trim();
  const exists = usersDatabase.some(u => u.userId.toUpperCase() === cleanUserId.toUpperCase());
  if (exists) {
    return res.status(400).json({ error: `User ID "${cleanUserId}" sudah terdaftar dalam sistem.` });
  }

  const newUser: UserAccount = {
    id: `USR-${cleanUserId}-${Date.now()}`,
    userId: cleanUserId,
    name: name.trim(),
    role: role || 'Petugas Yantek',
    password: password.trim(),
    unit: unit || 'ULP Baguala',
    email: email ? email.trim() : undefined,
    status: status || 'Aktif',
    createdAt: new Date().toISOString().split('T')[0]
  };

  usersDatabase.unshift(newUser);
  saveUsersData();

  res.status(201).json({ success: true, user: newUser, message: 'User baru berhasil ditambahkan.' });
});

app.put('/api/users/:id', (req, res) => {
  const { id } = req.params;
  const index = usersDatabase.findIndex(u => u.id === id || u.userId.toUpperCase() === id.toUpperCase());
  if (index === -1) {
    return res.status(404).json({ error: 'User tidak ditemukan' });
  }

  const updated = req.body;
  // If target is primary admin 9925045ZY, prevent deactivation
  if (usersDatabase[index].userId === '9925045ZY' && updated.status === 'Nonaktif') {
    return res.status(400).json({ error: 'User Administrator utama tidak dapat dinonaktifkan.' });
  }

  usersDatabase[index] = {
    ...usersDatabase[index],
    ...updated,
    id: usersDatabase[index].id,
    userId: updated.userId ? updated.userId.trim() : usersDatabase[index].userId
  };

  saveUsersData();
  res.json({ success: true, user: usersDatabase[index], message: 'Data user berhasil diperbarui.' });
});

app.delete('/api/users/:id', (req, res) => {
  const { id } = req.params;
  const target = usersDatabase.find(u => u.id === id || u.userId.toUpperCase() === id.toUpperCase());
  if (!target) {
    return res.status(404).json({ error: 'User tidak ditemukan' });
  }

  if (target.userId === '9925045ZY') {
    return res.status(400).json({ error: 'User Administrator utama (9925045ZY) tidak dapat dihapus demi keamanan sistem.' });
  }

  usersDatabase = usersDatabase.filter(u => u.id !== target.id);
  saveUsersData();
  res.json({ success: true, message: `User ${target.userId} (${target.name}) berhasil dihapus.` });
});

// AI Gemini Endpoints
app.post('/api/ai/analyze', async (req, res) => {
  try {
    const result = await analyzePoleDataWithGemini(polesDatabase);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Gagal menjalankan analisis AI' });
  }
});

app.post('/api/ai/chat', async (req, res) => {
  const { question } = req.body;
  if (!question) {
    return res.status(400).json({ error: 'Pertanyaan wajib diisi' });
  }

  try {
    const answer = await askGeminiAiAssistant(question, polesDatabase);
    res.json({ answer });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Gagal memproses pertanyaan AI' });
  }
});

// Vite Middleware Setup
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });
    app.use(vite.middlewares);

    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      try {
        let template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    app.use(express.static('dist'));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`⚡ PLN ULP Baguala GIS Server running at http://localhost:${PORT}`);
  });
}

startServer();
