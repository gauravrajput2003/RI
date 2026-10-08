import {api} from './client';

export interface MobileAnnouncement {
  id:string;
  title:string;
  bodyHtml:string|null;
  messageType:'TEXT'|'IMAGE';
  imageUrl:string|null;
  createdAt:string;
  updatedAt:string;
  readAt:string|null;
  unread:boolean;
  dismissed:boolean;
  startsAt:string;
  endsAt:string;
  dontShowAgain:boolean;
}
interface Envelope<T>{success:boolean;data:T}
export interface AnnouncementInbox extends Envelope<MobileAnnouncement[]>{unreadCount:number}
export const announcementInboxKey=['mobile-announcement-inbox'] as const;
export async function getMyAnnouncements(signal?:AbortSignal){
  return (await api.get<AnnouncementInbox>('/announcements/my',{signal})).data;
}
export async function readAnnouncement(id:string){await api.post(`/announcements/${encodeURIComponent(id)}/read`)}
export async function hideAnnouncementPopup(id:string){await api.post(`/announcements/${encodeURIComponent(id)}/hide-popup`)}

export async function getCurrentAnnouncements(signal?:AbortSignal){
  return (await api.get<Envelope<MobileAnnouncement[]>>('/announcements/current',{signal})).data.data;
}

export async function dismissAnnouncement(id:string){
  await api.post(`/announcements/${encodeURIComponent(id)}/dismiss`);
}
