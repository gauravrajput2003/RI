import {createContext,useContext,useEffect,useRef,useSyncExternalStore,type ReactNode} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {permissionKeys,hasEffectivePermission,type PermissionKey} from '../../../../packages/shared-types/src/permissions';
import {api,errorMessage} from '../services/api/client';
import {claims,getTokens} from './auth';
import type {Envelope,Role} from '../types';
type Identity={id:string;role:Role;permissions:PermissionKey[]};
type PermissionState={role?:Role;ready:boolean;hasPermission:(key:PermissionKey)=>boolean};
const PermissionContext=createContext<PermissionState|null>(null);
const rateLimited=(error:unknown)=>(error as {response?:{status?:number}}|null)?.response?.status===429;
export function PermissionsProvider({children}:{children:ReactNode}) {
  const token=useSyncExternalStore(listener=>{window.addEventListener('fleet-session',listener);return()=>window.removeEventListener('fleet-session',listener)},()=>getTokens()?.accessToken??'');
  const id=claims()?.id,cache=useQueryClient(),previous=useRef<string|undefined>(undefined);
  const query=useQuery({queryKey:['effective-permissions',id],enabled:!!token,queryFn:async()=>(await api.get<Envelope<Identity>>('/auth/permissions')).data.data,staleTime:0,refetchInterval:q=>rateLimited(q.state.error)?false:10000,refetchOnWindowFocus:q=>!rateLimited(q.state.error),refetchOnReconnect:q=>!rateLimited(q.state.error),retry:(count,error)=>!rateLimited(error)&&count<1});
  useEffect(()=>{const refresh=()=>{if(!rateLimited(query.error))void query.refetch({cancelRefetch:false})};window.addEventListener('fleet-permissions',refresh);return()=>window.removeEventListener('fleet-permissions',refresh)},[query.refetch,query.error]);
  useEffect(()=>{
    if(!query.data)return;
    const signature=JSON.stringify(query.data);
    if(previous.current&&previous.current!==signature&&query.data.role==='ADMIN'){
      void cache.cancelQueries({predicate:q=>q.queryKey[0]!=='effective-permissions'});
      cache.removeQueries({predicate:q=>q.queryKey[0]!=='effective-permissions'});
    }
    previous.current=signature;
  },[query.data,cache]);
  if(query.isPending)return <div className="route-loader" role="status">Loading access permissions…</div>;
  if(query.isError)return <section className="page"><h1>Unable to verify access</h1><p role="alert">{errorMessage(query.error)}</p><button className="button" disabled={query.isFetching} onClick={()=>void query.refetch({cancelRefetch:false})}>Retry</button></section>;
  const data=query.data;
  return <PermissionContext.Provider value={{role:data.role,ready:true,hasPermission:key=>data.role==='SUPER_ADMIN'||hasEffectivePermission(data.permissions,key)}}>{children}</PermissionContext.Provider>;
}
export function usePermissions():PermissionState {
  const state=useContext(PermissionContext);
  // Standalone components fail closed for admins; role-only clients keep their existing access.
  const role=claims()?.role;
  return state??{role,ready:role!==undefined&&role!=='ADMIN',hasPermission:key=>role!==undefined&&role!=='ADMIN'&&permissionKeys.includes(key)};
}
export function AccessDenied(){return <section className="page access-denied" role="alert"><p className="eyebrow">403 Forbidden</p><h1>Access denied</h1><p>You do not have permission to access this feature.</p></section>}
export function PermissionGuard({permission,superAdminOnly,children}:{permission?:PermissionKey;superAdminOnly?:boolean;children:ReactNode}) {
  const access=usePermissions();
  if(!access.ready)return <div className="route-loader">Loading access permissions…</div>;
  return (superAdminOnly?access.role==='SUPER_ADMIN':!permission||access.hasPermission(permission))?<>{children}</>:<AccessDenied/>;
}
