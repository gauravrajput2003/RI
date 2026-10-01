import {SearchableSelect} from '../../components/ui/SearchableSelect';
const options=[{value:'true',label:'Active'},{value:'false',label:'InActive'}];
export function StatusFilterSelect({value,onChange}:{value:string;onChange:(value:string)=>void}){
 return <div className="drawer-select"><SearchableSelect aria-label="Status" value={value} onChange={onChange} placeholder="Select Status" options={options} isClearable/></div>;
}
