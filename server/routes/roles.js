import { Router }      from 'express';
import { requireAuth } from '../middleware/auth.js';
import { ASSIGNABLE_ROLES } from '../config/roles.js';

const router = Router();
router.use(requireAuth);

// Roles are FIXED system-wide — stores cannot create/edit/delete them.

// GET /api/roles  → list of fixed, assignable roles (for staff role selector)
router.get('/', (req, res) => {
  res.json({
    success: true,
    data: ASSIGNABLE_ROLES.map(r => ({
      id:          r.key,   // role key doubles as the id
      key:         r.key,
      name:        r.label,
      color:       r.color,
      icon:        r.icon,
      desc:        r.desc,
      permissions: r.permissions,
      modes:       r.modes,
    })),
  });
});

// Mutations are disabled — roles are fixed.
const FIXED = (req, res) =>
  res.status(403).json({ error: 'Roles are fixed and cannot be modified' });

router.post('/',        FIXED);
router.patch('/:id',    FIXED);
router.delete('/:id',   FIXED);

export default router;
