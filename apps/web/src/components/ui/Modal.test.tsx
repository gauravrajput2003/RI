import {StrictMode} from 'react';
import {cleanup,render} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {Modal} from './Modal';

afterEach(()=>{cleanup();document.body.style.overflow=''});

function Dialogs({first,second=false}:{first:boolean;second?:boolean}){
 return <StrictMode><Modal open={first} title="Edit client" onClose={vi.fn()}>Form</Modal><Modal open={second} title="Preview client" onClose={vi.fn()}>Preview</Modal></StrictMode>;
}

it('releases scrolling after an admin closes a form with another closed dialog mounted',()=>{
 const view=render(<Dialogs first={false}/>);
 view.rerender(<Dialogs first/>);
 expect(document.body.style.overflow).toBe('hidden');
 view.rerender(<Dialogs first={false}/>);
 expect(document.body.style.overflow).toBe('');
 view.unmount();
 expect(document.body.style.overflow).toBe('');
});

it('keeps scrolling locked until the final open dialog closes, in either order',()=>{
 document.body.style.overflow='auto';
 const view=render(<Dialogs first/>);
 view.rerender(<Dialogs first second/>);
 view.rerender(<Dialogs first={false} second/>);
 expect(document.body.style.overflow).toBe('hidden');
 view.rerender(<Dialogs first={false}/>);
 expect(document.body.style.overflow).toBe('auto');
 view.rerender(<Dialogs first second/>);
 view.rerender(<Dialogs first/>);
 expect(document.body.style.overflow).toBe('hidden');
 view.unmount();
 expect(document.body.style.overflow).toBe('auto');
});
