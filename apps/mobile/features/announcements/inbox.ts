import {useCallback} from 'react';
import {useFocusEffect} from 'expo-router';
import {useQuery} from '@tanstack/react-query';
import {useAccount} from '../../services/api/mobile';
import {announcementInboxKey,getMyAnnouncements} from '../../services/api/announcements';
import {config} from '../../constants/config';

export function useAnnouncementInbox(){
 const account=useAccount();
 const enabled=Boolean(account.data?.id)&&!config.demoMode;
 const query=useQuery({queryKey:[...announcementInboxKey,account.data?.id],enabled,
  queryFn:({signal})=>getMyAnnouncements(signal),staleTime:0,refetchInterval:15_000,
  refetchOnWindowFocus:'always',refetchOnReconnect:'always'});
 const {refetch}=query;
 useFocusEffect(useCallback(()=>{if(enabled)void refetch()},[enabled,refetch]));
 return query;
}
