export function AddressAttribution({value}:{value?:string|null}) {
  return value ? <small style={{display:'block',fontWeight:400}}><a href="https://www.geoapify.com/" target="_blank" rel="noreferrer">Geoapify</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a></small> : null;
}
