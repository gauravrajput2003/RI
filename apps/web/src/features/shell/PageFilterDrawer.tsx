import type {ReactNode} from 'react';
import {usePageFilterDrawer} from './pageFilterContext';

export function PageFilterDrawer({title,children,ariaLabel=`${title} filters`}:{title:string;children:ReactNode;ariaLabel?:string}){
  const {open}=usePageFilterDrawer();
  if(!open)return null;
  return <aside className="page-filter-drawer" aria-label={ariaLabel}>
    {title&&<strong className="page-filter-title">{title}</strong>}
    {children}
  </aside>;
}
