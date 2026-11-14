import express from 'express';
import next from 'next';
import dotenv  from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join }  from 'path';
import { createApiApp } from './app.js';
import { sanitizedErrorHandler } from './middleware/request-context.js';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const nextApp = next({ dev: process.argv.includes('dev'), dir: join(__dirname, '..') });
const handleNext = nextApp.getRequestHandler();

// API routes + shared middleware (security headers, CORS, JSON, rate limits)
const app = createApiApp({ withFallback: false });

app.get('/index.html', (req, res) => res.redirect(301, '/'));
app.get('/login.html', (req, res) => res.redirect(302, '/login'));
app.get('/register.html', (req, res) => res.redirect(302, '/register'));
app.get('/onboarding.html', (req, res) => res.redirect(302, '/onboarding'));
app.get('/dashboard.html', (req, res) => res.redirect(302, '/dashboard'));
app.get('/receipt.html', (req, res) => res.redirect(302, `/receipt${req.url.slice('/receipt.html'.length)}`));
app.use(express.static(join(__dirname, '../public'), { index: false }));
app.use((req, res, nextMiddleware) => {
  if (req.path === '/' || req.path === '/_next' || req.path.startsWith('/_next/')) return handleNext(req, res);
  nextMiddleware();
});

app.use('/api', (req, res) => res.status(404).json({
  success: false,
  error: 'API endpoint not found',
  code: 'NOT_FOUND',
  request_id: req.requestId,
}));

app.use(sanitizedErrorHandler);

// Next.js owns every application page; Express static serving above is for assets.
app.get('*', (req, res) => handleNext(req, res));

await nextApp.prepare();

app.listen(PORT, () => {
  console.log(`FUFU Partner running → http://localhost:${PORT}`);
});
