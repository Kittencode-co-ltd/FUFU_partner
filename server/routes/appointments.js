import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireRole, resolveStoreId } from '../middleware/rbac.js';
const router=Router(); router.use(requireAuth);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const transitions={requested:['confirmed','reschedule_proposed','rejected','cancelled'],reschedule_proposed:['confirmed','rejected','cancelled'],confirmed:['checked_in','cancelled','no_show'],checked_in:['completed','cancelled']};
const actionRoles={confirmed:['owner','reception'],reschedule_proposed:['owner','reception'],rejected:['owner','reception'],checked_in:['owner','reception'],completed:['owner','vet'],cancelled:['owner','reception'],no_show:['owner','reception']};
const key=req=>String(req.get('Idempotency-Key')||req.body?.idempotency_key||'').trim();
const legacyStatus={Pending:'requested',Confirmed:'confirmed',Rejected:'rejected',Completed:'completed',Cancelled:'cancelled',NoShow:'no_show'};
const portalRow=row=>{
 const time=String(row.appt_time||row.appt_time_slot||'09:00');
 const normalizedTime=time.length===5?`${time}:00`:time;
 return {...row,status:legacyStatus[row.status]||row.status,starts_at:row.starts_at||`${row.appt_date||''}T${normalizedTime}`};
};

router.get('/',requireRole('owner','vet','reception'),async(req,res)=>{
 const {store_id,bucket='requested',search=''}=req.query;if(!UUID.test(store_id||''))return res.status(400).json({error:'valid store_id required'});
 const page=Math.max(parseInt(req.query.page,10)||1,1),limit=Math.min(Math.max(parseInt(req.query.limit,10)||20,1),100);
 let q=req.supabase.from('appointments').select('*',{count:'exact'}).eq('store_id',store_id);
 if(bucket==='requested')q=q.in('status',['requested','reschedule_proposed','Pending']);else if(bucket==='upcoming')q=q.in('status',['confirmed','checked_in','Confirmed']).gte('appt_date',new Date().toISOString().slice(0,10));else q=q.in('status',['completed','cancelled','no_show','rejected','Completed','Cancelled','NoShow','Rejected']);
 if(search.trim())q=q.ilike('pet_name',`%${search.trim().replaceAll('%','')}%`);
 const {data,error,count}=await q.order('appt_date',{ascending:bucket!=='history'}).order('appt_time_slot',{ascending:true}).range((page-1)*limit,page*limit-1);
 if(error)return res.status(500).json({error:error.message});res.json({success:true,data:(data||[]).map(portalRow),pagination:{page,limit,total:count||0}});
});
router.get('/calendar',requireRole('owner','vet','reception'),async(req,res)=>{
 const {store_id,from,to}=req.query;if(!UUID.test(store_id||'')||!from||!to)return res.status(400).json({error:'store_id, from and to required'});
 const fromDay=new Date(from).toISOString().slice(0,10),toDay=new Date(to).toISOString().slice(0,10);
 const {data,error}=await req.supabase.from('appointments').select('*').eq('store_id',store_id).gte('appt_date',fromDay).lt('appt_date',toDay).order('appt_date').order('appt_time_slot');
 if(error)return res.status(500).json({error:error.message});res.json({success:true,data:(data||[]).map(portalRow)});
});
router.post('/',async(req,res)=>{
 const idempotency=key(req);if(!idempotency)return res.status(400).json({error:'Idempotency-Key required'});
 const {store_id,service_id,pet_id,pet_name,starts_at,customer_notes}=req.body;if(![store_id,service_id,pet_id].every(v=>UUID.test(v||''))||!pet_name||!starts_at)return res.status(400).json({error:'invalid appointment payload'});
 const {data,error}=await req.supabase.rpc('create_appointment',{p_store_id:store_id,p_service_id:service_id,p_pet_id:pet_id,p_pet_name:pet_name,p_starts_at:starts_at,p_customer_notes:customer_notes||null,p_idempotency_key:idempotency});
 if(error?.code==='23505'||error?.code==='23514')return res.status(409).json({error:error.message});if(error)return res.status(500).json({error:error.message});res.status(201).json({success:true,data});
});
router.patch('/:id/transition',resolveStoreId('appointments'),requireRole('owner','vet','reception'),async(req,res)=>{
 const to=String(req.body.status||'').toLowerCase(),idempotency=key(req),role=req.staffRole;if(!idempotency)return res.status(400).json({error:'Idempotency-Key required'});if(!actionRoles[to]?.includes(role))return res.status(403).json({error:'Role cannot perform this action'});
 const {data:current,error:readErr}=await req.supabase.from('appointments').select('status').eq('id',req.params.id).single();if(readErr)return res.status(404).json({error:'Appointment not found'});const currentStatus=legacyStatus[current.status]||current.status;if(currentStatus===to)return res.json({success:true,data:{...current,status:currentStatus},idempotent:true});if(!transitions[currentStatus]?.includes(to))return res.status(409).json({error:'Invalid appointment transition'});if(to==='reschedule_proposed'&&!req.body.proposed_starts_at)return res.status(400).json({error:'proposed_starts_at required'});
 let {data,error}=await req.supabase.rpc('transition_appointment',{p_appointment_id:req.params.id,p_to_status:to,p_reason:req.body.reason||null,p_idempotency_key:idempotency,p_proposed_starts_at:req.body.proposed_starts_at||null});
 if(error?.code==='42883'||error?.code==='PGRST202'){
   if(to==='reschedule_proposed')return res.status(409).json({error:'คลินิกยังไม่ได้เปิดใช้การเสนอเวลาใหม่'});
   const statusValue=Object.prototype.hasOwnProperty.call(legacyStatus,current.status)
     ? ({confirmed:'Confirmed',rejected:'Rejected',cancelled:'Cancelled',no_show:'NoShow',completed:'Completed'}[to]||to)
     : to;
   const fallback=await req.supabase.from('appointments').update({status:statusValue,updated_at:new Date().toISOString()}).eq('id',req.params.id).eq('store_id',req.body.store_id).select('*').single();
   data=fallback.data;error=fallback.error;
 }
 if(error?.code==='23514'||error?.code==='23505')return res.status(409).json({error:error.message});if(error?.code==='42501')return res.status(403).json({error:error.message});if(error)return res.status(500).json({error:error.message});res.json({success:true,data:portalRow(data)});
});
router.get('/count',requireRole('owner','vet','reception'),async(req,res)=>{if(!UUID.test(req.query.store_id||''))return res.status(400).json({error:'valid store_id required'});const {count,error}=await req.supabase.from('appointments').select('*',{count:'exact',head:true}).eq('store_id',req.query.store_id).in('status',['requested','reschedule_proposed']);if(error)return res.status(500).json({error:error.message});res.json({success:true,count:count||0});});
export default router;
