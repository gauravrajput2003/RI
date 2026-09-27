import {api} from './client';

export interface MobileAnnouncement {
  id:string;
  title:string;
  bodyHtml:string;
  startsAt:string;
  endsAt:string;
  dontShowAgain:boolean;
}
interface Envelope<T>{success:boolean;data:T}

export async function getCurrentAnnouncements(signal?:AbortSignal){
  return (await api.get<Envelope<MobileAnnouncement[]>>('/announcements/current',{signal})).data.data;
}

export async function dismissAnnouncement(id:string){
  await api.post(`/announcements/${encodeURIComponent(id)}/dismiss`);
}
