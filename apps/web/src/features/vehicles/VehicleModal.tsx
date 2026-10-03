import {useEffect,useMemo,useState,type FormEvent} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {LoaderCircle} from 'lucide-react';
import {Modal} from '../../components/ui/Modal';
import {Button} from '../../components/ui/Button';
import {SearchableSelect} from '../../components/ui/SearchableSelect';
import {api,errorMessage} from '../../services/api/client';
import type {CapabilityState,Envelope,ManagedVehicle,Owner} from '../../types';

type IgnitionWiring='UNKNOWN'|'NOT_CONNECTED'|'CONNECTED_POWER_PLUS';
type Protocol='GT06'|'W15'|'';
type SimOperator='Jio'|'Airtel'|'VI'|'';
const vehicleTypes=['Bike','Car','EVCar','Scooty','Bus','Truck','Van','Jeep','Three Wheeler','E-Rickshaw','Tractor'];
const protocols:Exclude<Protocol,''>[]=['GT06','W15'];
const simOperators:Exclude<SimOperator,''>[]=['Jio','Airtel','VI'];
const empty={adminId:'',clientId:'',deviceImei:'',deviceProtocol:'' as Protocol,simNumber:'',simInfo:'',gpsLocation:'',simOperator:'' as SimOperator,vehicleNumber:'',vehicleType:'',mileage:'',overspeedLimit:'',coins:'',billingStart:'',billingDue:'',alias:'',remark:'',active:true,autoRenewal:false,doorConfigured:false,relayConfigured:false,buzzerConfigured:false,ignitionWiring:'UNKNOWN' as IgnitionWiring,acPowerPlus:false,parkingAlarmOnIgnition:false};
const localDate=(date:Date)=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const capabilitiesFor=(protocol:Protocol,vehicle:ManagedVehicle|null)=>protocol===vehicle?.protocol?(vehicle.capabilities||{}):protocol==='GT06'?{ignition:'SUPPORTED' as CapabilityState}:{};
const supported=(capabilities:Record<string,CapabilityState|boolean>,key:string)=>capabilities[key]==='SUPPORTED'||capabilities[key]===true;
const available=(capabilities:Record<string,CapabilityState|boolean>,key:string)=>capabilities[key]!=='UNSUPPORTED'&&capabilities[key]!==false;
const capabilityState=(capabilities:Record<string,CapabilityState|boolean>,key:string)=>supported(capabilities,key)?'Supported':capabilities[key]==='UNSUPPORTED'||capabilities[key]===false?'Not supported':'Unknown';

export function VehicleModal({open,vehicle,onClose,readOnly=false}:{readOnly?:boolean;open:boolean;vehicle:ManagedVehicle|null;onClose:()=>void}){
  const [form,setForm]=useState(empty);
  const cache=useQueryClient();
  useEffect(()=>{if(!open)return;setForm(vehicle?{adminId:vehicle.admin_id,clientId:vehicle.owner_id,deviceImei:vehicle.imei||'',deviceProtocol:(vehicle.protocol||'') as Protocol,simNumber:vehicle.sim_number||'',simInfo:vehicle.sim_info||'',gpsLocation:vehicle.gps_location||'',simOperator:(vehicle.sim_operator||'') as SimOperator,vehicleNumber:vehicle.vehicle_number,vehicleType:vehicle.vehicle_type||'',mileage:vehicle.mileage==null?'':String(vehicle.mileage),overspeedLimit:vehicle.overspeed_limit==null?'':String(vehicle.overspeed_limit),coins:String(vehicle.coins),billingStart:vehicle.billing_start?.slice(0,10)||'',billingDue:vehicle.billing_due?.slice(0,10)||'',alias:vehicle.alias||'',remark:vehicle.remark||'',active:vehicle.active,autoRenewal:vehicle.auto_renewal,doorConfigured:vehicle.door_configured,relayConfigured:vehicle.relay_configured,buzzerConfigured:vehicle.buzzer_configured,ignitionWiring:vehicle.ignition_wiring,acPowerPlus:vehicle.ac_power_plus,parkingAlarmOnIgnition:vehicle.parking_alarm_on_ignition}:empty)},[open,vehicle]);
  const admins=useQuery({queryKey:['vehicle-admin-options'],enabled:open,queryFn:async()=>(await api.get<Envelope<Owner[]>>('/vehicle-admin-options')).data.data});
  const clients=useQuery({queryKey:['vehicle-client-options',form.adminId],enabled:open&&Boolean(form.adminId),queryFn:async()=>(await api.get<Envelope<(Owner&{owner_id:string})[]>>('/vehicle-client-options',{params:{adminId:form.adminId}})).data.data});
  const capabilities=useMemo(()=>capabilitiesFor(form.deviceProtocol,vehicle),[form.deviceProtocol,vehicle]);
  const mutation=useMutation({mutationFn:()=>{const payload={...form,mileage:vehicle&&form.mileage===''?null:Number(form.mileage),overspeedLimit:vehicle&&form.overspeedLimit===''?null:Number(form.overspeedLimit),coins:Number(form.coins||0)};return vehicle?api.put(`/fleet-vehicles/${vehicle.id}`,payload):api.post('/fleet-vehicles',payload)},onSuccess:async()=>{await Promise.all([cache.invalidateQueries({queryKey:['managed-vehicles']}),cache.invalidateQueries({queryKey:['fleet']}),cache.invalidateQueries({queryKey:['clients']}),cache.invalidateQueries({queryKey:['device-diagnostics']})]);onClose()}});
  function field<K extends keyof typeof empty>(key:K,value:(typeof empty)[K]){setForm(current=>({...current,[key]:value}));mutation.reset()}
  function chooseAdmin(value:string){setForm(current=>({...current,adminId:value,clientId:''}));mutation.reset()}
  function chooseCoin(value:string){const normalized=value.replace(/[^0-9.]/g,'');field('coins',normalized);if(normalized==='12'){const start=new Date(),due=new Date(start);due.setMonth(due.getMonth()+12);setForm(current=>({...current,coins:normalized,billingStart:localDate(start),billingDue:localDate(due),autoRenewal:true}))}}
  function submit(event:FormEvent){event.preventDefault();if(!readOnly)mutation.mutate()}
  const capability=(key:'doorConfigured'|'relayConfigured'|'buzzerConfigured'|'acPowerPlus'|'parkingAlarmOnIgnition',capabilityKey:string,label:string)=><label className="vehicle-config-check" title={capabilityState(capabilities,capabilityKey)}><input type="checkbox" checked={form[key] as boolean} disabled={!available(capabilities,capabilityKey)} onChange={event=>field(key,event.target.checked)}/>{label}</label>;
  return <Modal open={open} title={readOnly?'Preview Vehicle':vehicle?'Edit Vehicle':'Add Vehicle'} onClose={onClose} className="vehicle-modal"><form className="admin-form vehicle-form" onSubmit={submit}><fieldset disabled={readOnly} style={{display:'contents'}} aria-label="Vehicle details">
    <label>Vehicle Number<input required value={form.vehicleNumber} onChange={e=>field('vehicleNumber',e.target.value)} placeholder="Vehicle Number"/></label>
    <label>Vehicle Type<SearchableSelect required aria-label="Vehicle Type" value={form.vehicleType} onChange={value=>field('vehicleType',value)} placeholder="Select Vehicle" options={[...vehicleTypes,...(vehicle?.vehicle_type&&!vehicleTypes.includes(vehicle.vehicle_type)?[vehicle.vehicle_type]:[])].map(value=>({value,label:value}))}/></label>
    <label>Mileage<input required={!vehicle} type="number" min="0" value={form.mileage} onChange={e=>field('mileage',e.target.value)} placeholder="Mileage"/></label>
    <label>Overspeed<input required={!vehicle} type="number" min="1" value={form.overspeedLimit} onChange={e=>field('overspeedLimit',e.target.value)} placeholder="Overspeed"/></label>
    <label>Device IMEI<input required={!vehicle} value={form.deviceImei} onChange={e=>field('deviceImei',e.target.value)} placeholder="Device IMEI"/></label>
    <label>Device Type<SearchableSelect required={!vehicle||!!form.deviceImei} aria-label="Device Type" value={form.deviceProtocol} onChange={value=>field('deviceProtocol',value as Protocol)} placeholder="Select Protocol" options={protocols.map(value=>({value,label:value}))}/></label>
    <label>SIM Number<input value={form.simNumber} onChange={e=>field('simNumber',e.target.value)} placeholder="SIM Number"/></label>
    <label>SIM Operator<SearchableSelect required={!vehicle||!!form.deviceImei} aria-label="SIM Operator" value={form.simOperator} onChange={value=>field('simOperator',value as SimOperator)} placeholder="Select Operator" options={simOperators.map(value=>({value,label:value}))}/></label>
    <label>SIM Info<input type="text" maxLength={500} value={form.simInfo} onChange={e=>field('simInfo',e.target.value)} placeholder="Text printed on the back of the SIM card"/></label>
    <label>GPS Location<input type="text" maxLength={500} value={form.gpsLocation} onChange={e=>field('gpsLocation',e.target.value)} placeholder="Installation position, e.g. upper dashboard or lower panel"/></label>
    <label>Admin<SearchableSelect required aria-label="Admin" value={form.adminId} onChange={chooseAdmin} placeholder="Select Admin" isLoading={admins.isLoading} options={(admins.data??[]).map(owner=>({value:owner.id,label:owner.name||owner.username||owner.email}))}/></label>
    <label>Client<SearchableSelect required aria-label="Client" value={form.clientId} onChange={value=>field('clientId',value)} placeholder={form.adminId?'Select Client':'Select Admin First'} isDisabled={!form.adminId} isLoading={clients.isLoading} options={[...(vehicle&&form.adminId===vehicle.admin_id&&vehicle.owner_id===vehicle.admin_id?[{id:vehicle.owner_id,name:'Assigned directly to admin',username:'',email:''}]:[]),...(clients.data??[])].map(owner=>({value:owner.id,label:owner.name||owner.username||owner.email}))}/></label>
    <label>Coin<SearchableSelect aria-label="Coin" required isCreatable value={form.coins} onChange={chooseCoin} placeholder="Select or type Coin" options={[{value:'12',label:'New Coin (12 Month)'}]}/></label>
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
    </fieldset><footer className="wide"><button type="button" className="secondary-button" onClick={onClose}>Close</button>{!readOnly&&<Button disabled={mutation.isPending}>{mutation.isPending?<><LoaderCircle className="spin"/>Saving…</>:vehicle?'Save changes':'Save vehicle'}</Button>}</footer>
  </form></Modal>;
}
