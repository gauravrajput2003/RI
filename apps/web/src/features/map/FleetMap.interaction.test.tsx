import '@testing-library/jest-dom/vitest';
import {useState} from 'react';
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import type {FleetVehicle} from '../../types';
import {dateTime} from '../../lib/format';
import {FleetMap} from './MapSurface';
import L from 'leaflet';

const vehicle={id:'first',vehicle_number:'HR12AU6674',vehicle_type:'car',fleet_status:'STOPPED',latitude:28.868,longitude:76.5942,speed:0,today_distance_km:66.25,status_since_at:'2026-10-13T08:02:39Z',server_received_at:'2026-10-13T11:02:36Z',address:'Rohtak Jhajjar Rd',address_source:'cell',address_attribution:'OpenCellID'} as FleetVehicle;
const second={...vehicle,id:'second',vehicle_number:vehicle.vehicle_number,latitude:28.869,speed:45,today_distance_km:null,address:null};
function Fleet({vehicles=[vehicle,second]}:{vehicles?:FleetVehicle[]}){
 const [selected,setSelected]=useState<string|null>(null);
 return <FleetMap vehicles={vehicles} selectedId={selected} onSelect={setSelected}/>;
}
afterEach(()=>{cleanup();vi.restoreAllMocks()});

it('closes only the map popup when a separate close handler is provided',()=>{
 const onSelect=vi.fn(),onPopupClose=vi.fn();
 render(<FleetMap vehicles={[vehicle]} selectedId={vehicle.id} showPopup onSelect={onSelect} onPopupClose={onPopupClose}/>);
 fireEvent.click(screen.getByRole('button',{name:'Close vehicle details'}));
 expect(onPopupClose).toHaveBeenCalledOnce();
 expect(onSelect).not.toHaveBeenCalled();
});

it('updates a dashboard marker in place with its position, heading and backend status',()=>{
 const setPosition=vi.spyOn(L.Marker.prototype,'setLatLng');
 const setIcon=vi.spyOn(L.Marker.prototype,'setIcon');
 const addMarker=vi.spyOn(L.Marker.prototype,'addTo');
 const {container,rerender}=render(<Fleet vehicles={[{...vehicle,vehicle_type:'Bike',course:0}]}/>);
 const initialAdds=addMarker.mock.calls.length;
 expect(container.querySelector('.leaflet-marker-icon svg')).toHaveAttribute('viewBox','0 0 64 128');
 expect(container.querySelector('.leaflet-marker-icon')?.innerHTML).toContain('#ef4444');
 setPosition.mockClear();setIcon.mockClear();
 rerender(<Fleet vehicles={[{...vehicle,vehicle_type:'Bike',latitude:28.87,longitude:76.6,fleet_status:'RUNNING',course:90}]}/>);
 expect(setPosition).toHaveBeenCalledWith([28.87,76.6]);
 expect(setIcon).toHaveBeenCalled();
 expect(addMarker.mock.calls.length).toBe(initialAdds);
 expect(container.querySelector('.leaflet-marker-icon')?.innerHTML).toContain('rotate(90deg)');
 expect(container.querySelector('.leaflet-marker-icon')?.innerHTML).toContain('#22c55e');
});

it('uses actual Leaflet clicks to select by ID, persist, switch, toggle, and close without hover selection',()=>{
 const {container}=render(<Fleet/>);
 const markers=()=>container.querySelectorAll('.leaflet-marker-icon');
 fireEvent.mouseOver(markers()[0]);
 expect(screen.queryByRole('article')).not.toBeInTheDocument();
 fireEvent.click(markers()[0]);
 let popup=screen.getByRole('article');
 expect(within(popup).getByText('0 km/h')).toBeInTheDocument();
 fireEvent.mouseOut(markers()[0]);
 expect(screen.getByRole('article')).toBe(popup);
 fireEvent.mouseOver(markers()[1]);
 expect(within(popup).getByText('0 km/h')).toBeInTheDocument();
 fireEvent.click(popup);
 expect(screen.getByRole('article')).toBe(popup);
 fireEvent.click(markers()[1]);
 popup=screen.getByRole('article');
 expect(within(popup).getByText('45 km/h')).toBeInTheDocument();
 expect(within(popup).queryByText('0 km/h')).not.toBeInTheDocument();
 fireEvent.click(markers()[1]);
 expect(screen.queryByRole('article')).not.toBeInTheDocument();
 fireEvent.click(markers()[0]);
 fireEvent.click(screen.getByRole('button',{name:'Close vehicle details'}));
 expect(screen.queryByRole('article')).not.toBeInTheDocument();
});

it('renders all supplied field assets and API values, preserves GPS beside a cell address, and updates live',()=>{
 const {container,rerender}=render(<Fleet/>);
 fireEvent.click(container.querySelectorAll('.leaflet-marker-icon')[0]);
 const popup=screen.getByRole('article');
 for(const [label,asset] of [['Speed','speed'],['Today KM','km'],['Status','status'],['Since','since'],['Location','location'],['Last Update','time'],['Address','address']]){
  expect(within(popup).getByText(label).parentElement?.querySelector('img')).toHaveAttribute('src',`/assets/Map/${asset}.png`);
 }
 for(const value of ['66.3 km','STOPPED','28.86800, 76.59420','Rohtak Jhajjar Rd',dateTime(vehicle.status_since_at),dateTime(vehicle.server_received_at)])expect(within(popup).getByText(value)).toBeInTheDocument();
 rerender(<Fleet vehicles={[{...vehicle,speed:17,latitude:28.87},second]}/>);
 expect(within(screen.getByRole('article')).getByText('17 km/h')).toBeInTheDocument();
 expect(within(screen.getByRole('article')).getByText('28.87000, 76.59420')).toBeInTheDocument();
 rerender(<Fleet vehicles={[second]}/>);
 expect(screen.queryByRole('article')).not.toBeInTheDocument();
});

it('distinguishes missing telemetry from actual zero and hides a popup when its GPS becomes unavailable',()=>{
 const {container,rerender}=render(<Fleet vehicles={[{...vehicle,speed:null,today_distance_km:null,status_since_at:null,server_received_at:null,address:null}]}/>);
 fireEvent.click(container.querySelector('.leaflet-marker-icon')!);
 let popup=screen.getByRole('article');
 expect(within(popup).getAllByText('Unavailable')).toHaveLength(5);
 expect(within(popup).queryByText('0.0 km')).not.toBeInTheDocument();
 rerender(<Fleet vehicles={[{...vehicle,today_distance_km:0}]}/>);
 popup=screen.getByRole('article');
 expect(within(popup).getByText('0.0 km')).toBeInTheDocument();
 rerender(<Fleet vehicles={[{...vehicle,latitude:null,longitude:null}]}/>);
 expect(screen.queryByRole('article')).not.toBeInTheDocument();
});

it('keeps table selection separate from popup opening and lets the first marker click open that selected vehicle',()=>{
 const onSelect=vi.fn();
 const {container,rerender}=render(<FleetMap vehicles={[vehicle]} selectedId={vehicle.id} showPopup={false} onSelect={onSelect}/>);
 expect(screen.queryByRole('article')).not.toBeInTheDocument();
 fireEvent.click(container.querySelector('.leaflet-marker-icon')!);
 expect(onSelect).toHaveBeenCalledWith(vehicle.id);
 rerender(<FleetMap vehicles={[vehicle]} selectedId={vehicle.id} showPopup onSelect={onSelect}/>);
 expect(screen.getByRole('article')).toBeInTheDocument();
});
