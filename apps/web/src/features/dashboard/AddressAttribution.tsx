export function AddressAttribution({value}:{value?:string|null}) {
  return value ? <small style={{display:'block',fontWeight:400}}>{value.includes('OpenCellID')&&<><a href="https://opencellid.org/" target="_blank" rel="noreferrer">OpenCellID</a> · <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">CC BY-SA 4.0</a> · </>}<a href="https://www.geoapify.com/" target="_blank" rel="noreferrer">Geoapify</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a></small> : null;
}
