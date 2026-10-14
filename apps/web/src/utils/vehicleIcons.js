const BIKE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 128">
<ellipse cx="32" cy="66" rx="22" ry="58" fill="#000" opacity="0.18"/>
<ellipse cx="32" cy="16" rx="9" ry="14" fill="#1f2937"/><ellipse cx="32" cy="16" rx="4.5" ry="8.5" fill="#374151"/>
<ellipse cx="32" cy="112" rx="10" ry="14" fill="#1f2937"/><ellipse cx="32" cy="112" rx="5" ry="8.5" fill="#374151"/>
<path d="M20 25L14 22L16 20L23 23H41L48 20L50 22L44 25Z" fill="#374151"/><circle cx="14" cy="22" r="3.5" fill="#374151"/><circle cx="50" cy="22" r="3.5" fill="#374151"/>
<g stroke="#fff" stroke-width="1.5" stroke-linejoin="round" fill="{{MAIN}}">
<path d="M32 24C26 24 21 29 21 36V42C21 49 26 53 32 55C38 53 43 49 43 42V36C43 29 38 24 32 24Z"/>
<path d="M32 46C24 46 19 54 19 64C19 73 24 80 32 82C40 80 45 73 45 64C45 54 40 46 32 46Z"/>
<path d="M32 94C27 94 24 98 24 105C24 112 27 117 32 119C37 117 40 112 40 105C40 98 37 94 32 94Z"/>
</g><path d="M32 28C28 28 25 31 25 35V39C25 43 28 46 32 47C36 46 39 43 39 39V35C39 31 36 28 32 28Z" fill="{{DARK}}"/>
<path d="M24 56C22 60 22 65 24 69C29 68 29 58 24 56ZM40 56C42 60 42 65 40 69C35 68 35 58 40 56ZM26 99V110C31 109 31 100 26 99ZM38 99V110C33 109 33 100 38 99Z" fill="{{DARK}}"/>
<path d="M32 74C26 74 23 79 23 87C23 95 27 100 32 101C37 100 41 95 41 87C41 79 38 74 32 74Z" fill="#1f2937"/></svg>`;

const SCOOTY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 128">
<ellipse cx="32" cy="66" rx="23" ry="58" fill="#000" opacity="0.18"/>
<rect x="25" y="3" width="14" height="24" rx="7" fill="#1f2937"/><rect x="23" y="101" width="18" height="25" rx="8" fill="#1f2937"/>
<path d="M12 25H52M12 25L8 19M52 25L56 19" stroke="#374151" stroke-width="4"/><ellipse cx="8" cy="19" rx="4" ry="3" fill="#374151"/><ellipse cx="56" cy="19" rx="4" ry="3" fill="#374151"/>
<g fill="{{MAIN}}" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"><path d="M32 17C20 17 16 27 16 36L21 53H43L48 36C48 27 44 17 32 17Z"/><path d="M21 49H43L45 78C52 87 50 110 42 117H22C14 110 12 87 19 78Z"/></g>
<path d="M23 29Q32 22 41 29L39 40H25Z" fill="#374151"/><path d="M24 52H40V77H24Z" fill="{{DARK}}"/><path d="M22 81Q32 75 42 81V99Q32 110 22 99Z" fill="#1f2937"/><path d="M23 110H41" stroke="{{DARK}}" stroke-width="5"/></svg>`;

const CAR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 150">
<ellipse cx="40" cy="77" rx="33" ry="69" fill="#000" opacity="0.18"/>
<g fill="#1f2937"><rect x="7" y="29" width="12" height="25" rx="4"/><rect x="61" y="29" width="12" height="25" rx="4"/><rect x="7" y="104" width="12" height="25" rx="4"/><rect x="61" y="104" width="12" height="25" rx="4"/></g>
<path d="M24 6Q40 1 56 6Q66 12 66 32V121Q66 139 56 143H24Q14 139 14 121V32Q14 12 24 6Z" fill="{{MAIN}}" stroke="#fff" stroke-width="1.5"/>
<path d="M23 43Q40 37 57 43L53 62H27ZM27 104H53L58 120Q40 126 22 120Z" fill="#1f2937"/>
<path d="M24 62L20 55V109L24 103ZM56 62L60 55V109L56 103Z" fill="#374151"/>
<rect x="27" y="64" width="26" height="37" rx="5" fill="{{DARK}}" stroke="#fff" stroke-width="1.5"/>
<path d="M21 20Q40 14 59 20M23 133H57" stroke="{{DARK}}" stroke-width="3"/><path d="M19 13H28M52 13H61" stroke="#e5e7eb" stroke-width="4"/>
<path d="M14 60H9M66 60H71" stroke="#374151" stroke-width="5"/></svg>`;

const TRUCK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 190">
<ellipse cx="40" cy="97" rx="34" ry="88" fill="#000" opacity="0.18"/>
<g fill="#1f2937"><rect x="5" y="26" width="12" height="25" rx="4"/><rect x="63" y="26" width="12" height="25" rx="4"/><rect x="5" y="134" width="12" height="22" rx="4"/><rect x="63" y="134" width="12" height="22" rx="4"/><rect x="5" y="160" width="12" height="22" rx="4"/><rect x="63" y="160" width="12" height="22" rx="4"/></g>
<g fill="{{MAIN}}" stroke="#fff" stroke-width="1.5"><path d="M23 5H57Q67 5 67 18V55H13V18Q13 5 23 5Z"/><rect x="13" y="62" width="54" height="121" rx="3"/></g>
<path d="M20 16H60L57 30H23Z" fill="#1f2937"/><rect x="23" y="35" width="34" height="15" rx="3" fill="{{DARK}}"/><rect x="18" y="68" width="44" height="109" rx="2" fill="{{DARK}}"/>
<path d="M23 80H57M23 95H57M23 110H57M23 125H57M23 140H57M23 155H57" stroke="{{MAIN}}" stroke-width="2"/><path d="M13 25H7M67 25H73" stroke="#374151" stroke-width="4"/><path d="M18 9H27M53 9H62" stroke="#e5e7eb" stroke-width="3"/></svg>`;

const AUTO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 130">
<ellipse cx="36" cy="67" rx="30" ry="59" fill="#000" opacity="0.18"/>
<rect x="29" y="3" width="14" height="23" rx="6" fill="#1f2937"/><rect x="4" y="96" width="13" height="24" rx="4" fill="#1f2937"/><rect x="55" y="96" width="13" height="24" rx="4" fill="#1f2937"/>
<g fill="{{MAIN}}" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"><path d="M36 13Q22 14 20 30L15 54H57L52 30Q50 14 36 13Z"/><path d="M15 48H57L61 115Q61 123 53 123H19Q11 123 11 115Z"/></g>
<path d="M25 26Q36 20 47 26L49 39H23Z" fill="#1f2937"/><path d="M20 55H52V107H20Z" fill="{{DARK}}" stroke="#fff" stroke-width="1.5"/><path d="M25 61H47M25 101H47" stroke="{{MAIN}}" stroke-width="3"/><path d="M16 38H10M56 38H62" stroke="#374151" stroke-width="4"/><path d="M27 18H45" stroke="#e5e7eb" stroke-width="3"/></svg>`;

export const STATUS_COLORS = {
  running:{main:'#22c55e',dark:'#15803d'},idle:{main:'#eab308',dark:'#a16207'},
  stopped:{main:'#ef4444',dark:'#b91c1c'},unreachable:{main:'#3b82f6',dark:'#1d4ed8'},
};
const SVGS={bike:BIKE_SVG,scooty:SCOOTY_SVG,car:CAR_SVG,truck:TRUCK_SVG,auto:AUTO_SVG};
const SIZES={bike:[28,56],scooty:[28,56],car:[36,68],truck:[36,86],auto:[32,58]};
const TYPES={bike:'bike',motorcycle:'bike',scooter:'scooty',scooty:'scooty',car:'car',sedan:'car',suv:'car',hatchback:'car',truck:'truck',lorry:'truck',auto:'auto',rickshaw:'auto'};
const STATUSES={running:'running',moving:'running',overspeed:'running',idle:'idle',stopped:'stopped',unreachable:'unreachable',offline:'unreachable',disconnected:'unreachable',inactive:'unreachable',new:'unreachable'};
const cache=new Map();
const lookup=(values,value)=>{const key=String(value??'').trim().toLowerCase();return Object.hasOwn(values,key)?values[key]:undefined;};
const iconType=type=>lookup(TYPES,type)||'bike';
const iconStatus=status=>lookup(STATUSES,status)||'unreachable';

export function getVehicleStatus(vehicle,offlineMins=10) {
  const backend=lookup(STATUSES,vehicle.fleet_status??vehicle.status??vehicle.state);
  if(backend)return backend;
  const lastSeen=vehicle.lastSeen??vehicle.last_seen_at;
  const seen=new Date(lastSeen??'').getTime();
  if(!lastSeen||!Number.isFinite(seen)||Date.now()-seen>offlineMins*60000)return 'unreachable';
  if(Number(vehicle.speed??vehicle.current_speed??0)>0)return 'running';
  return vehicle.ignition===true||vehicle.ignition===1||vehicle.ignition==='on'?'idle':'stopped';
}

export function getVehicleSvg(type='bike',status='unreachable') {
  const normalizedType=iconType(type),normalizedStatus=iconStatus(status);
  const key=`${normalizedType}-${normalizedStatus}`;
  if(!cache.has(key)) {
    const colors=STATUS_COLORS[normalizedStatus];
    cache.set(key,SVGS[normalizedType].replaceAll('{{MAIN}}',colors.main).replaceAll('{{DARK}}',colors.dark));
  }
  return cache.get(key);
}

export function getVehicleIcon(L,type,status,heading=0) {
  const size=SIZES[iconType(type)];
  const numericHeading=Number(heading);
  const angle=Number.isFinite(numericHeading)?((numericHeading%360)+360)%360:0;
  return L.divIcon({className:'',iconSize:size,iconAnchor:[size[0]/2,size[1]/2],
    html:`<div style="width:100%;height:100%;transform:rotate(${angle}deg);transform-origin:50% 50%;">${getVehicleSvg(type,status)}</div>`});
}
