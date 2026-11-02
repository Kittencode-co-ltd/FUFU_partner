import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole, resolveStoreId } from '../middleware/rbac.js';
const router=Router();router.use(requireAuth);

router.get('/:id/context',resolveStoreId('appointments'),requireRole('owner','vet','reception'),async(req,res)=>{
 const {data:a,error}=await req.supabase.from('appointments').select('*').eq('id',req.params.id).single();if(error||!a)return res.status(404).json({error:'Appointment not found'});
 const {data:c}=await req.supabase.from('appointment_data_consents').select('*').eq('appointment_id',a.id).maybeSingle();
 const consent=c&& !c.revoked_at?c:{};const out={appointment:a,consent,notice:'ผล AI เป็นผลคัดกรองเบื้องต้น ไม่ใช่การวินิจฉัย คลินิกต้องประเมินเอง'};
 if(consent.allow_pet_profile){const {data}=await req.supabase.from('pets').select('*').eq('id',a.pet_id).maybeSingle();out.pet=data;}
 if(consent.allow_health_records){const {data}=await req.supabase.from('health_records').select('*').eq('pet_id',a.pet_id).order('date',{ascending:false});out.health_records=data||[];}
 if(consent.allow_vaccinations){const {data}=await req.supabase.from('vaccinations').select('*').eq('pet_id',a.pet_id).order('date_administered',{ascending:false});out.vaccinations=data||[];}
 if(consent.allow_scan_images){const {data}=await req.supabase.from('scan_results').select('id,body_part,result,confidence,status,image_url,created_at').eq('pet_id',a.pet_id);out.preliminary_screenings=data||[];}
 await req.supabase.rpc('log_health_access',{p_appointment_id:a.id,p_entity:'appointment_context'});res.json({success:true,data:out});
});
router.get('/summaries/list',requireRole('owner','vet','reception'),async(req,res)=>{const {data,error}=await req.supabase.from('visit_summaries').select('*').eq('store_id',req.query.store_id).order('updated_at',{ascending:false});if(error)return res.status(500).json({error:error.message});res.json({success:true,data:data||[]});});
router.put('/:id/summary',resolveStoreId('appointments'),requireRole('owner','vet'),async(req,res)=>{
 const {data:a}=await req.supabase.from('appointments').select('id,store_id,pet_id').eq('id',req.params.id).single();if(!a?.pet_id)return res.status(404).json({error:'Appointment not found'});
 const body={appointment_id:a.id,store_id:a.store_id,pet_id:a.pet_id,vet_user_id:req.user.id,findings:req.body.findings||null,actions_taken:req.body.actions_taken||null,care_instructions:req.body.care_instructions||null,warning_signs:req.body.warning_signs||null,follow_up_at:req.body.follow_up_at||null};
 const {data,error}=await req.supabase.from('visit_summaries').upsert(body,{onConflict:'appointment_id'}).select().single();if(error)return res.status(500).json({error:error.message});res.json({success:true,data});
});
router.post('/summaries/:summaryId/finalize',async(req,res,next)=>{req.params.id=req.params.summaryId;const {data:s}=await req.supabase.from('visit_summaries').select('store_id').eq('id',req.params.summaryId).single();if(s){req.body=req.body||{};req.body.store_id=s.store_id;req.query.store_id=s.store_id;}next();},requireRole('vet','owner'),async(req,res)=>{
 const k=String(req.get('Idempotency-Key')||'').trim();if(!k)return res.status(400).json({error:'Idempotency-Key required'});
 const {data,error}=await req.supabase.rpc('finalize_visit_summary',{p_summary_id:req.params.summaryId,p_idempotency_key:k,p_vaccinations:req.body.vaccinations||[]});if(error?.code==='23514')return res.status(409).json({error:error.message});if(error)return res.status(error.code==='42501'?403:500).json({error:error.message});res.json({success:true,data});
});
export default router;
