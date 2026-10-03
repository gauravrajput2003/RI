import {X} from 'lucide-react';
import type {ReactNode} from 'react';
import {usePageFilterDrawer} from './pageFilterContext';

export function PageFilterDrawer({title,children,ariaLabel=`${title} filters`}:{title:string;children:ReactNode;ariaLabel?:string}){
  const {open,close}=usePageFilterDrawer();
  if(!open)return null;
  return <><button type="button" className="filter-drawer-scrim" onClick={close} aria-label="Close filters backdrop"/><aside className="page-filter-drawer" aria-label={ariaLabel}>
    <header className="filter-drawer-heading"><strong className="page-filter-title">{title||'Filters'}</strong><button type="button" className="icon-button" onClick={close} aria-label="Close filters"><X/></button></header>
    {children}
  </aside></>;
}
