import {createHash,randomUUID} from 'node:crypto';
import {env} from '../../config/env.js';
import {AppError} from '../../lib/errors.js';

const maxAvatarBytes=2*1024*1024;
type AvatarMime='image/jpeg'|'image/png'|'image/webp';

function credentials(kind:'avatar'|'announcement'='avatar'){
 const {CLOUDINARY_CLOUD_NAME:cloud,CLOUDINARY_API_KEY:key,CLOUDINARY_API_SECRET:secret}=env;
 if(!cloud||!key||!secret)throw kind==='announcement'?new AppError(503,'ANNOUNCEMENT_STORAGE_UNAVAILABLE','Announcement image storage is not configured'):new AppError(503,'AVATAR_STORAGE_UNAVAILABLE','Profile photo storage is not configured');
 return {cloud,key,secret};
}

function signature(parameters:Record<string,string>,secret:string){
 const signed=Object.entries(parameters).sort(([left],[right])=>left.localeCompare(right)).map(([key,value])=>`${key}=${value}`).join('&');
 return createHash('sha1').update(signed+secret).digest('hex');
}

function validatedImage(dataUri:string){
 const match=/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUri);
 if(!match)throw new AppError(400,'INVALID_AVATAR','Choose a JPEG, PNG, or WebP image');
 const mime=match[1] as AvatarMime,bytes=Buffer.from(match[2],'base64');
 if(bytes.length===0||bytes.length>maxAvatarBytes)throw new AppError(400,'INVALID_AVATAR','Profile photo must be 2 MB or smaller');
 const valid=mime==='image/jpeg'?bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff:
  mime==='image/png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):
  bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';
 if(!valid)throw new AppError(400,'INVALID_AVATAR','Image content does not match its file type');
 return dataUri;
}

export async function uploadAvatar(userId:string,dataUri:string){
 const {cloud,key,secret}=credentials();
 const params={public_id:`fleet/avatars/${userId}/${randomUUID()}`,timestamp:String(Math.floor(Date.now()/1000))};
 const form=new FormData();form.set('file',validatedImage(dataUri));form.set('public_id',params.public_id);form.set('timestamp',params.timestamp);form.set('api_key',key);form.set('signature',signature(params,secret));
 let response:Response;
 try{response=await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloud)}/image/upload`,{method:'POST',body:form})}
 catch{throw new AppError(502,'AVATAR_UPLOAD_FAILED','Could not upload profile photo')}
 if(!response.ok)throw new AppError(502,'AVATAR_UPLOAD_FAILED','Could not upload profile photo');
 const result=await response.json() as {secure_url?:string;public_id?:string};
 if(!result.secure_url?.startsWith(`https://res.cloudinary.com/${cloud}/`)||result.public_id!==params.public_id)throw new AppError(502,'AVATAR_UPLOAD_FAILED','Invalid photo storage response');
 return {url:result.secure_url,publicId:result.public_id};
}

export async function deleteAvatar(publicId:string){
 const {cloud,key,secret}=credentials();
 const params={public_id:publicId,timestamp:String(Math.floor(Date.now()/1000))};
 const form=new FormData();form.set('public_id',params.public_id);form.set('timestamp',params.timestamp);form.set('api_key',key);form.set('signature',signature(params,secret));
 const response=await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloud)}/image/destroy`,{method:'POST',body:form});
 if(!response.ok)throw new Error('Cloudinary photo cleanup failed');
}

export async function uploadAnnouncementImage(userId:string,dataUri:string){
 const match=/^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUri);
 if(!match)throw new AppError(400,'INVALID_ANNOUNCEMENT_IMAGE','Choose a JPEG, PNG, WebP, or GIF image');
 const bytes=Buffer.from(match[2],'base64');
 if(!bytes.length||bytes.length>5*1024*1024)throw new AppError(400,'INVALID_ANNOUNCEMENT_IMAGE','Image must be 5 MB or smaller');
 const mime=match[1],valid=mime==='image/jpeg'?bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff:mime==='image/png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):mime==='image/webp'?bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP':bytes.toString('ascii',0,4)==='GIF8';
 if(!valid)throw new AppError(400,'INVALID_ANNOUNCEMENT_IMAGE','Image content does not match its file type');
 const {cloud,key,secret}=credentials('announcement'),params={public_id:`fleet/announcements/${userId}/${randomUUID()}`,timestamp:String(Math.floor(Date.now()/1000))};
 const form=new FormData();form.set('file',dataUri);form.set('public_id',params.public_id);form.set('timestamp',params.timestamp);form.set('api_key',key);form.set('signature',signature(params,secret));
 let response:Response;try{response=await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloud)}/image/upload`,{method:'POST',body:form})}catch{throw new AppError(502,'ANNOUNCEMENT_UPLOAD_FAILED','Could not upload image')}
 if(!response.ok)throw new AppError(502,'ANNOUNCEMENT_UPLOAD_FAILED','Could not upload image');
 const result=await response.json() as {secure_url?:string;public_id?:string};
 if(!result.secure_url?.startsWith(`https://res.cloudinary.com/${cloud}/`)||result.public_id!==params.public_id)throw new AppError(502,'ANNOUNCEMENT_UPLOAD_FAILED','Invalid image storage response');
 return {url:result.secure_url,publicId:result.public_id};
}

export const deleteAnnouncementImage=deleteAvatar;
