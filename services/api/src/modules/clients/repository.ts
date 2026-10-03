import bcrypt from 'bcrypt';
import {sealPassword} from '../auth/password-recovery.js';
import { query } from '../../db/pool.js';
import { AppError } from '../../lib/errors.js';
import { userScopeCte } from '../authorization/scope.js';

const withoutTotal = (row: Record<string, unknown>) => {
  const copy = { ...row };
  delete copy.total_count;
  return copy;
};

const clientProjection = `u.id,u.owner_id,u.username,u.name,u.mobile,u.email,u.company,u.website,u.address,
  u.active,u.inactive_timeout_seconds,u.created_at,u.updated_at,
  owner.name AS owner_name,owner.email AS owner_email,owner.username AS owner_username,
  count(DISTINCT v.id)::int AS vehicle_count`;

export interface ClientCreateInput {
  ownerId: string;
  username: string;
  password: string;
  name?: string;
  mobile?: string;
  email: string;
  company?: string;
  website?: string;
  address?: string;
  inactiveTimeoutSeconds: number;
  active: boolean;
}

export interface ClientUpdateInput {
  username?: string;
  name?: string | null;
  mobile?: string | null;
  email?: string;
  company?: string | null;
  website?: string | null;
  address?: string | null;
  inactiveTimeoutSeconds?: number;
  active?: boolean;
}

export async function listClients(actorId: string, search: string, page: number, pageSize: number, active?: boolean) {
  const result = await query(`${userScopeCte}
    SELECT ${clientProjection},count(*) OVER()::int AS total_count
    FROM users u JOIN user_scope scope ON scope.id=u.id
    JOIN users owner ON owner.id=u.owner_id
    LEFT JOIN vehicles v ON v.owner_id=u.id
    WHERE u.role='CLIENT' AND ($2='%%' OR COALESCE(u.username,'') ILIKE $2 OR COALESCE(u.name,'') ILIKE $2
      OR u.email ILIKE $2 OR COALESCE(u.mobile,'') ILIKE $2 OR COALESCE(u.company,'') ILIKE $2)
      AND ($5::boolean IS NULL OR u.active=$5)
    GROUP BY u.id,owner.id ORDER BY u.created_at DESC,u.id LIMIT $3 OFFSET $4`,
  [actorId, `%${search}%`, pageSize, (page - 1) * pageSize, active ?? null]);
  return { rows: result.rows.map(withoutTotal), total: Number(result.rows[0]?.total_count ?? 0) };
}

export const findClient = (actorId: string, id: string) => query(`${userScopeCte}
  SELECT ${clientProjection}
  FROM users u JOIN user_scope scope ON scope.id=u.id
  JOIN users owner ON owner.id=u.owner_id LEFT JOIN vehicles v ON v.owner_id=u.id
  WHERE u.id=$2 AND u.role='CLIENT' GROUP BY u.id,owner.id`, [actorId, id]);

export const clientOwnerOptions = (actorId: string) => query(`${userScopeCte}
  SELECT u.id,u.name,u.email,u.username FROM users u JOIN user_scope scope ON scope.id=u.id
  WHERE u.active=true AND u.role='ADMIN' ORDER BY u.name NULLS LAST,u.email`, [actorId]);

export async function createClient(actorId: string, input: ClientCreateInput) {
  const passwordHash = await bcrypt.hash(input.password, 12);
  try {
    const result = await query(`${userScopeCte}, allowed_owner AS (
      SELECT u.id FROM users u JOIN user_scope scope ON scope.id=u.id
      WHERE u.id=$2 AND u.active=true AND u.role='ADMIN'
    ) INSERT INTO users(owner_id,username,email,password_hash,role,name,mobile,company,website,address,inactive_timeout_seconds,active,password_recovery_ciphertext)
      SELECT id,$3,lower($4),$5,'CLIENT',$6,$7,$8,$9,$10,$11,$12,$13 FROM allowed_owner
      RETURNING id,owner_id,username,email,role,name,mobile,company,website,address,inactive_timeout_seconds,active,created_at,updated_at`,
    [actorId, input.ownerId, input.username.trim(), input.email.trim(), passwordHash, input.name?.trim() || null,
      input.mobile?.trim() || null, input.company?.trim() || null, input.website?.trim() || null,
      input.address?.trim() || null, input.inactiveTimeoutSeconds, input.active,sealPassword(input.password)]);
    if (!result.rows[0]) throw new AppError(403, 'INVALID_OWNER', 'Owner is outside your authorized admin hierarchy');
    return result.rows[0];
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (error && typeof error === 'object' && 'code' in error && (error as {code: string}).code === '23505') {
      throw new AppError(409, 'CLIENT_EXISTS', 'Username or email already exists');
    }
    throw error;
  }
}

export async function updateClient(actorId: string, id: string, input: ClientUpdateInput) {
  try {
    const result = await query(`${userScopeCte}
      UPDATE users u SET
        username=CASE WHEN $3::boolean THEN $4 ELSE u.username END,
        name=CASE WHEN $5::boolean THEN $6 ELSE u.name END,
        mobile=CASE WHEN $7::boolean THEN $8 ELSE u.mobile END,
        email=CASE WHEN $9::boolean THEN lower($10) ELSE u.email END,
        company=CASE WHEN $11::boolean THEN $12 ELSE u.company END,
        website=CASE WHEN $13::boolean THEN $14 ELSE u.website END,
        address=CASE WHEN $15::boolean THEN $16 ELSE u.address END,
        inactive_timeout_seconds=CASE WHEN $17::boolean THEN $18 ELSE u.inactive_timeout_seconds END,
        active=CASE WHEN $19::boolean THEN $20 ELSE u.active END,updated_at=now()
      FROM user_scope scope WHERE u.id=$2 AND u.id=scope.id AND u.role='CLIENT'
      RETURNING u.id,u.owner_id,u.username,u.name,u.mobile,u.email,u.company,u.website,u.address,u.active,u.inactive_timeout_seconds,u.created_at,u.updated_at`,
    [actorId, id,
      input.username !== undefined, input.username ?? null,
      input.name !== undefined, input.name ?? null,
      input.mobile !== undefined, input.mobile ?? null,
      input.email !== undefined, input.email ?? null,
      input.company !== undefined, input.company ?? null,
      input.website !== undefined, input.website ?? null,
      input.address !== undefined, input.address ?? null,
      input.inactiveTimeoutSeconds !== undefined, input.inactiveTimeoutSeconds ?? null,
      input.active !== undefined, input.active ?? null]);
    if (!result.rows[0]) throw new AppError(404, 'CLIENT_NOT_FOUND', 'Client not found');
    return result.rows[0];
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (error && typeof error === 'object' && 'code' in error && (error as {code: string}).code === '23505') {
      throw new AppError(409, 'CLIENT_EXISTS', 'Username or email already exists');
    }
    throw error;
  }
}

export async function resetClientPassword(actorId: string, id: string, password: string) {
  const passwordHash = await bcrypt.hash(password, 12);
  const result = await query(`${userScopeCte}, updated AS (
    UPDATE users u SET password_hash=$3,password_recovery_ciphertext=$4,updated_at=now() FROM user_scope scope
    WHERE u.id=$2 AND u.id=scope.id AND u.role='CLIENT' RETURNING u.id,u.updated_at
  ), revoked AS (UPDATE refresh_tokens SET revoked_at=now() WHERE user_id IN (SELECT id FROM updated) AND revoked_at IS NULL)
  SELECT id,updated_at FROM updated`, [actorId, id, passwordHash,sealPassword(password)]);
  if (!result.rows[0]) throw new AppError(404, 'CLIENT_NOT_FOUND', 'Client not found');
  return result.rows[0];
}

export async function deleteClient(actorId: string, id: string) {
  const client = (await query(`${userScopeCte}
    SELECT u.id,u.active,
      EXISTS(SELECT 1 FROM vehicles v WHERE v.owner_id=u.id) AS has_vehicles,
      EXISTS(SELECT 1 FROM users child WHERE child.owner_id=u.id) AS has_children,
      EXISTS(SELECT 1 FROM groups g WHERE g.owner_id=u.id) AS has_groups,
      EXISTS(SELECT 1 FROM subscriptions s WHERE s.user_id=u.id) AS has_subscriptions
    FROM users u JOIN user_scope scope ON scope.id=u.id WHERE u.id=$2 AND u.role='CLIENT'`, [actorId, id])).rows[0] as
      {id: string; active: boolean; has_vehicles: boolean; has_children: boolean; has_groups: boolean; has_subscriptions: boolean} | undefined;
  if (!client) throw new AppError(404, 'CLIENT_NOT_FOUND', 'Client not found');
  if (client.active) throw new AppError(409, 'CLIENT_ACTIVE', 'Deactivate the client before deleting it');
  if (client.has_vehicles || client.has_children || client.has_groups || client.has_subscriptions) {
    throw new AppError(409, 'CLIENT_HAS_DEPENDENCIES', 'Client has dependent records and cannot be deleted');
  }
  const result = await query(`${userScopeCte}, target AS (
    SELECT u.id FROM users u JOIN user_scope scope ON scope.id=u.id
    WHERE u.id=$2 AND u.role='CLIENT' AND u.active=false
      AND NOT EXISTS(SELECT 1 FROM vehicles v WHERE v.owner_id=u.id)
      AND NOT EXISTS(SELECT 1 FROM users child WHERE child.owner_id=u.id)
      AND NOT EXISTS(SELECT 1 FROM groups g WHERE g.owner_id=u.id)
      AND NOT EXISTS(SELECT 1 FROM subscriptions s WHERE s.user_id=u.id)
  ), revoked AS (DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM target))
  DELETE FROM users u USING target WHERE u.id=target.id RETURNING u.id`, [actorId, id]);
  if (!result.rows[0]) throw new AppError(409, 'CLIENT_DELETE_CONFLICT', 'Client changed and could not be deleted');
}

