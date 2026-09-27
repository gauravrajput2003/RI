import {useMemo,useState} from 'react';
import {ChevronDown} from 'lucide-react';

const options=[{value:'true',label:'Active'},{value:'false',label:'InActive'}];

export function StatusFilterSelect({value,onChange}:{value:string;onChange:(value:string)=>void}){
 const [open,setOpen]=useState(false);
 const [search,setSearch]=useState('');
 const selected=options.find(option=>option.value===value)?.label||'Select Status';
 const visible=useMemo(()=>options.filter(option=>option.label.toLowerCase().includes(search.trim().toLowerCase())),[search]);
 return <div className="drawer-select">
  <button type="button" className="drawer-select-trigger" aria-haspopup="listbox" aria-expanded={open} onClick={()=>setOpen(current=>!current)}><span>{selected}</span><ChevronDown className={open?'open':''}/></button>
  {open&&<div className="drawer-select-menu" role="listbox" aria-label="Status options">
   <input autoFocus value={search} onChange={event=>setSearch(event.target.value)} aria-label="Search status options"/>
   {visible.map(option=><button type="button" role="option" aria-selected={value===option.value} className={value===option.value?'selected':''} key={option.value} onClick={()=>{onChange(option.value);setOpen(false);setSearch('')}}>{option.label}</button>)}
  </div>}
 </div>;
}
