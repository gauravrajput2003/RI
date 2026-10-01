import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {afterAll,beforeAll,beforeEach,expect,it,vi} from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const state=vi.hoisted(()=>({db:undefined as PGlite|undefined,upload:vi.fn(),remove:vi.fn()}));
vi.mock('../db/pool.js',()=>({query:(sql:string,params?:unknown[])=>state.db!.query(sql,params)}));
vi.mock('../modules/profile/cloudinary.js',()=>({uploadAvatar:state.upload,deleteAvatar:state.remove}));

const secret='profile-test-secret-at-least-32-characters';
const first=randomUUID(),second=randomUUID();
let app:express.Express;
const token=(id:string)=>jwt.sign({id,role:'SUPER_ADMIN'},secret);

beforeAll(async()=>{
 process.env.DATABASE_URL='postgresql://unused:unused@localhost/unused';
 process.env.JWT_SECRET=secret;process.env.JWT_REFRESH_SECRET=secret+'-refresh';process.env.INTERNAL_TRACKER_SECRET=secret+'-internal';
 state.db=new PGlite();
 await state.db.exec('CREATE TABLE users(id uuid PRIMARY KEY,email text,name text,username text,mobile text,coins numeric,active boolean,updated_at timestamptz DEFAULT now())');
 await state.db.exec(await readFile(new URL('../../../../database/migrations/011_user_avatars.sql',import.meta.url),'utf8'));
 await state.db.exec(await readFile(new URL('../../../../database/migrations/014_packet_health_permission.sql',import.meta.url),'utf8'));
 const {api}=await import('./api.js');const {errorHandler}=await import('../lib/errors.js');
 app=express();app.use(express.json({limit:'3mb'}));app.use('/api/v1',api);app.use(errorHandler);
},30000);
afterAll(async()=>{await state.db?.close()});
beforeEach(async()=>{
 state.upload.mockReset();state.remove.mockReset();state.remove.mockResolvedValue(undefined);
 await state.db!.exec('TRUNCATE users');
 await state.db!.query('INSERT INTO users(id,email,name,username,mobile,coins,active) VALUES($1,$2,$3,$4,$5,0,true),($6,$7,$8,$9,$10,0,true)',[first,'first@example.com','First User','first','1111111111',second,'second@example.com','Second User','second','2222222222']);
});

it('returns only the signed-in user’s profile details',async()=>{
 const response=await request(app).get('/api/v1/account-summary').set('Authorization',`Bearer ${token(first)}`).expect(200);
 expect(response.body.data).toMatchObject({id:first,name:'First User',mobile:'1111111111',email:'first@example.com',avatarUrl:null});
 expect(JSON.stringify(response.body)).not.toContain('second@example.com');
});

it('updates only the signed-in user’s avatar',async()=>{
 state.upload.mockResolvedValue({url:'https://res.cloudinary.com/test/image/upload/first.png',publicId:`fleet/avatars/${first}/photo`});
 await request(app).post('/api/v1/account-avatar').send({dataUri:'data:image/png;base64,AAAA'}).expect(401);
 expect(state.upload).not.toHaveBeenCalled();
 const response=await request(app).post('/api/v1/account-avatar').set('Authorization',`Bearer ${token(first)}`).send({dataUri:'data:image/png;base64,AAAA'}).expect(200);
 expect(response.body.data.avatarUrl).toBe('https://res.cloudinary.com/test/image/upload/first.png');
 expect(state.upload).toHaveBeenCalledWith(first,'data:image/png;base64,AAAA');
 const accounts=await state.db!.query<{id:string;avatar_url:string|null}>('SELECT id,avatar_url FROM users ORDER BY id');
 expect(accounts.rows.find(row=>row.id===first)?.avatar_url).toBe('https://res.cloudinary.com/test/image/upload/first.png');
 expect(accounts.rows.find(row=>row.id===second)?.avatar_url).toBeNull();
});
