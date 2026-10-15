import React from 'react';
import {act,create,type ReactTestRenderer} from 'react-test-renderer';
import {it,expect,vi} from 'vitest';
import {PlaybackStatsGrid} from './PlaybackStatsGrid';
vi.mock('react-native',()=>({View:'View',Text:'Text',StyleSheet:{create:(styles:unknown)=>styles}}));
vi.mock('@expo/vector-icons',()=>({MaterialCommunityIcons:'Icon'}));
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
const stats={kmTravelled:8.23,totalRunningSeconds:2291,avgSpeedKmh:13,haltCount:6,totalStoppageSeconds:43474,maxSpeedKmh:45,halts:[]};
it('pairs all six headings with the correct values in two compact rows',async()=>{
 let tree!:ReactTestRenderer;await act(async()=>{tree=create(<PlaybackStatsGrid stats={stats} hasRecordings/>);});
 const expected=['KM Travelled: 8.23 KM','Total Running: 0:38:11','Avg Speed: 13 KMH','Halt Count: 6','Total Stoppage: 12:04:34','Max Speed: 45 KMH'];
 for(const label of expected)expect(tree.root.findAllByProps({accessibilityLabel:label})).toHaveLength(1);
 for(const index of [0,1]){const row=tree.root.findByProps({testID:`playback-stats-row-${index}`});expect(row.props.style.height).toBe(52);expect(row.props.style.flexShrink).toBe(0);}
 await act(async()=>tree.unmount());
});
it('preserves all six labels when there are no recordings',async()=>{
 let tree!:ReactTestRenderer;await act(async()=>{tree=create(<PlaybackStatsGrid stats={stats} hasRecordings={false}/>);});
 const cells=tree.root.findAll(node=>typeof node.props.testID==='string'&&/^playback-stat-/.test(node.props.testID));expect(cells).toHaveLength(6);for(const cell of cells)expect(cell.props.accessibilityLabel).toContain('Unavailable');
 await act(async()=>tree.unmount());
});
