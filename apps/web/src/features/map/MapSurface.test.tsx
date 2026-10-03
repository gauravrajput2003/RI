import type {ReactNode} from 'react';
import {act,cleanup,render} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {FleetMap} from './MapSurface';
const state=vi.hoisted(()=>({container:document.createElement('div'),resize:[] as (()=>void)[],map:{getContainer:():HTMLElement=>state.container,setView:vi.fn(),fitBounds:vi.fn(),invalidateSize:vi.fn(),stop:vi.fn()}}));
vi.mock('react-leaflet',()=>({MapContainer:({children}:{children:ReactNode})=><div>{children}</div>,TileLayer:()=>null,Marker:()=>null,Tooltip:()=>null,CircleMarker:()=>null,Polyline:()=>null,useMap:()=>state.map}));
afterEach(()=>{cleanup();vi.unstubAllGlobals()});
it('defers fitting a hidden map and focuses its selected marker when resized into view',()=>{
 let width=0,height=0;
 Object.defineProperties(state.container,{clientWidth:{configurable:true,get:()=>width},clientHeight:{configurable:true,get:()=>height}});
 vi.stubGlobal('ResizeObserver',class{constructor(callback:()=>void){state.resize.push(callback)}observe(){}disconnect(){}});
 vi.stubGlobal('requestAnimationFrame',(callback:()=>void)=>{callback();return 1});vi.stubGlobal('cancelAnimationFrame',vi.fn());
 render(<FleetMap vehicles={[{id:'v',latitude:28,longitude:77,vehicle_number:'TEST',fleet_status:'RUNNING'} as never]} selectedId="v" onSelect={()=>{}}/>);
 expect(state.map.setView).not.toHaveBeenCalled();expect(state.map.stop).toHaveBeenCalled();
 width=375;height=500;act(()=>state.resize.forEach(callback=>callback()));
 expect(state.map.setView).toHaveBeenCalledWith([28,77],15,{animate:false});
});
