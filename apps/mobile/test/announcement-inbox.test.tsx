import React from 'react';
import {act,create,type ReactTestRenderer} from 'react-test-renderer';
import {beforeEach,expect,it,vi} from 'vitest';
import {AnnouncementDialog} from '../components/fleet/AnnouncementDialog';
import AnnouncementCenter from '../app/(app)/announcement-center';
import type {MobileAnnouncement} from '../services/api/announcements';

const state=vi.hoisted(()=>({read:vi.fn(),hide:vi.fn(),invalidate:vi.fn(),replace:vi.fn(),refetch:vi.fn()}));
const notice:MobileAnnouncement={id:'same-web-id',title:'Service notice',bodyHtml:'<p>Tracker maintenance</p>',messageType:'TEXT',imageUrl:null,createdAt:'2026-10-07T12:00:00Z',updatedAt:'2026-10-07T12:00:00Z',startsAt:'2026-10-07T12:00:00Z',endsAt:'2026-10-08T12:00:00Z',dontShowAgain:true,readAt:null,unread:true,dismissed:false};
vi.mock('../services/api/announcements',()=>({announcementInboxKey:['mobile-announcement-inbox'],readAnnouncement:state.read,hideAnnouncementPopup:state.hide}));
vi.mock('../services/api/mobile',()=>({useAccount:()=>({data:{role:'CLIENT'}}),mobileMessage:(e:Error)=>e.message,requireOnline:vi.fn()}));
vi.mock('@tanstack/react-query',()=>{const cache={invalidateQueries:state.invalidate};return {useQueryClient:()=>cache}});
vi.mock('../features/announcements/inbox',()=>({useAnnouncementInbox:()=>({data:{data:[notice],unreadCount:1},isLoading:false,isFetching:false,refetch:state.refetch})}));
vi.mock('expo-router',()=>({router:{replace:state.replace}}));
vi.mock('@expo/vector-icons',()=>({Feather:'Icon'}));
vi.mock('react-native',()=>({Image:'Image',Modal:'Modal',Pressable:'Pressable',Text:'Text',TextInput:'TextInput',View:'View',ScrollView:'ScrollView',ActivityIndicator:'ActivityIndicator',KeyboardAvoidingView:'KeyboardAvoidingView',Platform:{OS:'android'},StyleSheet:{create:(s:unknown)=>s},FlatList:({data,renderItem,ListEmptyComponent}:{data:MobileAnnouncement[];renderItem:(props:{item:MobileAnnouncement})=>React.ReactNode;ListEmptyComponent:React.ReactNode})=><>{data.length?data.map(item=><React.Fragment key={item.id}>{renderItem({item})}</React.Fragment>):ListEmptyComponent}</>}));
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
beforeEach(()=>{vi.clearAllMocks();state.read.mockResolvedValue(undefined);state.hide.mockResolvedValue(undefined);state.invalidate.mockResolvedValue(undefined)});

it('marks the same received ID read, persists popup opt-out and refreshes the server count',async()=>{
 let tree!:ReactTestRenderer;const close=vi.fn();
 await act(async()=>{tree=create(<AnnouncementDialog item={notice} onClose={close}/>)});
 expect(state.read).toHaveBeenCalledWith('same-web-id');
 expect(JSON.stringify(tree.toJSON())).toContain('Tracker maintenance');
 await act(async()=>tree.root.findByProps({accessibilityRole:'checkbox'}).props.onPress());
 await act(async()=>tree.root.findByProps({accessibilityLabel:'Close announcement'}).props.onPress());
 expect(state.hide).toHaveBeenCalledWith('same-web-id');expect(close).toHaveBeenCalledOnce();expect(state.invalidate).toHaveBeenCalledWith({queryKey:['mobile-announcement-inbox']});
 await act(async()=>tree.unmount());
});
it('shows read failures and does not silently close when persistence fails',async()=>{
 state.read.mockRejectedValue(new Error('Connection unavailable'));let tree!:ReactTestRenderer;const close=vi.fn();
 await act(async()=>{tree=create(<AnnouncementDialog item={notice} onClose={close}/>)});
 await act(async()=>tree.root.findByProps({accessibilityLabel:'Close announcement'}).props.onPress());
 expect(JSON.stringify(tree.toJSON())).toContain('Connection unavailable');expect(close).not.toHaveBeenCalled();
 await act(async()=>tree.unmount());
});
it('lets a Client search and open the received record without management actions',async()=>{
 let tree!:ReactTestRenderer;await act(async()=>{tree=create(<AnnouncementCenter/>)});
 expect(JSON.stringify(tree.toJSON())).toContain('Service notice');expect(JSON.stringify(tree.toJSON())).not.toContain('Add Announcement');
 await act(async()=>tree.root.findByProps({accessibilityLabel:'Search announcements'}).props.onChangeText('unmatched'));
 expect(JSON.stringify(tree.toJSON())).toContain('No announcements found.');
 await act(async()=>tree.root.findByProps({accessibilityLabel:'Search announcements'}).props.onChangeText('maintenance'));
 await act(async()=>tree.root.findByProps({accessibilityLabel:'Read announcement: Service notice'}).props.onPress());
 expect(state.read).toHaveBeenCalledWith('same-web-id');
 await act(async()=>tree.root.findByProps({accessibilityLabel:'Close Announcement Center'}).props.onPress());expect(state.replace).toHaveBeenCalledWith('/(app)');
 await act(async()=>tree.unmount());
});
