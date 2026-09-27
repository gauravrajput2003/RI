import {useEffect,useMemo,useState,type FormEvent} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {LoaderCircle} from 'lucide-react';
import {Modal} from '../../components/ui/Modal';
import {Button} from '../../components/ui/Button';
import {api,errorMessage} from '../../services/api/client';
import type {CapabilityState,Envelope,ManagedVehicle,Owner} from '../../types';

type IgnitionWiring='UNKNOWN'|'NOT_CONNECTED'|'CONNECTED_POWER_PLUS';
type Protocol='GT06'|'W15'|'';
type SimOperator='Jio'|'Airtel'|'VI'|'';
const vehicleTypes=['Bike','Car','Scooty','Bus','Truck','Van','Jeep','Three Wheeler','E-Rickshaw','Tractor'];
const protocols:Exclude<Protocol,''>[]=['GT06','W15'];
const simOperators:Exclude<SimOperator,''>[]=['Jio','Airtel','VI'];
const empty={adminId:'',clientId:'',deviceImei:'',deviceProtocol:'' as Protocol,simNumber:'',simOperator:'' as SimOperator,vehicleNumber:'',vehicleType:'',mileage:'',overspeedLimit:'',coins:'',billingStart:'',billingDue:'',alias:'',remark:'',active:true,autoRenewal:false,doorConfigured:false,relayConfigured:false,buzzerConfigured:false,ignitionWiring:'UNKNOWN' as IgnitionWiring,acPowerPlus:false,parkingAlarmOnIgnition:false};
const optionValues=(owner:Owner)=>Array.from(new Set([owner.username,owner.name,owner.email].filter((value):value is string=>Boolean(value))));
const matchesOwner=(owner:Owner,value:string)=>optionValues(owner).some(option=>option.toLowerCase()===value.trim().toLowerCase());
const localDate=(date:Date)=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const capabilitiesFor=(protocol:Protocol,vehicle:ManagedVehicle|null)=>protocol===vehicle?.protocol?(vehicle.capabilities||{}):protocol==='GT06'?{ignition:'SUPPORTED' as CapabilityState}:{};
const supported=(capabilities:Record<string,CapabilityState|boolean>,key:string)=>capabilities[key]==='SUPPORTED'||capabilities[key]===true;
const available=(capabilities:Record<string,CapabilityState|boolean>,key:string)=>capabilities[key]!=='UNSUPPORTED'&&capabilities[key]!==false;
const capabilityState=(capabilities:Record<string,CapabilityState|boolean>,key:string)=>supported(capabilities,key)?'Supported':capabilities[key]==='UNSUPPORTED'||capabilities[key]===false?'Not supported':'Unknown';

export function VehicleModal({open,vehicle,onClose}:{open:boolean;vehicle:ManagedVehicle|null;onClose:()=>void}){
  const [form,setForm]=useState(empty);
  const [adminText,setAdminText]=useState('');
  const [clientText,setClientText]=useState('');
  const cache=useQueryClient();
  useEffect(()=>{if(!open)return;setForm(vehicle?{adminId:vehicle.admin_id,clientId:vehicle.owner_id,deviceImei:vehicle.imei||'',deviceProtocol:(vehicle.protocol||'') as Protocol,simNumber:vehicle.sim_number||'',simOperator:(vehicle.sim_operator||'') as SimOperator,vehicleNumber:vehicle.vehicle_number,vehicleType:vehicle.vehicle_type||'',mileage:vehicle.mileage==null?'':String(vehicle.mileage),overspeedLimit:vehicle.overspeed_limit==null?'':String(vehicle.overspeed_limit),coins:String(vehicle.coins),billingStart:vehicle.billing_start?.slice(0,10)||'',billingDue:vehicle.billing_due?.slice(0,10)||'',alias:vehicle.alias||'',remark:vehicle.remark||'',active:vehicle.active,autoRenewal:vehicle.auto_renewal,doorConfigured:vehicle.door_configured,relayConfigured:vehicle.relay_configured,buzzerConfigured:vehicle.buzzer_configured,ignitionWiring:vehicle.ignition_wiring,acPowerPlus:vehicle.ac_power_plus,parkingAlarmOnIgnition:vehicle.parking_alarm_on_ignition}:empty);setAdminText(vehicle?vehicle.admin_name||vehicle.admin_username||vehicle.admin_email:'');setClientText(vehicle?vehicle.client_name||vehicle.client_username||vehicle.client_email:'')},[open,vehicle]);
  const admins=useQuery({queryKey:['vehicle-admin-options'],enabled:open,queryFn:async()=>(await api.get<Envelope<Owner[]>>('/vehicle-admin-options')).data.data});
  const clients=useQuery({queryKey:['vehicle-client-options',form.adminId],enabled:open&&Boolean(form.adminId),queryFn:async()=>(await api.get<Envelope<(Owner&{owner_id:string})[]>>('/vehicle-client-options',{params:{adminId:form.adminId}})).data.data});
  const capabilities=useMemo(()=>capabilitiesFor(form.deviceProtocol,vehicle),[form.deviceProtocol,vehicle]);
  const mutation=useMutation({mutationFn:()=>{const payload={...form,mileage:Number(form.mileage),overspeedLimit:Number(form.overspeedLimit),coins:Number(form.coins||0)};return vehicle?api.put(`/fleet-vehicles/${vehicle.id}`,payload):api.post('/fleet-vehicles',payload)},onSuccess:async()=>{await Promise.all([cache.invalidateQueries({queryKey:['managed-vehicles']}),cache.invalidateQueries({queryKey:['fleet']})]);onClose()}});
  function field<K extends keyof typeof empty>(key:K,value:(typeof empty)[K]){setForm(current=>({...current,[key]:value}));mutation.reset()}
  function chooseAdmin(value:string){setAdminText(value);const match=admins.data?.find(owner=>matchesOwner(owner,value));setForm(current=>({...current,adminId:match?.id||'',clientId:''}));setClientText('');mutation.reset()}
  function chooseClient(value:string){setClientText(value);const match=clients.data?.find(owner=>matchesOwner(owner,value));field('clientId',match?.id||'')}
  function chooseCoin(value:string){const normalized=value.replace(/[^0-9.]/g,'');field('coins',normalized);if(normalized==='12'){const start=new Date(),due=new Date(start);due.setMonth(due.getMonth()+12);setForm(current=>({...current,coins:normalized,billingStart:localDate(start),billingDue:localDate(due),autoRenewal:true}))}}
  function submit(event:FormEvent){event.preventDefault();mutation.mutate()}
  const capability=(key:'doorConfigured'|'relayConfigured'|'buzzerConfigured'|'acPowerPlus'|'parkingAlarmOnIgnition',capabilityKey:string,label:string)=><label className="vehicle-config-check" title={capabilityState(capabilities,capabilityKey)}><input type="checkbox" checked={form[key] as boolean} disabled={!available(capabilities,capabilityKey)} onChange={event=>field(key,event.target.checked)}/>{label}</label>;
  return <Modal open={open} title={vehicle?'Edit Vehicle':'Add Vehicle'} onClose={onClose} className="vehicle-modal"><form className="admin-form vehicle-form" onSubmit={submit}>
    <label>Vehicle Number<input required value={form.vehicleNumber} onChange={e=>field('vehicleNumber',e.target.value)} placeholder="Vehicle Number"/></label>
    <label>Vehicle Type<input required list="vehicle-types" value={form.vehicleType} onChange={e=>field('vehicleType',e.target.value)} placeholder="Select Vehicle"/><datalist id="vehicle-types">{vehicleTypes.map(value=><option key={value} value={value}/>)}</datalist></label>
    <label>Mileage<input required type="number" min="0" value={form.mileage} onChange={e=>field('mileage',e.target.value)} placeholder="Mileage"/></label>
    <label>Overspeed<input required type="number" min="1" value={form.overspeedLimit} onChange={e=>field('overspeedLimit',e.target.value)} placeholder="Overspeed"/></label>
    <label>Device IMEI<input required value={form.deviceImei} onChange={e=>field('deviceImei',e.target.value)} placeholder="Device IMEI"/></label>
    <label>Device Type<input required list="device-protocols" value={form.deviceProtocol} onChange={e=>field('deviceProtocol',e.target.value as Protocol)} placeholder="Select Protocol"/><datalist id="device-protocols">{protocols.map(value=><option key={value} value={value}/>)}</datalist></label>
    <label>SIM Number<input value={form.simNumber} onChange={e=>field('simNumber',e.target.value)} placeholder="SIM Number"/></label>
    <label>SIM Operator<input required list="sim-operators" value={form.simOperator} onChange={e=>field('simOperator',e.target.value as SimOperator)} placeholder="Select Operator"/><datalist id="sim-operators">{simOperators.map(value=><option key={value} value={value}/>)}</datalist></label>
    <label>Admin<input required list="vehicle-admins" value={adminText} onChange={e=>chooseAdmin(e.target.value)} placeholder="Select Admin"/><datalist id="vehicle-admins">{admins.data?.flatMap(owner=>optionValues(owner).map(value=><option key={`${owner.id}-${value}`} value={value}/>))}</datalist></label>
    <label>Client<input required list="vehicle-clients" disabled={!form.adminId||clients.isLoading} value={clientText} onChange={e=>chooseClient(e.target.value)} placeholder={form.adminId?'Select Client':'Select Admin First'}/><datalist id="vehicle-clients">{clients.data?.flatMap(owner=>optionValues(owner).map(value=><option key={`${owner.id}-${value}`} value={value}/>))}</datalist></label>
    <label>Coin<input aria-label="Coin" required type="number" min="0" step="0.01" list="coin-options" value={form.coins} onChange={e=>chooseCoin(e.target.value)} placeholder="Select or type Coin"/><datalist id="coin-options"><option value="12">New Coin (12 Month)</option></datalist></label>
    <label>Billing Start<input type="date" readOnly value={form.billingStart}/></label>
    <label>Billing Due<input type="date" readOnly value={form.billingDue}/></label>
    <label>Vehicle Alias<input value={form.alias} onChange={e=>field('alias',e.target.value)} placeholder="Vehicle Alias"/></label>
    <label>Remark<input value={form.remark} onChange={e=>field('remark',e.target.value)} placeholder="Remark"/></label>
    <div className="vehicle-config-list wide">
      <label className="vehicle-config-check"><input type="checkbox" checked={form.active} onChange={e=>field('active',e.target.checked)}/>Active</label>
      <label className="vehicle-config-check"><input type="checkbox" checked={form.autoRenewal} onChange={e=>field('autoRenewal',e.target.checked)}/>Auto Renewal</label>
      {capability('doorConfigured','door','Door')}{capability('relayConfigured','relay','Relay')}{capability('buzzerConfigured','buzzer','Buzzer')}
      <label className="vehicle-config-check" title={capabilityState(capabilities,'ignition')}><input type="checkbox" disabled={!available(capabilities,'ignition')} checked={form.ignitionWiring==='NOT_CONNECTED'} onChange={e=>field('ignitionWiring',e.target.checked?'NOT_CONNECTED':'UNKNOWN')}/>Ignition Wire not Connected</label>
      <label className="vehicle-config-check" title={capabilityState(capabilities,'ignition')}><input type="checkbox" disabled={!available(capabilities,'ignition')} checked={form.ignitionWiring==='CONNECTED_POWER_PLUS'} onChange={e=>field('ignitionWiring',e.target.checked?'CONNECTED_POWER_PLUS':'UNKNOWN')}/>Ignition Wire Connected in power(+)</label>
      {capability('acPowerPlus','airCondition','Air condition Wire Connected in power(+)')}{capability('parkingAlarmOnIgnition','parkingAlarm','Parking violation alarm on Ignition on')}
    </div>
    {(admins.isError||clients.isError)&&<div className="form-error wide" role="alert">Could not load authorized Admin or Client options.</div>}{mutation.isError&&<div className="form-error wide" role="alert">{errorMessage(mutation.error)}</div>}
    <footer className="wide"><button type="button" className="secondary-button" onClick={onClose}>Close</button><Button disabled={mutation.isPending}>{mutation.isPending?<><LoaderCircle className="spin"/>Saving…</>:vehicle?'Save changes':'Save vehicle'}</Button></footer>
  </form></Modal>;
}
