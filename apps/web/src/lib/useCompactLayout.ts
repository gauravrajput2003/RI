import {useEffect,useState} from 'react';
export function useCompactLayout(){
 const [compact,setCompact]=useState(()=>window.matchMedia?.('(max-width: 1023px)').matches??false);
 useEffect(()=>{const media=window.matchMedia?.('(max-width: 1023px)');if(!media)return;const update=()=>setCompact(media.matches);update();media.addEventListener('change',update);return()=>media.removeEventListener('change',update)},[]);
 return compact;
}
