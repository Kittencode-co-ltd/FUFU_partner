import express from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// ===== CONFIG SUPABASE =====
const supabaseUrl = process.env.Project_URL;
const supabaseAnonKey = process.env.publishable_key;

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.')); // Serve static frontend files (index.html, etc.)

// ===================================================
// AUTH MIDDLEWARE (ใช้แทน requireAuth ใน PHP)
// ===================================================
const requireAuth = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

    const token = authHeader.split(' ')[1];
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) return res.status(401).json({ error: 'Invalid token' });
    
    req.user = user; // ส่งข้อมูล user ไปใช้ต่อใน route
    next();
};

// ===================================================
// ROUTERS / ENDPOINTS
// ===================================================

// 1. AUTH LOGIN
app.post('/api/auth', async (req, res) => {
    const { email, password, action } = req.body;

    if (action === 'login') {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        
        if (error) return res.status(401).json({ success: false, error: error.message });

        // Add Role validation here
        const { data: isStaff, error: rpcError } = await supabase.rpc('is_fufu_staff', { user_id: data.user.id });
        
        if (rpcError) {
             return res.status(500).json({ success: false, error: 'เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์: ' + rpcError.message });
        }
        
        if (!isStaff) {
             return res.status(403).json({ success: false, error: 'คุณไม่มีสิทธิ์เข้าถึงระบบหลังบ้าน' });
        }

        // Get stores owned by user
        const { data: stores } = await supabase
            .from('stores')
            .select('*')
            .eq('owner_email', data.user.email);

        res.json({
            success: true,
            token: data.session.access_token,
            refresh_token: data.session.refresh_token,
            user: data.user,
            stores: stores || []
        });
    }
});

// 1.5 AUTH REGISTER (Backend proxy for hiding keys from Frontend)
app.post('/api/register', async (req, res) => {
    const { email, password, name, phone, type, partnerType } = req.body;

    try {
        // 1. SignUp into Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
        
        if (authError) {
            return res.status(400).json({ success: false, error: authError.message });
        }
        
        if (!authData.user) {
            return res.status(400).json({ success: false, error: 'User registration failed or email already exists' });
        }

        const userId = authData.user.id;

        // 2. Insert into respective tables
        if (type === 'user') {
            const { error: profileError } = await supabase
                .from('profiles')
                .insert([{ id: userId, name, email, phone }]);
                
            if (profileError) console.error('Profile Insert Error:', profileError);
            
        } else if (type === 'partner') {
            const { error: partnerError } = await supabase
                .from('partners')
                .insert([{ user_id: userId, name, email, phone, type: partnerType }]);
                
            if (partnerError) console.error('Partner Insert Error:', partnerError);
        }

        res.json({ success: true, user: authData.user });
    } catch (err) {
        console.error('Registration Error:', err);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

// 2. PARTNERS
app.get('/api/partners/:id?', requireAuth, async (req, res) => {
    const { id } = req.params;
    let query = supabase.from('partners').select('*, vet_profiles(*), products(*)');

    if (id) {
        const { data, error } = await query.eq('id', id).single();
        return res.json(data);
    }

    const { data } = await query.order('rating', { ascending: false });
    res.json(data);
});

// 3. APPOINTMENTS (ตัวอย่าง GET & POST)
app.get('/api/appointments', requireAuth, async (req, res) => {
    const { store_id, status, date } = req.query;
    let query = supabase
        .from('appointments')
        .select('*, pets(name, species, avatar_url), profiles(name, phone)');

    if (store_id) query = query.eq('store_id', store_id);
    if (status) query = query.eq('status', status);
    
    const { data } = await query.order('appt_date', { ascending: true });
    res.json(data);
});

// 4. TRANSACTIONS (พร้อมคำนวณ GP 5% อัตโนมัติ)
app.post('/api/transactions', requireAuth, async (req, res) => {
    const { user_id, store_id, amount, type } = req.body;
    
    const commission = Math.round(amount * 0.05 * 100) / 100;
    const net_amount = amount - commission;

    const { data, error } = await supabase
        .from('transactions')
        .insert([{ user_id, store_id, amount, commission, net_amount, type }])
        .select();

    if (error) return res.status(400).json({ error: error.message });
    res.json({ success: true, data });
});

// 5. DASHBOARD STATS
app.get('/api/dashboard', requireAuth, async (req, res) => {
    const { store_id } = req.query;
    const today = new Date().toISOString().split('T')[0];

    // ดึงข้อมูลหลายอย่างพร้อมกัน (Parallel)
    const [apptRes, transRes] = await Promise.all([
        supabase.from('appointments').select('id, status').eq('store_id', store_id).gte('appt_date', today),
        supabase.from('transactions').select('amount, net_amount').eq('store_id', store_id).gte('created_at', today)
    ]);

    const appointments = apptRes.data || [];
    const transactions = transRes.data || [];

    res.json({
        today: {
            revenue: transactions.reduce((sum, t) => sum + t.amount, 0),
            net: transactions.reduce((sum, t) => sum + t.net_amount, 0),
            appointments: appointments.length,
            pending_queue: appointments.filter(a => a.status === 'pending').length
        }
    });
});

// 6. MY STORES
app.get('/api/my-stores', requireAuth, async (req, res) => {
    const { data: stores, error } = await supabase
        .from('stores')
        .select('*')
        .eq('owner_email', req.user.email);

    if (error) return res.status(400).json({ error: error.message });
    res.json(stores);
});

// Start Server
app.listen(port, () => {
    console.log(`🚀 Server running on http://localhost:${port}`);
});