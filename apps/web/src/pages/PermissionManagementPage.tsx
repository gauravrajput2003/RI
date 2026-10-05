import {useEffect,useMemo,useRef,useState} from 'react';
import {useBlocker,useBeforeUnload} from 'react-router-dom';
import {useMutation,useQuery} from '@tanstack/react-query';
import {Search,ShieldCheck,Save,RotateCcw,Users,ChevronDown,CheckCircle2,X,SlidersHorizontal} from 'lucide-react';
import {api,errorMessage} from '../services/api/client';
import {Modal} from '../components/ui/Modal';
import {StatePanel} from '../components/ui/StatePanel';
import {SearchableSelect} from '../components/ui/SearchableSelect';
import type {Admin,Envelope} from '../types';
import type {PermissionDefinition,PermissionKey} from '../../../../packages/shared-types/src/permissions';
import {permissionKeys} from '../../../../packages/shared-types/src/permissions';
import '../features/permissions/permissions.css';

type Target={id:string;version:number};
type Detail={admin:Pick<Admin,'id'|'name'|'username'|'email'|'mobile'|'active'|'created_at'>;permissions:PermissionKey[];version:number;targets?:Target[]};
function GroupCheckbox({keys,selected,onChange,label,ariaLabel,disabled}:{keys:PermissionKey[];selected:PermissionKey[];onChange:(keys:PermissionKey[],checked:boolean)=>void;label:string;ariaLabel?:string;disabled:boolean}){
  const input=useRef<HTMLInputElement>(null),count=keys.filter(key=>selected.includes(key)).length;
  useEffect(()=>{if(input.current)input.current.indeterminate=count>0&&count<keys.length},[count,keys.length]);
  return <label className="permission-group-toggle"><input ref={input} type="checkbox" aria-label={ariaLabel??label} aria-checked={count>0&&count<keys.length?'mixed':count===keys.length} checked={count===keys.length} disabled={disabled} onChange={e=>onChange(keys,e.target.checked)}/>{label}</label>;
}
export function PermissionManagementPage(){
  const [search,setSearch]=useState(''),[debounced,setDebounced]=useState(''),[page,setPage]=useState(1),[adminId,setAdminId]=useState(''),[tab,setTab]=useState<'modules'|'actions'>('modules');
  const [draft,setDraft]=useState<PermissionKey[]>([]),[baseline,setBaseline]=useState<Detail|null>(null),[message,setMessage]=useState(''),[issue,setIssue]=useState('');
  const [confirmation,setConfirmation]=useState<'reset'|'clear'|'cancel'|'apply-all'|null>(null),[pendingAdmin,setPendingAdmin]=useState<string|null>(null);
  const [permissionSearch,setPermissionSearch]=useState(''),[collapsed,setCollapsed]=useState<Set<string>>(new Set()),[bulkRequested,setBulkRequested]=useState(false),[bulkOpen,setBulkOpen]=useState(false);
  const allAdmins=adminId==='all';
  useEffect(()=>{if(allAdmins&&bulkRequested){setBulkOpen(true);setBulkRequested(false)}},[allAdmins,bulkRequested]);
  useEffect(()=>{const timer=setTimeout(()=>{setDebounced(search);setPage(1)},300);return()=>clearTimeout(timer)},[search]);
  const catalogue=useQuery({queryKey:['permission-catalogue'],queryFn:async()=>(await api.get<Envelope<PermissionDefinition[]>>('/super-admin/permissions/catalogue')).data.data});
  const admins=useQuery({queryKey:['permission-admins',debounced,page],queryFn:async()=>(await api.get<Envelope<Admin[]>>('/super-admin/permissions/admins',{params:{search:debounced,page,pageSize:25}})).data});
  const detail=useQuery({queryKey:['admin-permissions',adminId],enabled:!!adminId,queryFn:async():Promise<Detail>=>{
    if(!allAdmins)return (await api.get<Envelope<Detail>>(`/super-admin/permissions/${adminId}`)).data.data;
    const {targets}=(await api.get<Envelope<{targets:Target[]}>>('/super-admin/permissions/all')).data.data;
    return {admin:{id:'all',name:'All admins',username:`${targets.length} Admin accounts`,email:'All pages · includes inactive admins',mobile:null,active:true,created_at:''},permissions:[...permissionKeys],version:0,targets};
  },staleTime:0});
  useEffect(()=>{setBaseline(null);setDraft([]);setMessage('');setIssue('')},[adminId]);
  useEffect(()=>{if(detail.data&&!baseline){setBaseline(detail.data);setDraft(detail.data.permissions)}},[detail.data,baseline]);
  const dirty=!!baseline&&JSON.stringify([...draft].sort())!==JSON.stringify([...baseline.permissions].sort());
  const blocker=useBlocker(dirty);
  useBeforeUnload(event=>{if(dirty){event.preventDefault();event.returnValue=''}});
  const definitions=catalogue.data??[],views=definitions.filter(d=>d.action==='view'&&d.path),groups=useMemo(()=>[...new Set(views.map(d=>d.group))],[catalogue.data]);
  const resources=[...new Set(definitions.map(d=>d.resource))],busy=detail.isFetching;
  function change(keys:PermissionKey[],checked:boolean){
    setMessage('');setIssue('');
    setDraft(current=>{
      const next=new Set(current);
      for(const key of keys){
        const definition=definitions.find(d=>d.key===key)!;
        if(checked){next.add(key);const view=definitions.find(d=>d.resource===definition.resource&&d.action==='view');if(view)next.add(view.key)}
        else{next.delete(key);if(definition.action==='view')for(const child of definitions.filter(d=>d.resource===definition.resource))next.delete(child.key)}
      }
      return [...next];
    });
  }
  const save=useMutation({mutationFn:async()=>{
    if(!allAdmins)return (await api.put<Envelope<Detail>>(`/super-admin/permissions/${adminId}`,{permissions:draft,version:baseline!.version})).data.data;
    const result=(await api.put<Envelope<{targets:Target[]}>>('/super-admin/permissions/all',{permissions:draft,targets:baseline!.targets})).data.data;
    return {...baseline!,permissions:[...draft],targets:result.targets};
  },onSuccess:data=>{setBaseline(data);setDraft(data.permissions);setMessage(allAdmins?`Permissions updated successfully for ${data.targets!.length} admins.`:'Permissions updated successfully.');setIssue('')},onError:error=>setIssue('Unable to update permissions. '+errorMessage(error))});
  const disabled=busy||save.isPending||!baseline;
  const choose=(id:string)=>{if(dirty){setPendingAdmin(id);return}setAdminId(id);setBaseline(null)};
  const options=[...(admins.data?.data??[])];if(baseline&&!allAdmins&&!options.some(a=>a.id===baseline.admin.id))options.unshift(baseline.admin as Admin);
  const confirmAction=()=>{if(confirmation==='apply-all')save.mutate();if(confirmation==='reset')setDraft(definitions.map(d=>d.key));if(confirmation==='clear')setDraft([]);if(confirmation==='cancel'&&baseline)setDraft(baseline.permissions);setConfirmation(null);setIssue('');setMessage('')};
  const selected=new Set(draft),fullAccess=definitions.length>0&&definitions.every(d=>selected.has(d.key));
  const enabledCount=definitions.filter(d=>selected.has(d.key)).length;
  const term=permissionSearch.trim().toLocaleLowerCase();
  const matches=(d:PermissionDefinition)=>!term||`${d.label} ${d.group} ${d.resource} ${d.action}`.toLocaleLowerCase().includes(term);
  const visibleGroups=groups.filter(group=>views.some(d=>d.group===group&&matches(d)));
  const visibleResources=resources.filter(resource=>definitions.some(d=>d.resource===resource&&matches(d)));
  const adminName=allAdmins?'All admins':baseline?.admin.name||baseline?.admin.username||'this Admin';
  const initials=(baseline?.admin.name||baseline?.admin.username||'Admin').split(/\s+/).map(word=>word[0]).slice(0,2).join('').toUpperCase();
  const canSave=!disabled&&(allAdmins?!!baseline?.targets?.length:dirty);
  const actionDescriptions={view:'Allow this Admin to view records.',add:'Allow this Admin to create new records.',edit:'Allow this Admin to modify existing records.',delete:'Allow this Admin to delete records.'};
  const requestSave=()=>allAdmins?setConfirmation('apply-all'):save.mutate();
  const toggleGroup=(group:string)=>setCollapsed(current=>{const next=new Set(current);if(next.has(group))next.delete(group);else next.add(group);return next});
  return <section className="page permission-page" aria-label="Admin access control">
    <header className="permission-control-bar">
      <div className="permission-brand"><span className="permission-shield"><ShieldCheck size={20}/></span><div><h1>Access Control</h1><p>Admin workspace permissions</p></div></div>
      <div className="permission-admin-picker"><span className="permission-field-label">Admin</span><div className="permission-picker-control"><Search size={16}/><SearchableSelect aria-label="Select Admin" placeholder="Search or select an admin" value={adminId} onChange={choose} isDisabled={save.isPending} isLoading={admins.isFetching} onSearchChange={value=>setSearch(value.slice(0,100))} filterOptions={false}
        options={[{value:'all',label:'All admins'},...options.map(a=>({value:a.id,label:`${a.name||a.username||a.email} · ${a.email}`}))]}
        menuFooter={(admins.data?.pagination?.total??0)>25?<div className="permission-picker-pagination"><button disabled={page===1||save.isPending} onClick={()=>setPage(p=>p-1)}>Previous admins</button><span>Page {page}</span><button disabled={page*25>=(admins.data?.pagination?.total??0)||save.isPending} onClick={()=>setPage(p=>p+1)}>Next admins</button></div>:undefined}/></div>
      </div>
      <div className="permission-top-actions">
        <button className="permission-mode" role="switch" aria-label="Full Access" aria-checked={fullAccess} disabled={disabled} onClick={()=>fullAccess?setConfirmation('clear'):change(definitions.map(d=>d.key),true)}><span className={fullAccess?'permission-switch is-on':'permission-switch'}/><span>{fullAccess?'Full Access':'Custom'}</span></button>
        <button className="permission-button permission-reset" disabled={disabled} onClick={()=>setConfirmation('reset')} title="Reset to default full access"><RotateCcw size={15}/><span>Reset</span></button>
        <button className="permission-button permission-primary" disabled={!canSave} onClick={requestSave}><Save size={15}/>{save.isPending?'Saving…':'Save Changes'}</button>
      </div>
    </header>
    {admins.isError&&<StatePanel kind="error" title="Admins unavailable" detail={errorMessage(admins.error)} onRetry={()=>admins.refetch()}/>}
    <div className="permission-context-row">
      {baseline?<div className="permission-identity"><span className="permission-avatar">{allAdmins?<Users size={19}/>:initials}</span><div className="permission-identity-text"><strong>{adminName}</strong><span>{allAdmins?`${baseline.targets?.length??0} existing Admin accounts · all pages`:baseline.admin.email}</span></div>{!allAdmins&&<span className={baseline.admin.active?'permission-status is-active':'permission-status'}><i/>{baseline.admin.active?'Active':'Inactive'}</span>}</div>:<div className="permission-selection-hint"><ShieldCheck size={17}/><span>Select an Admin to review and manage access.</span></div>}
      <button className="permission-button permission-bulk-trigger" disabled={save.isPending} onClick={()=>{setBulkRequested(true);choose('all')}}><Users size={15}/>Bulk Apply</button>
    </div>
    {!adminId?<div className="permission-empty"><ShieldCheck size={30}/><h2>Your access workspace</h2><p>Select an Admin above to view their permissions, or use Bulk Apply for all existing Admins.</p></div>:detail.isError?<StatePanel kind="error" title="Permissions unavailable" detail={errorMessage(detail.error)} onRetry={()=>detail.refetch()}/>:!baseline||catalogue.isPending?<StatePanel kind="loading" title="Loading permissions"/>:catalogue.isError?<StatePanel kind="error" title="Permission catalogue unavailable" onRetry={()=>catalogue.refetch()}/>:<>
      <div className="permission-summary" aria-label="Access summary">
        <span className="permission-summary-label">ACCESS SUMMARY</span>
        <span className="permission-stat"><strong>{enabledCount}</strong> Enabled</span><span className="permission-stat"><strong>{definitions.length-enabledCount}</strong> Disabled</span><span className="permission-stat"><strong>{definitions.length}</strong> Total</span>
        <span className="permission-summary-mode">{allAdmins?'Template preview':fullAccess?'Full workspace access':'Custom access'}{dirty&&<span className="permission-dirty-dot" title="Unsaved changes"/>}</span>
      </div>
      <div className="permission-workspace">
        <header className="permission-workspace-header">
          <div role="tablist" aria-label="Permission categories" className="permission-tabs"><button role="tab" id="workspace-access-tab" aria-controls="workspace-access-panel" aria-selected={tab==='modules'} onClick={()=>setTab('modules')}><ShieldCheck size={15}/>Workspace Access</button><button role="tab" id="data-actions-tab" aria-controls="data-actions-panel" aria-selected={tab==='actions'} onClick={()=>setTab('actions')}><SlidersHorizontal size={15}/>Data &amp; Actions</button></div>
          <span className="permission-workspace-caption">{tab==='modules'?'Choose the areas this Admin can access.':'Control what this Admin can do with each resource.'}</span>
        </header>
        <div className="permission-list-toolbar">
          <label className="permission-search"><Search size={16}/><input aria-label="Search permissions" placeholder="Search permissions…" value={permissionSearch} onChange={e=>setPermissionSearch(e.target.value)}/>{permissionSearch&&<button aria-label="Clear permission search" onClick={()=>setPermissionSearch('')}><X size={14}/></button>}</label>
          <div className="permission-list-actions">{tab==='modules'&&!term&&<button className="permission-text-button" onClick={()=>setCollapsed(collapsed.size?new Set():new Set(groups))}>{collapsed.size?'Expand all':'Collapse all'}</button>}<button className="permission-text-button" disabled={disabled} onClick={()=>change(definitions.map(d=>d.key),true)}>Select All</button><button className="permission-text-button permission-clear" disabled={disabled} onClick={()=>setConfirmation('clear')}>Clear All</button></div>
        </div>
        {tab==='modules'?<div className="permission-groups" id="workspace-access-panel" role="tabpanel" aria-labelledby="workspace-access-tab">
          {visibleGroups.map(group=>{
            const children=views.filter(d=>d.group===group),visibleChildren=children.filter(matches),expanded=!!term||!collapsed.has(group),count=children.filter(d=>selected.has(d.key)).length;
            const panelId=`permission-group-${group.replace(/[^a-z0-9]/gi,'-')}`;
            return <section key={group} className={children.length===1?'permission-group permission-group-single':'permission-group'}>
              <div className="permission-group-header"><GroupCheckbox label={children.length===1?children[0].label:group} ariaLabel={children.length===1?`${children[0].label} access`:group} keys={children.map(d=>d.key)} selected={draft} disabled={disabled} onChange={change}/>{children.length===1?<span className="permission-single-count">{count} / 1</span>:<button className="permission-group-expander" aria-label={`${expanded?'Collapse':'Expand'} ${group}`} aria-expanded={expanded} aria-controls={panelId} onClick={()=>toggleGroup(group)}><span>{count} / {children.length}</span><ChevronDown size={15} className={expanded?'is-expanded':''}/></button>}</div>
              {children.length>1&&expanded&&<div id={panelId} className="permission-group-children">{visibleChildren.map(d=><label key={d.key} className="permission-row"><span>{d.label}</span><input type="checkbox" aria-label={`${d.label} access`} checked={selected.has(d.key)} disabled={disabled} onChange={e=>change([d.key],e.target.checked)}/></label>)}</div>}
            </section>;
          })}
          {!visibleGroups.length&&<div className="permission-no-results">No permissions match “{permissionSearch}”.</div>}
        </div>:<div className="permission-matrix-wrap" id="data-actions-panel" role="tabpanel" aria-labelledby="data-actions-tab" tabIndex={0} aria-label="Data and action permissions">
          <table className="permission-matrix"><thead><tr><th scope="col">Resource</th>{(['view','add','edit','delete'] as const).map(action=><th scope="col" key={action}><span tabIndex={0} title={actionDescriptions[action]} aria-label={`${action}: ${actionDescriptions[action]}`}>{action}</span></th>)}</tr></thead><tbody>{visibleResources.map(resource=>{
            const entries=definitions.filter(d=>d.resource===resource);
            return <tr key={resource}><th scope="row"><span>{entries[0].label}</span><small>{entries[0].group}</small></th>{(['view','add','edit','delete'] as const).map(action=>{const d=entries.find(item=>item.action===action);return <td key={action}>{d?<input type="checkbox" aria-label={`${entries[0].label} ${action}`} title={actionDescriptions[action]} checked={selected.has(d.key)} disabled={disabled} onChange={e=>change([d.key],e.target.checked)}/>:<span className="permission-unavailable" aria-label="Not applicable" title="This operation is not available">—</span>}</td>})}</tr>;
          })}</tbody></table>{!visibleResources.length&&<div className="permission-no-results">No resources match “{permissionSearch}”.</div>}
        </div>}
        <div className="permission-workspace-note"><ShieldCheck size={13}/>Changes take effect after saving.{allAdmins&&<span> This template replaces access for all selected Admins.</span>}</div>
      </div>
      {issue&&<div className="permission-error" role="alert"><div><strong>Unable to update permissions</strong><p>{issue}</p></div><button className="permission-button" disabled={disabled} onClick={async()=>{const result=await detail.refetch();if(result.data){setBaseline(result.data);setDraft(result.data.permissions);setIssue('');setMessage('')}}}>Reload permissions</button></div>}
      {dirty&&<footer className="permission-save-bar"><div><span className="permission-dirty-dot"/><div><strong>Unsaved changes</strong><small>Review your changes before applying them.</small></div></div><div><button className="permission-button" disabled={disabled} onClick={()=>setConfirmation('cancel')}>Cancel</button><button className="permission-button permission-primary" disabled={!canSave} onClick={requestSave}><Save size={15}/>{save.isPending?'Saving…':'Save Changes'}</button></div></footer>}
    </>}
    {message&&<div className="permission-toast" role="status"><CheckCircle2 size={19}/><div><strong>Permissions updated</strong><span>{allAdmins?`Access updated successfully for ${baseline?.targets?.length??0} admins.`:`${adminName}'s access has been updated successfully.`}</span></div><button aria-label="Dismiss notification" onClick={()=>setMessage('')}><X size={15}/></button></div>}
    <Modal open={bulkOpen} title="Apply Permission Template" className="permission-dialog" onClose={()=>{setBulkOpen(false);setBulkRequested(false)}}>
      <div className="permission-dialog-body"><label className="permission-field-label">Select Admins</label><div className="permission-bulk-scope"><Users size={18}/><div><strong>All admins</strong><span>{baseline?.targets?.length??0} existing accounts across all pages</span></div></div><p>Includes inactive Admins. Super Admin and Client accounts are excluded.</p><h3>Permission template</h3><p>Use the workspace controls to choose the access and actions to apply. The template starts with full access.</p><div className="permission-template-preview"><span><strong>{enabledCount}</strong> enabled</span><span><strong>{definitions.length-enabledCount}</strong> disabled</span><span><strong>{baseline?.targets?.length??0}</strong> admins</span></div></div>
      <div className="permission-dialog-actions"><button className="permission-button" onClick={()=>setBulkOpen(false)}>Review template</button><button className="permission-button permission-primary" disabled={!canSave} onClick={()=>{setBulkOpen(false);setConfirmation('apply-all')}}>Preview &amp; Apply</button></div>
    </Modal>
    <Modal open={confirmation!==null} title={confirmation==='apply-all'?'Apply Permission Template':confirmation==='reset'?'Reset to Default':confirmation==='clear'?'Clear permissions':'Discard changes'} className="permission-dialog" onClose={()=>setConfirmation(null)}>
      <div className="permission-dialog-body"><p>{confirmation==='apply-all'?`Replace current permissions for all ${baseline?.targets?.length??0} existing Admin accounts with this selection?`:confirmation==='reset'?`Reset ${adminName}'s permissions to the default full-access configuration?`:confirmation==='clear'?`Remove all workspace permissions from ${adminName}?`:'Discard your unsaved permission changes?'}</p>{confirmation==='apply-all'&&<div className="permission-template-preview"><span><strong>{enabledCount}</strong> enabled</span><span><strong>{definitions.length-enabledCount}</strong> disabled</span><span><strong>{baseline?.targets?.length??0}</strong> admins</span></div>}</div><div className="permission-dialog-actions"><button className="permission-button" onClick={()=>setConfirmation(null)}>Cancel</button><button className={confirmation==='clear'?'permission-button permission-danger':'permission-button permission-primary'} onClick={confirmAction}>{confirmation==='apply-all'?'Apply permissions':confirmation==='reset'?'Reset':confirmation==='clear'?'Clear permissions':'Discard'}</button></div>
    </Modal>
    <Modal open={blocker.state==='blocked'||pendingAdmin!==null} title="Unsaved changes" className="permission-dialog" onClose={()=>{if(blocker.state==='blocked')blocker.reset();setPendingAdmin(null);setBulkRequested(false)}}><div className="permission-dialog-body"><p>You have unsaved permission changes.</p></div><div className="permission-dialog-actions"><button className="permission-button" onClick={()=>{if(blocker.state==='blocked')blocker.reset();setPendingAdmin(null);setBulkRequested(false)}}>Stay</button><button className="permission-button permission-primary" onClick={()=>{if(blocker.state==='blocked')blocker.proceed();if(pendingAdmin!==null){setAdminId(pendingAdmin);setBaseline(null);setPendingAdmin(null)}}}>Leave without saving</button></div></Modal>
  </section>;
}
