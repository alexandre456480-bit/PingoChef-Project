// Read-only inventory. Emits aggregate counts; never logs identities or credentials.
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { resolve } from 'node:path';

dotenv.config({path:resolve(import.meta.dirname,'../.env'),quiet:true});
if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)throw new Error('Supabase audit configuration unavailable');
const client=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{autoRefreshToken:false,persistSession:false}});
const users=[];
for(let page=1;page<=100;page++){
  const {data,error}=await client.auth.admin.listUsers({page,perPage:1000});
  if(error)throw new Error('AUTH_INVENTORY_UNAVAILABLE');
  users.push(...data.users);if(data.users.length<1000)break;
  if(page===100)throw new Error('INVENTORY_TOO_LARGE');
}
const unavailable=[];
async function rows(table,columns){
  const items=[];
  for(let offset=0;offset<100000;offset+=1000){
    const {data,error}=await client.from(table).select(columns).order('id').range(offset,offset+999);
    if(error){unavailable.push({table,code:/^[A-Z0-9]{2,12}$/.test(error.code||'')?error.code:'UNAVAILABLE'});return [];}
    items.push(...data);if(data.length<1000)return items;
  }
  throw new Error('INVENTORY_TOO_LARGE');
}
const [businesses,subscriptions,categories,items,subcategories,plans,media]=await Promise.all([
  rows('businesses','id,owner_user_id,status'),rows('subscriptions','business_id,plan_id,provider,status'),
  rows('categories','id,business_id'),rows('menu_items','id,business_id,category_id,subcategory_id'),
  rows('subcategories','id,business_id,category_id'),rows('plans','id,code'),rows('product_media','id,business_id,menu_item_id,media_type,status')]);
const ownerCounts=new Map(),productCounts=new Map(),categoryCounts=new Map();
const authById=new Map(users.map(user=>[user.id,user]));
for(const business of businesses)ownerCounts.set(business.owner_user_id,(ownerCounts.get(business.owner_user_id)||0)+1);
for(const item of items)productCounts.set(item.business_id,(productCounts.get(item.business_id)||0)+1);
for(const category of categories)categoryCounts.set(category.business_id,(categoryCounts.get(category.business_id)||0)+1);
const categoryById=new Map(categories.map(row=>[row.id,row]));
const subcategoryById=new Map(subcategories.map(row=>[row.id,row]));
console.log(JSON.stringify({auditedAt:new Date().toISOString(),readOnly:true,
  authUsers:users.length,confirmedUsers:users.filter(user=>user.email_confirmed_at).length,
  businessCount:businesses.length,businessStatusCounts:businesses.reduce((out,row)=>({...out,[row.status]:(out[row.status]||0)+1}),{}),
  duplicateOwners:[...ownerCounts.values()].filter(count=>count>1).length,
  ownersWithoutAuthIdentity:businesses.filter(row=>!authById.has(row.owner_user_id)).length,
  businessOwnersWithUnconfirmedEmail:businesses.filter(row=>authById.has(row.owner_user_id)&&!authById.get(row.owner_user_id).email_confirmed_at).length,
  businessesWithoutSubscription:businesses.filter(row=>!subscriptions.some(sub=>sub.business_id===row.id)).length,
  legacySubscriptionsWithoutPlan:subscriptions.filter(row=>!row.plan_id&&!row.provider).length,
  subscriptionPlanDistribution:subscriptions.reduce((out,row)=>{const code=plans.find(plan=>plan.id===row.plan_id)?.code||'NO_PLAN';return {...out,[code]:(out[code]||0)+1};},{}),
  totalProducts:items.length,totalCategories:categories.length,
  occupiedVideoSlots:new Set(media.filter(row=>row.media_type==='video'&&['waiting','uploading','processing','ready'].includes(row.status)).map(row=>row.business_id+':'+row.menu_item_id)).size,
  providerSubscriptionsWithoutPlan:subscriptions.filter(row=>row.provider&&!row.plan_id).length,
  businessesAboveFreeProducts:[...productCounts.values()].filter(count=>count>10).length,
  businessesAboveFreeCategories:[...categoryCounts.values()].filter(count=>count>4).length,
  crossTenantRelationships:items.filter(row=>categoryById.get(row.category_id)?.business_id!==row.business_id
    ||(row.subcategory_id&&(subcategoryById.get(row.subcategory_id)?.business_id!==row.business_id||subcategoryById.get(row.subcategory_id)?.category_id!==row.category_id))).length
    +subcategories.filter(row=>categoryById.get(row.category_id)?.business_id!==row.business_id).length,
  unavailableTables:unavailable},null,2));
