import {leafletJs,leafletCss} from './leaflet-assets';
import type {Region} from './LeafletMap';
export function mapHtml(region?:Region){
 const initial=JSON.stringify(region??{latitude:28.9,longitude:76.58,latitudeDelta:.2,longitudeDelta:.2});
 return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><style>${leafletCss}
 html,body,#map{height:100%;width:100%;margin:0} .vehicle{background:none;border:0}.leaflet-control-attribution{font-size:10px}
 </style></head><body><div id="map"></div><script>${leafletJs}</script><script>
 const post=m=>window.ReactNativeWebView.postMessage(JSON.stringify(m));
 const map=L.map('map',{zoomControl:true,attributionControl:true});
 const tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(map);
 let failed=0;tiles.on('tileerror',()=>{if(++failed>=3)post({type:'tiles-error'});});tiles.on('tileload',()=>{failed=0;post({type:'tiles-ok'});});
 const valid=p=>p&&Number.isFinite(p.latitude)&&Number.isFinite(p.longitude)&&Math.abs(p.latitude)<=90&&Math.abs(p.longitude)<=180;
 const latlng=p=>[p.latitude,p.longitude];
 function region(r){if(valid(r))map.fitBounds([[r.latitude-r.latitudeDelta/2,r.longitude-r.longitudeDelta/2],[r.latitude+r.latitudeDelta/2,r.longitude+r.longitudeDelta/2]],{animate:false});}
 region(${initial});const layers=new Map();
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function icon(p){const color=/^#[0-9a-f]{6}$/i.test(p.color)?p.color:'#087ca7';const heading=Number.isFinite(p.rotation)?p.rotation:0;const label=escape(p.label);return L.divIcon({className:'vehicle',iconSize:[30,42],iconAnchor:[15,21],html:label?'<div style="width:28px;height:28px;border:2px solid white;border-radius:50%;background:'+color+';color:white;text-align:center;line-height:28px;font:bold 16px sans-serif;box-shadow:0 1px 4px #555">'+label+'</div>':'<svg width="30" height="42" viewBox="0 0 30 42" style="transform:rotate('+heading+'deg)"><ellipse cx="15" cy="22" rx="11" ry="18" fill="#000" opacity=".18"/><rect x="11" y="1" width="8" height="11" rx="3" fill="#1f2937"/><rect x="10" y="30" width="10" height="11" rx="3" fill="#1f2937"/><path d="M15 6 C6 8 5 15 8 24 L10 33 Q15 39 20 33 L22 24 C25 15 24 8 15 6Z" fill="'+color+'" stroke="white" stroke-width="1.5"/><rect x="11" y="22" width="8" height="11" rx="3" fill="#1f2937"/><path d="M6 10H24" stroke="#374151" stroke-width="3"/></svg>'});}
 window.fleetReceive=m=>{
  if(m.type==='region')region(m.region);
  if(m.type==='fit'){const points=m.coordinates.filter(valid).map(latlng);if(points.length)map.fitBounds(L.latLngBounds(points),{padding:[32,32],maxZoom:17,animate:false});}
  if(m.type==='layers'||m.type==='updates'){const keep=new Set();for(const [id,p] of m.layers){keep.add(id);let old=layers.get(id);if(old&&old.kind!==p.kind){map.removeLayer(old.layer);layers.delete(id);old=null;}
   if(p.kind==='marker'&&valid(p.coordinate)){if(!old){const layer=L.marker(latlng(p.coordinate),{icon:icon(p)}).addTo(map);layer.on('click',()=>post({type:'press',id}));old={kind:p.kind,layer};layers.set(id,old);}else{old.layer.setLatLng(latlng(p.coordinate));old.layer.setIcon(icon(p));}if(p.title){if(old.layer.getPopup())old.layer.setPopupContent(escape(p.title));else old.layer.bindPopup(escape(p.title));}}
   else if(p.kind==='line'){const coordinates=p.coordinates.filter(valid).map(latlng);if(!old){old={kind:p.kind,layer:L.polyline(coordinates,{color:p.color,weight:p.width}).addTo(map)};layers.set(id,old);}else old.layer.setLatLngs(coordinates);}
  }for(const [id,p]of layers)if((m.type==='layers'&&!keep.has(id))||(m.removed??[]).includes(id)){map.removeLayer(p.layer);layers.delete(id);}}
 };
 map.on('dragstart',()=>post({type:'pan'}));map.on('moveend',()=>{const c=map.getCenter(),b=map.getBounds();post({type:'region',region:{latitude:c.lat,longitude:c.lng,latitudeDelta:b.getNorth()-b.getSouth(),longitudeDelta:b.getEast()-b.getWest()}});});
 setTimeout(()=>{map.invalidateSize();post({type:'ready'});},0);
 </script></body></html>`;
}
