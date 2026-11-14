import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole, resolveStoreId } from '../middleware/rbac.js';

const router = Router();
router.use(requireAuth);

router.get('/', requireRole('owner','reception','vet','staff'), async (req,res) => {
  const storeId = req.query.store_id;
  const [{data:reviews,error}, {data:store}] = await Promise.all([
    req.supabase.from('store_reviews').select('id,store_id,rating,comment,status,partner_reply,partner_replied_at,created_at,updated_at').eq('store_id',storeId).order('created_at',{ascending:false}).limit(200),
    req.supabase.from('stores').select('review_average,review_count').eq('id',storeId).single(),
  ]);
  if(error) return res.status(500).json({success:false,error:'โหลดรีวิวไม่สำเร็จ'});
  res.json({success:true,data:reviews||[],summary:store||{review_average:0,review_count:0}});
});

router.patch('/:id/reply', resolveStoreId('store_reviews'), requireRole('owner','reception','vet','staff'), async (req,res) => {
  const reply = typeof req.body?.reply==='string' ? req.body.reply.trim() : '';
  if(reply.length>1200) return res.status(400).json({success:false,error:'คำตอบต้องไม่เกิน 1,200 ตัวอักษร'});
  const {data,error}=await req.supabase.from('store_reviews').update({partner_reply:reply||null}).eq('id',req.params.id).select('id,store_id,partner_reply,partner_replied_at').single();
  if(error) return res.status(400).json({success:false,error:'บันทึกคำตอบไม่สำเร็จ'});
  const {error:logError}=await req.supabase.from('store_review_audit_logs').insert({store_id:data.store_id,review_id:data.id,actor_user_id:req.user.id,action:'partner_reply'});
  if(logError) return res.status(500).json({success:false,error:'บันทึกคำตอบแล้ว แต่เขียนประวัติการตอบกลับไม่สำเร็จ'});
  res.json({success:true,data});
});

export default router;
