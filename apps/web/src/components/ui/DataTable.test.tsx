import '@testing-library/jest-dom/vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {DataTable,type Column} from './DataTable';
afterEach(cleanup);
type Row={id:string;name:string};
const rows=[{id:'b',name:'Beta'},{id:'a',name:'Alpha'}];
const columns:Column<Row>[]=[{key:'name',label:'Name',sortValue:r=>r.name,render:r=>r.name},...Array.from({length:7},(_,i)=>({key:String(i),label:`Detail ${i}`,render:(r:Row)=>r.id}))];
it('keeps sorting and keyboard row selection available in heavy table cards',()=>{
 const select=vi.fn();const {container}=render(<DataTable columns={columns} rows={rows} onSelect={select}/>);
 expect(container.querySelector('.table-mobile-cards')).toBeInTheDocument();
 fireEvent.change(screen.getByLabelText('Sort rows'),{target:{value:'name:asc'}});
 const first=container.querySelector('tbody tr')!;
 expect(first.querySelector('[data-label="Name"]')).toHaveTextContent('Alpha');
 fireEvent.keyDown(first,{key:'Enter'});expect(select).toHaveBeenCalledWith(rows[1]);
 fireEvent.change(screen.getByLabelText('Sort rows'),{target:{value:'name:desc'}});
 expect(container.querySelector('tbody tr [data-label="Name"]')).toHaveTextContent('Beta');
});
it('leaves simple tables scrollable without the card sort control',()=>{
 const {container}=render(<DataTable columns={columns.slice(0,5)} rows={rows}/>);
 expect(container.querySelector('.table-scroll')).toBeInTheDocument();
 expect(container.querySelector('.table-mobile-cards')).not.toBeInTheDocument();
 expect(screen.queryByLabelText('Sort rows')).not.toBeInTheDocument();
});
