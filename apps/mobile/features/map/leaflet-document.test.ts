import {Script,runInNewContext} from 'node:vm';
import {it,expect,vi} from 'vitest';
import {mapHtml} from './leaflet-document';
it('bundles executable Leaflet offline and retains attribution without Google services',()=>{
 const html=mapHtml();const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match=>match[1]);
 expect(scripts).toHaveLength(2);for(const source of scripts)expect(()=>new Script(source)).not.toThrow();
 expect(html).toContain('https://tile.openstreetmap.org/{z}/{x}/{y}.png');
 expect(html).toContain('OpenStreetMap');expect(html).not.toMatch(/<script[^>]+src=/);
});
it('moves existing markers, preserves the route during marker updates, and removes stale layers',()=>{
 const sources=[...mapHtml().matchAll(/<script>([\s\S]*?)<\/script>/g)];
 const marker={addTo:vi.fn().mockReturnThis(),on:vi.fn(),setLatLng:vi.fn(),setIcon:vi.fn(),getPopup:()=>false,bindPopup:vi.fn()};
 const line={addTo:vi.fn().mockReturnThis(),setLatLngs:vi.fn()};
 const map={fitBounds:vi.fn(),on:vi.fn(),removeLayer:vi.fn(),invalidateSize:vi.fn()};
 const L={map:()=>map,tileLayer:()=>({addTo:()=>({on:vi.fn()})}),marker:vi.fn(()=>marker),polyline:vi.fn(()=>line),divIcon:(x:unknown)=>x,latLngBounds:(x:unknown)=>x};
 const window={ReactNativeWebView:{postMessage:vi.fn()},fleetReceive:undefined as undefined|((message:unknown)=>void)};
 runInNewContext(sources[1][1],{L,window,setTimeout:vi.fn()});
 const point={kind:'marker',coordinate:{latitude:28,longitude:76},title:'<img src=x onerror=alert(1)>'};
 window.fleetReceive!({type:'layers',layers:[['bike',point],['route',{kind:'line',coordinates:[point.coordinate]}]]});
 window.fleetReceive!({type:'updates',layers:[['bike',{...point,coordinate:{latitude:29,longitude:77}}]],removed:[]});
 expect(L.marker).toHaveBeenCalledOnce();expect(marker.setLatLng).toHaveBeenCalledWith([29,77]);
 expect(marker.bindPopup).toHaveBeenCalledWith('&lt;img src=x onerror=alert(1)&gt;');
 expect(L.polyline).toHaveBeenCalledOnce();expect(line.setLatLngs).not.toHaveBeenCalled();
 expect(map.removeLayer).not.toHaveBeenCalled();
 window.fleetReceive!({type:'updates',layers:[],removed:['bike']});expect(map.removeLayer).toHaveBeenCalledWith(marker);
});
