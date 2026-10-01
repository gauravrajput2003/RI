import '@testing-library/jest-dom/vitest';
import {fireEvent,render,screen} from '@testing-library/react';
import {expect,it,vi} from 'vitest';
import {SearchableSelect} from './SearchableSelect';

it('filters case insensitively, supports keyboard selection, and keeps a required value',()=>{
 const onChange=vi.fn();
 const {container}=render(<SearchableSelect aria-label="Vehicle Type" required value="" onChange={onChange} placeholder="Select Vehicle" options={[{value:'Bike',label:'Bike'},{value:'Car',label:'Car'},{value:'EVCar',label:'EVCar'}]}/>);
 fireEvent.click(screen.getByRole('combobox',{name:'Vehicle Type'}));
 fireEvent.change(screen.getByRole('textbox',{name:'Search Vehicle Type'}),{target:{value:'CA'}});
 expect(screen.getAllByRole('option').map(option=>option.textContent)).toEqual(['Car','EVCar']);
 fireEvent.keyDown(screen.getByRole('textbox',{name:'Search Vehicle Type'}),{key:'ArrowDown'});
 fireEvent.keyDown(screen.getByRole('textbox',{name:'Search Vehicle Type'}),{key:'Enter'});
 expect(onChange).toHaveBeenCalledWith('EVCar');
 expect(container.querySelector('.searchable-select-required')).toBeRequired();
});
