import {useState,type FormEvent} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {Modal} from '../../components/ui/Modal';
import {StatePanel} from '../../components/ui/StatePanel';
import {api,errorMessage} from '../../services/api/client';
import {dateTime,speed} from '../../lib/format';
import type {Envelope,ManagedVehicle} from '../../types';
import './client-vehicle.css';

type ClientVehicle=Pick<ManagedVehicle,'id'|'vehicle_number'|'vehicle_type'|'fleet_status'|'speed'|'tracker_timestamp'|'server_received_at'|'device_id'|'sim_number'|'sim_operator'|'sim_info'>;
type ClientDevice={id:string;model:string|null;sim_number:string|null;sim_operator:string|null;sim_info:string|null;vehicle_id:string|null;vehicle_number:string|null};
const deviceLabel=(device:ClientDevice)=>`${device.model||'Tracker'} ${device.id.slice(0,8)}${device.sim_number?` · SIM ${device.sim_number}`:''} · ${device.vehicle_number?`On ${device.vehicle_number}`:'Unassigned'}`;

export function ClientVehicleModal({vehicleId,onClose}:{vehicleId:string;onClose:()=>void}){
  const cache=useQueryClient();
  const [action,setAction]=useState<'detail'|'tracker'|'sim'>('detail');
  const [deviceId,setDeviceId]=useState('');
  const [confirmed,setConfirmed]=useState(false);
  const [sim,setSim]=useState({simNumber:'',simOperator:'',simInfo:''});
  const detail=useQuery({queryKey:['client-vehicle',vehicleId],queryFn:async()=>(await api.get<Envelope<ClientVehicle>>(`/web/client-vehicles/${vehicleId}`)).data.data});
  const devices=useQuery({queryKey:['client-devices'],enabled:action==='tracker',queryFn:async()=>(await api.get<Envelope<ClientDevice[]>>('/web/client-devices')).data.data});
  const selected=devices.data?.find(device=>device.id===deviceId);
  const needsMove=!!selected?.vehicle_id&&selected.vehicle_id!==vehicleId;
  const updated=async()=>{
    await Promise.all(['client-vehicle','client-devices','managed-vehicles','fleet','device-diagnostics'].map(key=>cache.invalidateQueries({queryKey:[key]})));
    setAction('detail');setDeviceId('');setConfirmed(false);
  };
  const change=useMutation({mutationFn:()=>api.patch(`/web/client-vehicles/${vehicleId}/device`,{deviceId,...(needsMove?{moveFromVehicleId:selected!.vehicle_id}:{})}),onSuccess:updated});
  const edit=useMutation({mutationFn:()=>api.patch(`/web/client-devices/${detail.data!.device_id}/sim`,{simNumber:sim.simNumber,simInfo:sim.simInfo,...(sim.simOperator?{simOperator:sim.simOperator}:{})}),onSuccess:updated});
  const pending=change.isPending||edit.isPending;
  const back=()=>{setAction('detail');change.reset();edit.reset();setConfirmed(false)};
  function submit(event:FormEvent){event.preventDefault();if(action==='tracker'){if(selected&&(!needsMove||confirmed))change.mutate()}else if(detail.data?.device_id)edit.mutate()}
  const vehicle=detail.data;
  return <Modal open className="client-vehicle-modal" title={vehicle?`Vehicle details · ${vehicle.vehicle_number}`:'Vehicle details'} onClose={onClose}>
    {detail.isLoading?<StatePanel kind="loading" title="Loading vehicle"/>:detail.isError?<StatePanel kind="error" title="Vehicle unavailable" detail={errorMessage(detail.error)} onRetry={()=>detail.refetch()}/>:vehicle&&<>
      {action==='detail'?<div className="admin-form client-vehicle-content">
        <dl><dt>Vehicle Type</dt><dd>{vehicle.vehicle_type||'Unavailable'}</dd><dt>Status</dt><dd>{vehicle.fleet_status}</dd><dt>Speed</dt><dd>{speed(vehicle.speed)}</dd><dt>Last GPS</dt><dd>{dateTime(vehicle.tracker_timestamp||vehicle.server_received_at)}</dd><dt>SIM Number</dt><dd>{vehicle.sim_number||'Unavailable'}</dd><dt>SIM Operator</dt><dd>{vehicle.sim_operator||'Unavailable'}</dd><dt>SIM Info</dt><dd>{vehicle.sim_info||'Unavailable'}</dd></dl>
        <div className="modal-actions"><button type="button" className="button" onClick={()=>{setDeviceId('');setAction('tracker');change.reset()}}>Change tracker</button><button type="button" className="secondary-button" disabled={!vehicle.device_id} onClick={()=>{setSim({simNumber:vehicle.sim_number||'',simOperator:vehicle.sim_operator||'',simInfo:vehicle.sim_info||''});setAction('sim');edit.reset()}}>Edit SIM info</button></div>
      </div>:<form className="admin-form client-vehicle-content" onSubmit={submit}>
        {action==='tracker'?<>
          {devices.isLoading?<p>Loading your trackers…</p>:devices.isError?<StatePanel kind="error" title="Trackers unavailable" detail={errorMessage(devices.error)} onRetry={()=>devices.refetch()}/>:<label>Choose tracker<select required value={deviceId} onChange={event=>{setDeviceId(event.target.value);setConfirmed(false);change.reset()}}><option value="">Select an existing tracker</option>{devices.data?.map(device=><option key={device.id} value={device.id}>{deviceLabel(device)}</option>)}</select></label>}
          {devices.data?.length===0&&<p>No registered trackers are available. Contact your admin to register a device.</p>}
          {needsMove&&<label className="client-tracker-confirm"><input type="checkbox" checked={confirmed} onChange={event=>setConfirmed(event.target.checked)}/>Move this tracker from {selected?.vehicle_number} to {vehicle.vehicle_number}. The previous vehicle will stop receiving updates from it.</label>}
          {vehicle.device_id&&selected&&selected.id!==vehicle.device_id&&<p>The current tracker on {vehicle.vehicle_number} will become unassigned. Vehicle history will be retained.</p>}
        </>:<>
          <label>SIM Number<input maxLength={32} value={sim.simNumber} onChange={event=>setSim({...sim,simNumber:event.target.value})}/></label>
          <label>SIM Operator<select value={sim.simOperator} onChange={event=>setSim({...sim,simOperator:event.target.value})}><option value="">Select operator</option>{['Jio','Airtel','VI'].map(operator=><option key={operator}>{operator}</option>)}</select></label>
          <label>SIM Info<textarea maxLength={500} value={sim.simInfo} onChange={event=>setSim({...sim,simInfo:event.target.value})}/></label>
        </>}
        {(change.isError||edit.isError)&&<p className="form-error" role="alert">{errorMessage(change.error||edit.error)}</p>}
        <div className="modal-actions"><button type="button" className="secondary-button" disabled={pending} onClick={back}>Cancel</button><button className="button" disabled={pending||(action==='tracker'&&(!selected||selected.id===vehicle.device_id||devices.isFetching||(needsMove&&!confirmed)))}>{pending?'Saving…':action==='tracker'?'Save tracker':'Save SIM info'}</button></div>
      </form>}
    </>}
  </Modal>;
}
