import {z} from 'zod';
import {geofenceCategories} from '@fleet/shared-types';
const coordinate=z.tuple([z.number().finite().min(-180).max(180),z.number().finite().min(-90).max(90)]);
const geometry=z.discriminatedUnion('type',[
 z.object({type:z.literal('Point'),coordinates:coordinate}).strict(),
 z.object({type:z.literal('Polygon'),coordinates:z.array(z.array(coordinate).min(4).max(1000)).length(1)}).strict(),
]);
export const fenceBody=z.object({name:z.string().trim().min(1).max(120),categoryKey:z.string().refine(key=>geofenceCategories.some(c=>c.key===key)),shapeType:z.enum(['POINT','POLYGON','RECTANGLE','CIRCLE']),geometry,radiusMeters:z.number().finite().positive().max(1000000).nullable(),vehicleIds:z.array(z.string().uuid()).min(1).max(1000).refine(ids=>new Set(ids).size===ids.length,'Duplicate vehicles')}).strict().superRefine((v,ctx)=>{
 const invalid=(message:string)=>ctx.addIssue({code:'custom',message,path:['geometry']});
 if((v.shapeType==='POINT'||v.shapeType==='CIRCLE')!==(v.geometry.type==='Point'))invalid('Shape and geometry do not match');
 if((v.shapeType==='CIRCLE')!==(v.radiusMeters!==null))invalid('Only circles require radius');
 if(v.geometry.type==='Polygon'){
  const ring=v.geometry.coordinates[0],first=ring[0],last=ring.at(-1)!;
  if(first[0]!==last[0]||first[1]!==last[1])invalid('Polygon must be closed');
  if(v.shapeType==='RECTANGLE'&&(ring.length!==5||ring.slice(0,-1).some((p,i)=>{const q=ring[i+1];return (p[0]===q[0])===(p[1]===q[1]);})))invalid('Rectangle must have four axis-aligned edges');
 }
});
