import {useState,type ReactNode} from 'react';
import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import L from 'leaflet';
import {GeofenceMap} from './GeofenceMap';
import type {GeofenceInput} from '../../../../../packages/shared-types/src/geofences';

type Drawing=Pick<GeofenceInput,'shapeType'|'geometry'|'radiusMeters'>;
type MapEvent={latlng:L.LatLng;originalEvent:MouseEvent};
type MapEvents={mousedown?:(event:MapEvent)=>void;mousemove?:(event:MapEvent)=>void;mouseup?:(event:MapEvent)=>void;click?:(event:{latlng:L.LatLng})=>void};
const state=vi.hoisted(()=>{
  const handler=()=>({enable:vi.fn(),disable:vi.fn()});
  return{
    events:{} as MapEvents,drawn:undefined as Drawing|undefined,
    handles:[] as {position:[number,number];eventHandlers:{dragend:(event:{target:{getLatLng:()=>L.LatLng}})=>void}}[],
    container:document.createElement('div'),tile:'',
    map:{fitBounds:vi.fn(),setView:vi.fn(),invalidateSize:vi.fn(),zoomIn:vi.fn(),zoomOut:vi.fn(),getContainer:()=>document.createElement('div'),latLngToContainerPoint:(point:L.LatLng)=>L.point(point.lng*100,point.lat*100),dragging:handler(),boxZoom:handler(),doubleClickZoom:handler(),scrollWheelZoom:handler()},
  };
});

vi.mock('react-leaflet',()=>({
  MapContainer:({children}:{children:ReactNode})=><div>{children}</div>,
  TileLayer:({url}:{url:string})=>{state.tile=url;return null},Circle:()=>null,CircleMarker:()=>null,Polygon:()=>null,Polyline:()=>null,
  Marker:(props:(typeof state.handles)[number])=>{state.handles.push(props);return null},Tooltip:()=>null,
  useMap:()=>state.map,useMapEvents:(events:MapEvents)=>{state.events=events;return state.map},
}));

function Harness(){const [draft,setDraft]=useState<Drawing|null>(null);return <GeofenceMap rows={[]} selected={null} onSelect={()=>{}} editing draft={draft} onChange={drawing=>{state.drawn=drawing??undefined;setDraft(drawing)}} session={0}/>}
const mouse=(kind:keyof MapEvents,latitude:number,longitude:number)=>act(()=>state.events[kind]?.({latlng:L.latLng(latitude,longitude),originalEvent:new MouseEvent(String(kind),{button:0})} as MapEvent));
const click=(latitude:number,longitude:number)=>act(()=>state.events.click?.({latlng:L.latLng(latitude,longitude)}));

beforeEach(()=>{
  state.events={};state.drawn=undefined;state.handles=[];state.tile='';
  for(const handler of [state.map.dragging,state.map.boxZoom,state.map.doubleClickZoom,state.map.scrollWheelZoom]){handler.enable.mockClear();handler.disable.mockClear()}
  vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});vi.spyOn(window,'confirm').mockReturnValue(true);
});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals()});

it('creates a rectangle with one mouse-down, drag and mouse-up gesture',()=>{
  render(<Harness/>);fireEvent.click(screen.getByRole('button',{name:'Draw Rectangle'}));
  mouse('mousedown',28,77);mouse('mousemove',29,78);mouse('mouseup',29,78);
  expect(state.drawn).toEqual({shapeType:'RECTANGLE',radiusMeters:null,geometry:{type:'Polygon',coordinates:[[[77,28],[78,28],[78,29],[77,29],[77,28]]]}});
  expect(screen.getByRole('button',{name:'Edit geometry'})).toHaveAttribute('aria-pressed','true');
});

it('creates a circle from the direct drag distance in meters',()=>{
  render(<Harness/>);fireEvent.click(screen.getByRole('button',{name:'Draw Circle'}));
  mouse('mousedown',28,77);mouse('mousemove',28,77.01);mouse('mouseup',28,77.01);
  expect(state.drawn).toMatchObject({shapeType:'CIRCLE',geometry:{type:'Point',coordinates:[77,28]}});
  expect(state.drawn?.radiusMeters).toBeCloseTo(L.latLng(28,77).distanceTo([28,77.01]),5);
});

it('gives drawing priority and restores normal navigation after a shape is complete',()=>{
  render(<Harness/>);for(const handler of [state.map.dragging,state.map.boxZoom,state.map.doubleClickZoom,state.map.scrollWheelZoom])handler.disable.mockClear();
  mouse('mousedown',28,77);mouse('mousemove',29,78);mouse('mouseup',29,78);expect(state.drawn).toBeUndefined();
  for(const handler of [state.map.dragging,state.map.boxZoom,state.map.doubleClickZoom,state.map.scrollWheelZoom])expect(handler.disable).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Draw Rectangle'}));
  for(const handler of [state.map.dragging,state.map.boxZoom,state.map.doubleClickZoom,state.map.scrollWheelZoom])expect(handler.disable).toHaveBeenCalled();
  mouse('mousedown',28,77);mouse('mousemove',29,78);mouse('mouseup',29,78);
  for(const handler of [state.map.dragging,state.map.boxZoom,state.map.doubleClickZoom,state.map.scrollWheelZoom])expect(handler.enable).toHaveBeenCalled();
});

it('builds a polygon with clicks and closes it by clicking the first vertex',()=>{
  render(<Harness/>);fireEvent.click(screen.getByRole('button',{name:'Draw Polygon'}));
  click(28,77);click(29,78);click(28,78);click(28,77.01);
  expect(state.drawn).toEqual({shapeType:'POLYGON',radiusMeters:null,geometry:{type:'Polygon',coordinates:[[[77,28],[78,29],[78,28],[77,28]]]}});
});

it('places a marker with one click',()=>{render(<Harness/>);fireEvent.click(screen.getByRole('button',{name:'Draw Marker'}));click(28,77);expect(state.drawn).toEqual({shapeType:'POINT',geometry:{type:'Point',coordinates:[77,28]},radiusMeters:null})});

it('keeps geometry while switching Street and Satellite layers',()=>{
  render(<Harness/>);fireEvent.click(screen.getByRole('button',{name:'Draw Marker'}));click(28,77);const drawing=state.drawn;
  fireEvent.click(screen.getByRole('button',{name:'Map settings'}));expect(screen.getByLabelText('Street')).toBeChecked();fireEvent.click(screen.getByLabelText('Satellite'));
  expect(state.tile).toContain('World_Imagery');expect(state.drawn).toEqual(drawing);fireEvent.click(screen.getByLabelText('Street'));expect(state.tile).toContain('openstreetmap');expect(state.drawn).toEqual(drawing);
});

it('fits an existing circle without requiring a mounted Leaflet circle instance',()=>{
  const fence={id:'circle',name:'Circle',categoryKey:'yard',shapeType:'CIRCLE' as const,geometry:{type:'Point' as const,coordinates:[77,28] as [number,number]},radiusMeters:1000,vehicleIds:[],vehicles:[],created_at:'',updated_at:''};
  render(<GeofenceMap rows={[fence]} selected={fence} onSelect={()=>{}} draft={null} editing={false} onChange={()=>{}} session={0}/>);
  expect(state.map.fitBounds).toHaveBeenCalled();const bounds=state.map.fitBounds.mock.calls.at(-1)![0] as L.LatLngBounds;expect(bounds.contains([28,77])).toBe(true);expect(bounds.getNorth()-bounds.getSouth()).toBeGreaterThan(.017);
});

it('edits circle radius only after the explicit Edit tool is active',()=>{
  render(<Harness/>);fireEvent.click(screen.getByRole('button',{name:'Draw Circle'}));mouse('mousedown',28,77);mouse('mouseup',28,77.01);
  expect(screen.getByRole('button',{name:'Edit geometry'})).toHaveAttribute('aria-pressed','true');
  act(()=>state.handles.at(-1)!.eventHandlers.dragend({target:{getLatLng:()=>L.latLng(28,77.02)}}));
  expect(state.drawn?.radiusMeters).toBeCloseTo(L.latLng(28,77).distanceTo([28,77.02]),5);
});

it('keeps a polygon ring closed when its first edit handle moves',()=>{
  render(<Harness/>);fireEvent.click(screen.getByRole('button',{name:'Draw Polygon'}));click(28,77);click(29,78);click(28,78);fireEvent.click(screen.getByRole('button',{name:'Finish polygon'}));
  act(()=>state.handles.at(-3)!.eventHandlers.dragend({target:{getLatLng:()=>L.latLng(27,76)}}));
  expect(state.drawn?.geometry).toEqual({type:'Polygon',coordinates:[[[76,27],[78,29],[78,28],[76,27]]]});
});

it('requires confirmation before replacing a draft geometry',()=>{
  render(<Harness/>);fireEvent.click(screen.getByRole('button',{name:'Draw Marker'}));click(28,77);const drawing=state.drawn;
  vi.mocked(window.confirm).mockReturnValue(false);fireEvent.click(screen.getByRole('button',{name:'Draw Circle'}));expect(state.drawn).toEqual(drawing);expect(screen.getByRole('button',{name:'Draw Circle'})).toHaveAttribute('aria-pressed','false');
});
import '@testing-library/jest-dom/vitest';
