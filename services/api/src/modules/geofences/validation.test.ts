import {describe,it,expect} from 'vitest';
import {fenceBody} from './validation.js';
const input={name:' Yard ',categoryKey:'yard',shapeType:'POINT',geometry:{type:'Point',coordinates:[77,28]},radiusMeters:null,vehicleIds:['00000000-0000-4000-8000-000000000001']};
describe('geofence request validation',()=>{
 it('normalizes the name and accepts a valid point',()=>expect(fenceBody.parse(input).name).toBe('Yard'));
 it.each([{categoryKey:'bad'},{name:''},{vehicleIds:[]},{vehicleIds:[...input.vehicleIds,...input.vehicleIds]},{ownerId:'bad'},{assignType:'GROUP'},{shapeType:'CIRCLE',radiusMeters:null},{shapeType:'CIRCLE',radiusMeters:-1},{shapeType:'CIRCLE',radiusMeters:Infinity},{shapeType:'CIRCLE',radiusMeters:1000001},{geometry:{type:'Point',coordinates:[0,91]}},{geometry:{type:'Point',coordinates:[NaN,0]}},{geometry:{type:'Polygon',coordinates:[[[0,0],[1,0],[1,1],[0,0]]]}}])('rejects malformed or unsupported input %j',change=>expect(fenceBody.safeParse({...input,...change}).success).toBe(false));
 it('requires closed polygon rings',()=>expect(fenceBody.safeParse({...input,shapeType:'POLYGON',geometry:{type:'Polygon',coordinates:[[[0,0],[1,0],[1,1],[2,2]]]}}).success).toBe(false));
 it('requires axis aligned rectangle edges',()=>expect(fenceBody.safeParse({...input,shapeType:'RECTANGLE',geometry:{type:'Polygon',coordinates:[[[0,0],[1,0],[2,1],[0,1],[0,0]]]}}).success).toBe(false));
});
