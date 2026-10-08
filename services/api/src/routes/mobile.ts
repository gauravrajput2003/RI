import { Router, type Router as RouterType, type Response, type NextFunction } from 'express';
import { randomBytes, createHash } from 'node:crypto';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { PERMISSIONS as P, hasEffectivePermission, type PermissionKey } from '@fleet/shared-types';
import { type AuthRequest, authorize } from '../middleware/auth.js';
import { effectivePermissions } from '../modules/authorization/permissions.js';
import { findVehicle, latestLocation } from '../modules/vehicles/repository.js';
import { spendableSql } from '../modules/coins/management.js';
import { sealPassword } from '../modules/auth/password-recovery.js';
import { query, transaction } from '../db/pool.js';
import { AppError } from '../lib/errors.js';
import { authRateLimit } from '../middleware/rate-limits.js';
import {vehicleDetailsBody,updateVehicleDetails} from '../modules/vehicles/edit-details.js';

const route = (fn: (req: AuthRequest, res: Response) => Promise<unknown>) =>
  (req: AuthRequest, res: Response, next: NextFunction) => { void fn(req, res).catch(next); };
// This router has its own explicit guards, before the web permission router.
// Express guards must call next on success.
const permission = (key: PermissionKey) => (req: AuthRequest, res: Response, next: NextFunction) => {
  void (async () => {
    if (req.user!.role === 'ADMIN' && !hasEffectivePermission(await effectivePermissions(req.user!.id, req.user!.role), key)) throw new AppError(403, 'FORBIDDEN', 'Access Denied');
    next();
  })().catch(next);
};
const vehicleId = (req: AuthRequest) => z.string().uuid().parse(req.params.id);
async function visible(req: AuthRequest) {
  const id = vehicleId(req);
  if (!(await findVehicle(id, req.user!.id)).rows[0]) throw new AppError(404, 'VEHICLE_NOT_FOUND', 'Vehicle not found');
  return id;
}
export const mobileApi: RouterType = Router();
mobileApi.use(authorize('ADMIN', 'CLIENT', 'SUPER_ADMIN'));
mobileApi.get('/support-contact', route(async (req, res) => {
  // Resolve only the authenticated account's direct parent, never a caller-supplied ID.
  const contact=(await query(`SELECT COALESCE(NULLIF(p.company,''),NULLIF(p.name,''),NULLIF(p.username,''),'Support Team') AS name,
    p.mobile AS phone,p.email,p.avatar_url AS "logoUrl"
    FROM users u JOIN users p ON p.id=u.owner_id AND p.role IN ('ADMIN','SUPER_ADMIN')
    WHERE u.id=$1 AND u.active=true`,[req.user!.id])).rows[0]??null;
  res.setHeader('Cache-Control','no-store');
  res.json({success:true,data:contact});
}));
mobileApi.get('/session', route(async (req, res) => {
  const user = (await query(`SELECT id,name,username,email,mobile,avatar_url AS "avatarUrl",role,
    CASE WHEN role='SUPER_ADMIN' THEN NULL ELSE ${spendableSql('users')} END AS coins FROM users WHERE id=$1 AND active=true`, [req.user!.id])).rows[0];
  res.setHeader('Cache-Control', 'no-store');
  res.json({ success: true, data: { ...user, permissions: await effectivePermissions(req.user!.id, req.user!.role) } });
}));
mobileApi.get('/vehicles/:id', permission(P.vehicleView), route(async (req, res) => {
  const id = await visible(req);
  const row = (await query(`SELECT id,vehicle_number,alias,remark,vehicle_type,mileage,odometer,overspeed_limit,gps_location,billing_start,billing_due FROM vehicles WHERE id=$1`, [id])).rows[0];
  res.json({ success: true, data: row });
}));
mobileApi.patch('/vehicles/:id', permission(P.vehicleEdit), route(async (req, res) => {
  const id = vehicleId(req);
  res.json({ success: true, data: await updateVehicleDetails(req.user!.id,id,vehicleDetailsBody.parse(req.body)) });
}));
mobileApi.get('/vehicles/:id/notifications', permission(P.notificationsView), route(async (req, res) => {
  const id = await visible(req);
  const muted = (await query<{ muted: boolean }>('SELECT muted FROM mobile_vehicle_notification_preferences WHERE user_id=$1 AND vehicle_id=$2', [req.user!.id, id])).rows[0]?.muted ?? false;
  const items = muted ? [] : (await query('SELECT id,event_type,message,occurred_at FROM notification_history WHERE vehicle_id=$1 ORDER BY occurred_at DESC LIMIT 100', [id])).rows;
  res.json({ success: true, data: { muted, items } });
}));
mobileApi.patch('/vehicles/:id/notifications', permission(P.notificationsView), route(async (req, res) => {
  const id = await visible(req), { muted } = z.object({ muted: z.boolean() }).strict().parse(req.body);
  await query(`INSERT INTO mobile_vehicle_notification_preferences(user_id,vehicle_id,muted) VALUES($1,$2,$3)
    ON CONFLICT(user_id,vehicle_id) DO UPDATE SET muted=EXCLUDED.muted,updated_at=now()`, [req.user!.id, id, muted]);
  res.json({ success: true, data: { muted } });
}));
mobileApi.post('/vehicles/:id/shares', permission(P.vehicleView), route(async (req, res) => {
  const id = await visible(req);
  const { minutes } = z.object({ minutes: z.union([z.literal(5), z.literal(30), z.literal(60), z.literal(720), z.literal(1440), z.literal(10080), z.literal(43200)]) }).strict().parse(req.body);
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + minutes * 60_000);
  await query('INSERT INTO vehicle_share_sessions(token_hash,vehicle_id,created_by,expires_at) VALUES($1,$2,$3,$4)', [createHash('sha256').update(token).digest('hex'), id, req.user!.id, expiresAt]);
  res.status(201).json({ success: true, data: { token, expiresAt } });
}));
mobileApi.post('/change-password', authRateLimit, route(async (req, res) => {
  const body = z.object({ currentPassword: z.string().min(1).max(128), newPassword: z.string().max(128), confirmPassword: z.string().max(128) }).strict().parse(req.body);
  if (body.newPassword.length < 8) throw new AppError(400, 'PASSWORD_POLICY', 'Use at least 8 characters.');
  if (body.newPassword !== body.confirmPassword) throw new AppError(400, 'PASSWORD_MISMATCH', 'New passwords do not match.');
  await transaction(async client => {
    const user = (await client.query<{ password_hash: string }>('SELECT password_hash FROM users WHERE id=$1 AND active=true FOR UPDATE', [req.user!.id])).rows[0];
    if (!user || !await bcrypt.compare(body.currentPassword, user.password_hash)) throw new AppError(400, 'CURRENT_PASSWORD_INCORRECT', 'Current password is incorrect.');
    await client.query('UPDATE users SET password_hash=$2,password_recovery_ciphertext=$3,updated_at=now() WHERE id=$1', [req.user!.id, await bcrypt.hash(body.newPassword, 12), sealPassword(body.newPassword)]);
    await client.query('UPDATE refresh_tokens SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL', [req.user!.id]);
  });
  res.json({ success: true, data: { changed: true } });
}));
mobileApi.post('/logout-all', route(async (req, res) => {
  await query('UPDATE refresh_tokens SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL', [req.user!.id]);
  res.status(204).end();
}));

// Public share reads are mounted before authentication and expose only one vehicle's latest fix.
export const shareApi: RouterType = Router();
shareApi.get('/viewer.js', (_req,res) => {
  res.type('application/javascript').send(`
    async function update(){
      const status=document.getElementById('status'),map=document.getElementById('map');
      try{const r=await fetch(location.pathname,{headers:{Accept:'application/json'}}),j=await r.json();
        if(!r.ok)throw new Error(j.error?.message||'Sharing unavailable.');
        const d=j.data,l=d.location;document.getElementById('vehicle').textContent=d.vehicleNumber;
        document.getElementById('expiry').textContent='Shared until '+new Date(d.expiresAt).toLocaleString();
        if(l&&Number.isFinite(l.latitude)&&Number.isFinite(l.longitude)){
          status.textContent='Latitude: '+l.latitude+' · Longitude: '+l.longitude+' · Speed: '+(l.speed??'Unavailable')+' km/h · Last sync: '+new Date(l.lastSync).toLocaleString();
          map.href='https://www.openstreetmap.org/?mlat='+l.latitude+'&mlon='+l.longitude+'#map=16/'+l.latitude+'/'+l.longitude;map.hidden=false;
        }else{status.textContent='Location unavailable. Waiting for a GPS update.';map.hidden=true;}
      }catch(e){status.textContent=e.message;map.hidden=true;}
    } update();setInterval(update,15000);
  `);
});
shareApi.get('/:token', async (req, res, next) => {
  try {
    const token = z.string().regex(/^[A-Za-z0-9_-]{43}$/).parse(req.params.token);
    const share = (await query<{ vehicle_id: string; created_by: string; expires_at: Date }>(`SELECT s.vehicle_id,s.created_by,s.expires_at FROM vehicle_share_sessions s JOIN users u ON u.id=s.created_by WHERE token_hash=$1 AND expires_at>now() AND u.active=true`, [createHash('sha256').update(token).digest('hex')])).rows[0];
    if (!share) throw new AppError(404, 'SHARE_EXPIRED', 'This sharing session has expired or is unavailable.');
    // Recheck scope and grants: a transfer or permission revocation immediately ends access.
    const actor = (await query<{ role: 'ADMIN' | 'CLIENT' | 'SUPER_ADMIN' }>('SELECT role FROM users WHERE id=$1', [share.created_by])).rows[0];
    if (!actor || (actor.role === 'ADMIN' && !hasEffectivePermission(await effectivePermissions(share.created_by, actor.role), P.vehicleView))) throw new AppError(404, 'SHARE_EXPIRED', 'Sharing session unavailable.');
    const vehicle = (await findVehicle(share.vehicle_id, share.created_by)).rows[0] as Record<string,unknown>|undefined;
    if (!vehicle) throw new AppError(404, 'SHARE_EXPIRED', 'Sharing session unavailable.');
    const location = (await latestLocation(share.vehicle_id, share.created_by)).rows[0] as Record<string,unknown>|undefined;
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    if(req.header('accept')?.includes('text/html')) {
      res.type('html').send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Shared Vehicle Tracking</title><style>body{font:16px system-ui;background:#f5f6f8;margin:0;padding:24px}main{max-width:560px;margin:40px auto;background:white;padding:24px;border-radius:14px}h1{color:#ee0509}p{line-height:1.6;color:#444}a{color:#087b9c}</style></head><body><main><h1 id="vehicle">Shared Vehicle Tracking</h1><p id="expiry"></p><p id="status">Loading live location…</p><a id="map" hidden rel="noreferrer" target="_blank">Open location on map</a><p>Updates every 15 seconds. Access ends when this sharing session expires.</p></main><script src="/api/v1/shared-vehicles/viewer.js" defer></script></body></html>`);
      return;
    }
    res.json({ success: true, data: { vehicleNumber: vehicle.vehicle_number, expiresAt: share.expires_at, location: location ? { latitude: location.latitude, longitude: location.longitude, speed: location.speed, lastSync: location.server_received_at } : null } });
  } catch (error) { next(error); }
});
