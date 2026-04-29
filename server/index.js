import express from 'express';
import cors    from 'cors';
import dotenv  from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join }  from 'path';
import authRoutes    from './routes/auth.js';
import queueRoutes   from './routes/queue.js';
import medicalRoutes from './routes/medical.js';
import financeRoutes from './routes/finance.js';
import storesRoutes    from './routes/stores.js';
import inventoryRoutes from './routes/inventory.js';
import petsRoutes      from './routes/pets.js';
import posRoutes       from './routes/pos.js';
import hotelRoutes     from './routes/hotel.js';
import groomingRoutes  from './routes/grooming.js';
import staffRoutes     from './routes/staff.js';
import auditRoutes     from './routes/audit.js';
import ipdRoutes       from './routes/ipd.js';
import documentsRoutes from './routes/documents.js';
import tasksRoutes        from './routes/tasks.js';
import appointmentsRoutes from './routes/appointments.js';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, '../public')));

// API routes
app.use('/api/auth',            authRoutes);
app.use('/api/queue',           queueRoutes);
app.use('/api/medical-records', medicalRoutes);
app.use('/api/finance',         financeRoutes);
app.use('/api/stores',          storesRoutes);
app.use('/api/inventory',       inventoryRoutes);
app.use('/api/pets',            petsRoutes);
app.use('/api/pos',             posRoutes);
app.use('/api/hotel',           hotelRoutes);
app.use('/api/grooming',        groomingRoutes);
app.use('/api/staff',           staffRoutes);
app.use('/api/audit',           auditRoutes);
app.use('/api/ipd',             ipdRoutes);
app.use('/api/documents',       documentsRoutes);
app.use('/api/tasks',           tasksRoutes);
app.use('/api/appointments',    appointmentsRoutes);

// SPA fallback — serve login for unknown routes
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, '../public/login.html'));
});

app.listen(PORT, () => {
  console.log(`FUFU Partner running → http://localhost:${PORT}`);
});
