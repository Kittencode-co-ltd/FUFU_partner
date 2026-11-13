/**
 * FUFU Partner API as a reusable Express app.
 *
 * - Local dev / self-hosting: server/index.js mounts this app and adds static files + Next.js.
 * - Vercel: pages/api/[...path].js forwards every /api/* request to this app.
 */
import express from 'express';
import cors    from 'cors';
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
import rolesRoutes         from './routes/roles.js';
import serviceItemsRoutes  from './routes/service-items.js';
import expensesRoutes       from './routes/expenses.js';
import soapTemplatesRoutes  from './routes/soap-templates.js';
import rewardsRoutes        from './routes/rewards.js';
import clinicRoutes         from './routes/clinic.js';
import publicClinicRoutes   from './routes/public-clinics.js';
import visitsRoutes         from './routes/visits.js';
import screeningsRoutes     from './routes/screenings.js';
import cashierRoutes        from './routes/cashier.js';
import { requestContext, sanitizedErrorHandler } from './middleware/request-context.js';
import { corsOptions, mutationRateLimit, securityHeaders } from './middleware/security.js';
import { validateEnvironment } from './config/env.js';
import { guardInactiveStoreMutations } from './middleware/rbac.js';

export function createApiApp({ withFallback = true } = {}) {
  validateEnvironment();
  const app = express();
  app.disable('x-powered-by');

  app.use(requestContext);
  app.use(securityHeaders);
  app.use(cors(corsOptions()));
  app.use(express.json({ limit: '100kb' }));
  app.use('/api', (req, res, next) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return mutationRateLimit(req, res, next);
    next();
  });

  app.use('/api/auth',            authRoutes);
  app.use('/api/public/clinics',  publicClinicRoutes);
  app.use('/api', guardInactiveStoreMutations);
  app.use('/api/clinic',          clinicRoutes);
  app.use('/api/queue',           queueRoutes);
  app.use('/api/medical-records', medicalRoutes);
  app.use('/api/finance',         financeRoutes);
  app.use('/api/stores',          storesRoutes);
  app.use('/api/inventory',       inventoryRoutes);
  app.use('/api/pets',            petsRoutes);
  app.use('/api/pos',             posRoutes);
  app.use('/api/cashier',         cashierRoutes);
  app.use('/api/hotel',           hotelRoutes);
  app.use('/api/grooming',        groomingRoutes);
  app.use('/api/staff',           staffRoutes);
  app.use('/api/audit',           auditRoutes);
  app.use('/api/ipd',             ipdRoutes);
  app.use('/api/documents',       documentsRoutes);
  app.use('/api/tasks',           tasksRoutes);
  app.use('/api/appointments',    appointmentsRoutes);
  app.use('/api/visits',          visitsRoutes);
  app.use('/api/screenings',      screeningsRoutes);
  app.use('/api/roles',           rolesRoutes);
  app.use('/api/service-items',   serviceItemsRoutes);
  app.use('/api/expenses',        expensesRoutes);
  app.use('/api/soap-templates',  soapTemplatesRoutes);
  app.use('/api/rewards',         rewardsRoutes);

  if (withFallback) {
    app.use('/api', (req, res) => res.status(404).json({
      success: false,
      error: 'API endpoint not found',
      code: 'NOT_FOUND',
      path: req.path,
      method: req.method,
      request_id: req.requestId,
    }));
    app.use(sanitizedErrorHandler);
  }

  return app;
}
