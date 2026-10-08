import {useEffect,type ReactNode} from 'react';
import {X} from 'lucide-react';

const scrollLocks=new WeakMap<HTMLElement,{count:number;overflow:string}>();

export function Modal({open,title,children,onClose,className=''}:{open:boolean;title:string;children:ReactNode;onClose:()=>void;className?:string}){
 useEffect(()=>{
  if(!open)return;
  const body=document.body;
  let lock=scrollLocks.get(body);
  if(!lock){lock={count:0,overflow:body.style.overflow};scrollLocks.set(body,lock)}
  lock.count++;
  body.style.overflow='hidden';
  return()=>{
   lock.count--;
   if(lock.count===0){body.style.overflow=lock.overflow;scrollLocks.delete(body)}
  };
 },[open]);
 useEffect(()=>{
  if(!open)return;
  const close=(event:KeyboardEvent)=>{if(event.key==='Escape')onClose()};
  window.addEventListener('keydown',close);
  return()=>window.removeEventListener('keydown',close);
 },[open,onClose]);
 if(!open)return null;
 return <div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}><section className={`modal ${className}`.trim()} role="dialog" aria-modal="true" aria-labelledby="modal-title"><header><h2 id="modal-title">{title}</h2><button type="button" className="icon-button" onClick={onClose} aria-label="Close dialog"><X/></button></header>{children}</section></div>;
}
