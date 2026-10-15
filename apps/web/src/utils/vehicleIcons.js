import {STATUS_COLORS,getVehicleStatus,getVehicleSvg,ICON_SIZE,normalizeType} from '../../../../packages/shared-utils/src/vehicleIcons';
export {STATUS_COLORS,getVehicleStatus,getVehicleSvg};

export function getVehicleIcon(L,type,status,heading=0) {
  const size=ICON_SIZE[normalizeType(type)];
  const numericHeading=Number(heading);
  const angle=Number.isFinite(numericHeading)?((numericHeading%360)+360)%360:0;
  return L.divIcon({className:'',iconSize:size,iconAnchor:[size[0]/2,size[1]/2],
    html:`<div style="width:100%;height:100%;transform:rotate(${angle}deg);transform-origin:50% 50%;">${getVehicleSvg(type,status)}</div>`});
}
