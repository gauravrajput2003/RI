import React from 'react';
import {act,create,type ReactTestRenderer} from 'react-test-renderer';
import {beforeEach,expect,it,vi} from 'vitest';
import {FleetHeader} from './Header';

const state=vi.hoisted(()=>({role:'CLIENT',unread:true,push:vi.fn()}));
vi.mock('../../features/announcements/inbox',()=>({useAnnouncementInbox:()=>({data:{data:[{id:'notice-1',title:'Service notice',bodyHtml:'Tracker maintenance tonight',updatedAt:'2026-10-07',unread:state.unread,dismissed:false}],unreadCount:state.unread?7:0},isError:false})}));
vi.mock('./AnnouncementDialog',()=>({AnnouncementDialog:({item,onClose}:{item:{title:string;bodyHtml:string}|null;onClose():void})=>item?<><div>{item.title}{item.bodyHtml}</div><button onClick={onClose}>Close notice</button></>:null}));
vi.mock('../../constants/config',()=>({config:{demoMode:false}}));
vi.mock('../../services/api/announcements',()=>({getCurrentAnnouncements:vi.fn(),dismissAnnouncement:vi.fn()}));
vi.mock('../../services/api/mobile',()=>({useAccount:()=>({data:{id:'recipient',role:state.role,permissions:[]}})}));
vi.mock('expo-router',async()=>{const {useEffect}=await import('react');return {router:{push:state.push},useFocusEffect:useEffect}});
vi.mock('@expo/vector-icons',()=>({Feather:'Icon',FontAwesome6:'Icon',MaterialCommunityIcons:'Icon'}));
vi.mock('./Sheet',async()=>{const {createElement,Fragment}=await import('react');return{Sheet:({visible,title,children}:{visible:boolean;title?:string;children:React.ReactNode})=>visible?createElement(Fragment,null,createElement('SheetTitle',null,title),children):null,NoticeSheet:()=>null}});
vi.mock('react-native',()=>({Pressable:'Pressable',Text:'Text',View:'View',StyleSheet:{create:(styles:unknown)=>styles}}));
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});

beforeEach(()=>{state.role='CLIENT';state.unread=true;state.push.mockClear()});
it.each(['CLIENT','ADMIN'])('opens received notices for %s independently of management grants and uses the backend unread count',async role=>{state.role=role;let tree!:ReactTestRenderer;await act(async()=>{tree=create(<FleetHeader title="Dashboard"/>)});const output=JSON.stringify(tree.toJSON());expect(output).toContain('Service notice');expect(output).toContain('Tracker maintenance tonight');const icon=tree.root.findByProps({accessibilityLabel:'Announcements, 7 unread'});await act(async()=>icon.props.onPress());expect(state.push).toHaveBeenCalledWith('/(app)/announcement-center');await act(async()=>tree.unmount())});
it('does not automatically reopen a read notice but retains the recipient inbox icon',async()=>{state.unread=false;let tree!:ReactTestRenderer;await act(async()=>{tree=create(<FleetHeader title="Dashboard"/>)});expect(JSON.stringify(tree.toJSON())).not.toContain('Tracker maintenance tonight');expect(tree.root.findByProps({accessibilityLabel:'Announcements'})).toBeTruthy();await act(async()=>tree.unmount())});
