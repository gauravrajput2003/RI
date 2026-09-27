import {useEffect,useRef,useState} from 'react';
import {Circle,CircleMarker,MapContainer,Marker,Polygon,Polyline,TileLayer,Tooltip,useMap,useMapEvents} from 'react-leaflet';
import L from 'leaflet';
import {Circle as CircleIcon,MapPin,Maximize,PenLine,Pentagon,Settings,Square,Trash2} from 'lucide-react';
import type {Coordinate,FenceShape,Geofence,GeofenceInput} from '../../../../../packages/shared-types/src/geofences';
import 'leaflet/dist/leaflet.css';

type Drawing=Pick<GeofenceInput,'geometry'|'shapeType'|'radiusMeters'>;
type DrawingMode=FenceShape|'EDIT'|null;
const latLng=(point:Coordinate):[number,number]=>[point[1],point[0]];
const coordinate=(point:L.LatLng):Coordinate=>[Math.max(-180,Math.min(180,point.lng)),Math.max(-90,Math.min(90,point.lat))];
const handle=L.divIcon({className:'geofence-handle',iconSize:[14,14],iconAnchor:[7,7]});

function rectangle(first:Coordinate,second:Coordinate):Drawing{
  return{shapeType:'RECTANGLE',radiusMeters:null,geometry:{type:'Polygon',coordinates:[[first,[second[0],first[1]],second,[first[0],second[1]],first]]}};
}

function Shape({drawing,selected,onClick}:{drawing:Drawing;selected?:boolean;onClick?:()=>void}){
  const style={color:selected?'#087ca7':'#607d99',weight:selected?3:2,fillOpacity:selected?.2:.09};
  const events={click:()=>onClick?.()};
  if(drawing.geometry.type==='Polygon')return <Polygon positions={drawing.geometry.coordinates.map(ring=>ring.map(latLng))} pathOptions={style} eventHandlers={events}/>;
  const center=latLng(drawing.geometry.coordinates);
  return drawing.shapeType==='CIRCLE'
    ?<Circle center={center} radius={Math.max(.01,Math.min(1000000,drawing.radiusMeters||.01))} pathOptions={style} eventHandlers={events}/>
    :<CircleMarker center={center} radius={9} pathOptions={{...style,fillOpacity:.9}} eventHandlers={events}><Tooltip>Point geofence</Tooltip></CircleMarker>;
}

function Focus({drawing}:{drawing:Drawing|null}){
  const map=useMap();
  useEffect(()=>{
    if(!drawing)return;
    if(drawing.geometry.type==='Polygon')map.fitBounds(L.latLngBounds(drawing.geometry.coordinates[0].map(latLng)),{padding:[55,55],maxZoom:16});
    else if(drawing.shapeType==='CIRCLE')map.fitBounds(circleBounds(drawing.geometry.coordinates,drawing.radiusMeters!),{padding:[55,55],maxZoom:16});
    else map.setView(latLng(drawing.geometry.coordinates),16);
  },[drawing,map]);
  return null;
}

function Resize(){
  const map=useMap();
  useEffect(()=>{const observer=new ResizeObserver(()=>map.invalidateSize());observer.observe(map.getContainer());return()=>observer.disconnect()},[map]);
  return null;
}

function Editor({mode,draft,onChange,onModeChange,vertices,setVertices}:{mode:DrawingMode;draft:Drawing|null;onChange:(drawing:Drawing)=>void;onModeChange:(mode:DrawingMode)=>void;vertices:Coordinate[];setVertices:(points:Coordinate[])=>void}){
  const dragStart=useRef<Coordinate|null>(null),suppressClickUntil=useRef(0),[guide,setGuide]=useState<Coordinate|null>(null);
  const finishPolygon=()=>{if(vertices.length<3)return;onChange({shapeType:'POLYGON',radiusMeters:null,geometry:{type:'Polygon',coordinates:[[...vertices,vertices[0]]]}});setVertices([]);setGuide(null);onModeChange('EDIT')};
  const map=useMapEvents({
    mousedown:event=>{
      if((mode!=='RECTANGLE'&&mode!=='CIRCLE')||event.originalEvent.button!==0)return;
      L.DomEvent.preventDefault(event.originalEvent);L.DomEvent.stopPropagation(event.originalEvent);
      dragStart.current=coordinate(event.latlng);
    },
    mousemove:event=>{
      const current=coordinate(event.latlng);
      if(mode==='POLYGON'){setGuide(current);return}
      if(!dragStart.current)return;
      if(mode==='RECTANGLE'&&dragStart.current[0]!==current[0]&&dragStart.current[1]!==current[1])onChange(rectangle(dragStart.current,current));
      if(mode==='CIRCLE'){
        const radius=event.latlng.distanceTo(L.latLng(latLng(dragStart.current)));
        if(radius>0&&radius<=1000000)onChange({shapeType:'CIRCLE',geometry:{type:'Point',coordinates:dragStart.current},radiusMeters:radius});
      }
    },
    mouseup:event=>{
      if(!dragStart.current||(mode!=='RECTANGLE'&&mode!=='CIRCLE'))return;
      L.DomEvent.preventDefault(event.originalEvent);L.DomEvent.stopPropagation(event.originalEvent);
      const start=dragStart.current,current=coordinate(event.latlng);dragStart.current=null;suppressClickUntil.current=Date.now()+250;
      if(mode==='RECTANGLE'&&start[0]!==current[0]&&start[1]!==current[1]){onChange(rectangle(start,current));onModeChange('EDIT')}
      if(mode==='CIRCLE'){
        const radius=event.latlng.distanceTo(L.latLng(latLng(start)));
        if(radius>0&&radius<=1000000){onChange({shapeType:'CIRCLE',geometry:{type:'Point',coordinates:start},radiusMeters:radius});onModeChange('EDIT')}
      }
    },
    click:event=>{
      if(Date.now()<suppressClickUntil.current)return;
      const point=coordinate(event.latlng);
      if(mode==='POINT'){onChange({shapeType:'POINT',geometry:{type:'Point',coordinates:point},radiusMeters:null});onModeChange('EDIT');return}
      if(mode!=='POLYGON')return;
      if(vertices.length>=3&&map.latLngToContainerPoint(event.latlng).distanceTo(map.latLngToContainerPoint(L.latLng(latLng(vertices[0]))))<=12){finishPolygon();return}
      if(vertices.length<999)setVertices([...vertices,point]);
    },
  });

  useEffect(()=>{
    const drawing=mode!==null&&mode!=='EDIT',handlers=[map.dragging,map.boxZoom,map.doubleClickZoom,map.scrollWheelZoom];
    if(drawing)handlers.forEach(handler=>handler.disable());else handlers.forEach(handler=>handler.enable());
    map.getContainer().style.cursor=drawing?'crosshair':'';
    return()=>{handlers.forEach(handler=>handler.enable());map.getContainer().style.cursor=''};
  },[map,mode]);

  const drag=(key:string,point:Coordinate,change:(point:Coordinate)=>void)=><Marker key={key} position={latLng(point)} icon={handle} draggable eventHandlers={{dragend:event=>change(coordinate((event.target as L.Marker).getLatLng()))}}><Tooltip>Drag to edit</Tooltip></Marker>;
  let handles=null;
  if(draft&&mode==='EDIT'){
    if(draft.geometry.type==='Point'){
      const center=draft.geometry.coordinates;
      handles=<>{drag('center',center,point=>onChange({...draft,geometry:{type:'Point',coordinates:point}}))}{draft.shapeType==='CIRCLE'&&drag('radius',radiusPoint(center,draft.radiusMeters!),point=>{const radius=L.latLng(latLng(center)).distanceTo(latLng(point));if(radius>0&&radius<=1000000)onChange({...draft,radiusMeters:radius})})}</>;
    }else{
      const ring=draft.geometry.coordinates[0];
      handles=(draft.shapeType==='RECTANGLE'?[0,2]:ring.slice(0,-1).map((_,index)=>index)).map(index=>drag(String(index),ring[index],point=>{
        if(draft.shapeType==='RECTANGLE'){const opposite=ring[index===0?2:0];if(point[0]!==opposite[0]&&point[1]!==opposite[1])onChange(rectangle(point,opposite));return}
        const points=ring.slice(0,-1).map((value,current)=>current===index?point:value);onChange({...draft,geometry:{type:'Polygon',coordinates:[[...points,points[0]]]}});
      }));
    }
  }
  const guidePositions=mode==='POLYGON'&&vertices.length&&guide?[...vertices,guide].map(latLng):vertices.map(latLng);
  return <>{guidePositions.length>1&&<Polyline positions={guidePositions} pathOptions={{dashArray:'6 6',color:'#087ca7'}}/>}{vertices.map((point,index)=><CircleMarker key={index} center={latLng(point)} radius={index===0?6:4} pathOptions={{color:'#087ca7',fillColor:'#fff',fillOpacity:1}}/>)}{handles}</>;
}

function radiusPoint(center:Coordinate,meters:number):Coordinate{const distance=meters/6371000,latitude=center[1]*Math.PI/180,longitude=center[0]*Math.PI/180,resultLatitude=Math.asin(Math.sin(latitude)*Math.cos(distance)),resultLongitude=longitude+Math.atan2(Math.sin(distance)*Math.cos(latitude),Math.cos(distance)-Math.sin(latitude)*Math.sin(resultLatitude));return [((resultLongitude*180/Math.PI+540)%360)-180,resultLatitude*180/Math.PI]}
function circleBounds(center:Coordinate,meters:number){const angle=meters/6371000,latitude=angle*180/Math.PI,longitude=Math.abs(center[1])+latitude>=90?180:Math.asin(Math.min(1,Math.sin(angle)/Math.cos(center[1]*Math.PI/180)))*180/Math.PI;return L.latLngBounds([Math.max(-90,center[1]-latitude),center[0]-longitude],[Math.min(90,center[1]+latitude),center[0]+longitude])}

export function GeofenceMap({rows,selected,onSelect,draft,editing,onChange,session,disabled=false}:{rows:Geofence[];selected:Geofence|null;onSelect:(fence:Geofence)=>void;draft:Drawing|null;editing:boolean;onChange:(drawing:Drawing|null)=>void;session:number;disabled?:boolean}){
  const [mapType,setMapType]=useState<'street'|'satellite'>('street'),[settings,setSettings]=useState(false),[mode,setMode]=useState<DrawingMode>(null),[vertices,setVertices]=useState<Coordinate[]>([]),[tileError,setTileError]=useState(false);
  const root=useRef<HTMLDivElement>(null);
  useEffect(()=>{setMode(null);setVertices([])},[session]);
  const begin=(shape:FenceShape)=>{
    if(mode===shape){setMode(null);setVertices([]);return}
    if((draft||vertices.length)&&!window.confirm('Replace the current unsaved drawing?'))return;
    onChange(null);setVertices([]);setMode(shape);
  };
  const tools=[['POLYGON','Polygon',Pentagon],['RECTANGLE','Rectangle',Square],['CIRCLE','Circle',CircleIcon],['POINT','Marker',MapPin]] as const;
  return <div className="geofence-map" ref={root}><MapContainer center={[22.8,79.1]} zoom={5} className="map" zoomControl={false}>
    <TileLayer key={mapType} url={mapType==='satellite'?'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}':'https://tile.openstreetmap.org/{z}/{x}/{y}.png'} attribution={mapType==='satellite'?'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community':'&copy; OpenStreetMap contributors'} eventHandlers={{tileerror:()=>setTileError(true)}}/>
    <MapControls/><Resize/><Focus drawing={selected}/>
    {rows.filter(fence=>!editing||fence.id!==selected?.id).map(fence=><Shape key={fence.id} drawing={fence} selected={selected?.id===fence.id} onClick={()=>{if(!editing)onSelect(fence)}}/>)}
    {selected&&!rows.some(fence=>fence.id===selected.id)&&!editing&&<Shape drawing={selected} selected onClick={()=>onSelect(selected)}/>}
    {editing&&draft&&<Shape drawing={draft} selected/>}
    {editing&&!disabled&&<Editor mode={mode} draft={draft} onChange={onChange} onModeChange={setMode} vertices={vertices} setVertices={setVertices}/>}
  </MapContainer>
  <div className="geofence-tools">{tools.map(([shape,label,Icon])=><button key={shape} type="button" disabled={!editing||disabled} aria-label={`Draw ${label}`} title={`Draw ${label}`} aria-pressed={mode===shape} onClick={()=>begin(shape)}><Icon/></button>)}<button type="button" disabled={!editing||disabled||!draft} title="Edit geometry" aria-label="Edit geometry" aria-pressed={mode==='EDIT'} onClick={()=>{setVertices([]);setMode(current=>current==='EDIT'?null:'EDIT')}}><PenLine/></button><button type="button" disabled={!editing||disabled||(!draft&&!vertices.length)} aria-label="Clear drawing" title="Clear drawing" onClick={()=>{if(window.confirm('Clear the unsaved drawing?')){onChange(null);setVertices([]);setMode(null)}}}><Trash2/></button></div>
  <div className="geofence-map-settings"><button type="button" aria-label="Fullscreen map" title="Map Fullscreen" onClick={()=>{if(document.fullscreenElement)void document.exitFullscreen();else void root.current?.requestFullscreen().catch(()=>setTileError(true))}}><Maximize/></button><button type="button" aria-label="Map settings" title="Map settings" aria-expanded={settings} onClick={()=>setSettings(current=>!current)}><Settings/></button>{settings&&<fieldset className="geofence-layer-menu"><legend>Map Type</legend><label><input type="radio" name="geofence-map-type" value="street" checked={mapType==='street'} onChange={()=>{setTileError(false);setMapType('street')}}/>Street</label><label><input type="radio" name="geofence-map-type" value="satellite" checked={mapType==='satellite'} onChange={()=>{setTileError(false);setMapType('satellite')}}/>Satellite</label></fieldset>}</div>
  {editing&&<div className="geofence-instruction" role="status">{mode==='POLYGON'?`Click vertices (${vertices.length}); click the first point or Finish polygon to close.`:mode==='RECTANGLE'?'Press, drag, and release to draw a rectangle.':mode==='CIRCLE'?'Press at the center, drag outward, and release.':mode==='POINT'?'Click once to place a marker.':mode==='EDIT'?'Drag the white handles to edit the geometry.':draft?'Choose Edit to adjust the geometry, or select a drawing tool to replace it.':'Choose a drawing tool to begin.'}{mode==='POLYGON'&&<button type="button" disabled={vertices.length<3} onClick={()=>{onChange({shapeType:'POLYGON',radiusMeters:null,geometry:{type:'Polygon',coordinates:[[...vertices,vertices[0]]]}});setVertices([]);setMode('EDIT')}}>Finish polygon</button>}</div>}
  {tileError&&<div className="geofence-map-error" role="alert">Some map tiles could not load. Check your connection or switch layers. <button type="button" onClick={()=>setTileError(false)}>Dismiss</button></div>}
  </div>;
}

function MapControls(){const map=useMap();return <div className="geofence-zoom" ref={element=>{if(element)L.DomEvent.disableClickPropagation(element)}}><button type="button" aria-label="Zoom in" onClick={()=>map.zoomIn()}>+</button><button type="button" aria-label="Zoom out" onClick={()=>map.zoomOut()}>−</button></div>}
