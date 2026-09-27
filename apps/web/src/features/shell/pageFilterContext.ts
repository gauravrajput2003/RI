import {createContext,useContext,useState} from 'react';

export interface PageFilterController {
  open:boolean;
  setOpen:(open:boolean)=>void;
  toggle:()=>void;
  close:()=>void;
}

export const PageFilterContext=createContext<PageFilterController|null>(null);

export function usePageFilterDrawer(initialOpen=false):PageFilterController{
  const shared=useContext(PageFilterContext);
  const [localOpen,setLocalOpen]=useState(initialOpen);
  if(shared)return shared;
  return {open:localOpen,setOpen:setLocalOpen,toggle:()=>setLocalOpen(value=>!value),close:()=>setLocalOpen(false)};
}
