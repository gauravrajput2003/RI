import React from 'react';
import {act,create,type ReactTestRenderer} from 'react-test-renderer';
import {expect,it,vi} from 'vitest';
import {FleetHeader} from './Header';

vi.mock('@tanstack/react-query',()=>({useQuery:()=>({data:[{id:'notice-1',title:'Service notice',bodyHtml:'<p>Tracker maintenance tonight</p>',startsAt:'2026-09-26T00:00:00Z',endsAt:'2026-09-27T00:00:00Z',dontShowAgain:true}],isError:false}),useMutation:()=>({mutate:vi.fn(),isPending:false}),useQueryClient:()=>({invalidateQueries:vi.fn()})}));
vi.mock('../../constants/config',()=>({config:{demoMode:false}}));
vi.mock('../../services/api/announcements',()=>({getCurrentAnnouncements:vi.fn(),dismissAnnouncement:vi.fn()}));
vi.mock('expo-router',()=>({router:{push:vi.fn()}}));
vi.mock('@expo/vector-icons',()=>({Feather:'Icon'}));
vi.mock('./Sheet',async()=>{const {createElement,Fragment}=await import('react');return{Sheet:({visible,title,children}:{visible:boolean;title?:string;children:React.ReactNode})=>visible?createElement(Fragment,null,createElement('SheetTitle',null,title),children):null,NoticeSheet:()=>null}});
vi.mock('react-native',()=>({Pressable:'Pressable',Text:'Text',View:'View',StyleSheet:{create:(styles:unknown)=>styles}}));
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});

it('automatically opens an announcement returned for the signed-in account',async()=>{let tree!:ReactTestRenderer;await act(async()=>{tree=create(<FleetHeader title="Dashboard"/>)});const output=JSON.stringify(tree.toJSON());expect(output).toContain('Service notice');expect(output).toContain('Tracker maintenance tonight');expect(output).toContain('1');await act(async()=>tree.unmount())});
