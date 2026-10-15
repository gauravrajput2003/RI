import React from 'react';
import {act,create,type ReactTestRenderer} from 'react-test-renderer';
import {it,expect,vi} from 'vitest';
import {VehicleMarker,type MapVehicle} from './VehicleMarker';
import {STATUS_COLORS} from '../utils/vehicleIcons';
vi.mock('react-native-svg',()=>({SvgXml:'SvgXml'}));
vi.mock('../features/map/LeafletMap',()=>({Marker:'Marker'}));
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
it('provides platform-independent map SVGs for four statuses and cardinal headings',async()=>{
 const press=vi.fn();const examples=[['MOVING','running','bike',0],['IDLE','idle','scooty',90],['STOPPED','stopped','car',180],['OFFLINE','unreachable','truck',270]] as const;
 let tree!:ReactTestRenderer;await act(async()=>{tree=create(<>{examples.map(([state,,type,heading],index)=><VehicleMarker key={index} vehicle={{id:String(index),vehicle_number:`TEST-${index}`,latitude:28,longitude:76,type,state,heading,speed:index}} onPress={press}/>)}</>);});
 const markers=tree.root.findAllByType('Marker' as React.ElementType);
 for(let index=0;index<examples.length;index++){
  const marker=markers[index],example=examples[index];expect(marker.props.rotation).toBe(example[3]);expect(marker.props.svg).toContain(STATUS_COLORS[example[1]].main);expect(marker.props.svg).not.toContain('{{');
  expect(marker.props.title).toContain(`TEST-${index}`);expect(marker.props.title).toContain(example[1]);expect(marker.props.iconSize[1]).toBeGreaterThan(marker.props.iconSize[0]);
 }
 await act(async()=>markers[0].props.onPress());expect(press).toHaveBeenCalledOnce();
 await act(async()=>tree.unmount());
});
it('updates status, heading and coordinates in place without recoloring selection',async()=>{
 const press=vi.fn(),vehicle:MapVehicle={id:'stable',latitude:28,longitude:76,type:'auto',state:'IDLE',course:90,speed:0};
 let tree!:ReactTestRenderer;await act(async()=>{tree=create(<VehicleMarker vehicle={vehicle} onPress={press}/>);});
 const marker=tree.root.findByType('Marker' as React.ElementType);
 await act(async()=>tree.update(<VehicleMarker vehicle={{...vehicle,latitude:29,state:'MOVING',course:270,speed:12}} selected onPress={press}/>));
 expect(tree.root.findByType('Marker' as React.ElementType)).toBe(marker);expect(marker.props.coordinate.latitude).toBe(29);expect(marker.props.rotation).toBe(270);expect(marker.props.pinColor).toBe(STATUS_COLORS.running.main);expect(marker.props.iconSize).toEqual([32,58]);
 await act(async()=>tree.unmount());
});
