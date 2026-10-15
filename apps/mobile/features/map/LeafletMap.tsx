import React,{createContext,forwardRef,useCallback,useContext,useEffect,useId,useImperativeHandle,useMemo,useReducer,useRef,useState} from 'react';
import {Linking,Pressable,Text,View,type StyleProp,type ViewStyle} from 'react-native';
import {WebView} from 'react-native-webview';
import {mapHtml} from './leaflet-document';
export type Coordinate={latitude:number;longitude:number};
export type Region=Coordinate&{latitudeDelta:number;longitudeDelta:number};
type Layer={kind:'marker'|'line';coordinate?:Coordinate;coordinates?:Coordinate[];title?:string;color?:string;rotation?:number;label?:string;width?:number;iconType?:'bike';zIndexOffset?:number;svg?:string;iconSize?:readonly[number,number]};
export type MapHandle={animateToRegion:(region:Region,duration?:number)=>void;fitToCoordinates:(coordinates:Coordinate[],options?:unknown)=>void};
type Registry={put:(id:string,layer:Layer,press?:()=>void)=>void;remove:(id:string)=>void};
const Context=createContext<Registry|null>(null);
function useLayer(layer:Layer,press?:()=>void){
 const registry=useContext(Context),id=useId(),signature=JSON.stringify(layer),pressRef=useRef(press);pressRef.current=press;
 useEffect(()=>{registry?.put(id,JSON.parse(signature),()=>pressRef.current?.());},[registry,id,signature]);
 useEffect(()=>()=>registry?.remove(id),[registry,id]);
}
function labelOf(children:React.ReactNode):string{
 let result='';React.Children.forEach(children,child=>{if(typeof child==='string'||typeof child==='number')result+=child;else if(React.isValidElement<{children?:React.ReactNode}>(child))result+=labelOf(child.props.children);});return result.slice(0,8);
}
export function Marker({coordinate,title,pinColor,rotation,children,onPress,iconType,zIndexOffset,svg,iconSize}:{coordinate:Coordinate;title?:string;pinColor?:string;rotation?:number;children?:React.ReactNode;onPress?:()=>void;tracksViewChanges?:boolean;iconType?:'bike';zIndexOffset?:number;svg?:string;iconSize?:readonly[number,number]}){
 useLayer({kind:'marker',coordinate,title,color:pinColor??'#087ca7',rotation,label:iconType==='bike'?'':labelOf(children),iconType,zIndexOffset,svg,iconSize},onPress);return null;
}
export function Polyline({coordinates,strokeColor,strokeWidth}:{coordinates:Coordinate[];strokeColor?:string;strokeWidth?:number}){
 useLayer({kind:'line',coordinates,color:strokeColor??'#087ca7',width:strokeWidth??3});return null;
}
const LeafletMap=forwardRef<MapHandle,{children?:React.ReactNode;style?:StyleProp<ViewStyle>;initialRegion?:Region;onMapReady?:()=>void;onRegionChangeComplete?:(region:Region)=>void;onPanDrag?:()=>void}>(function LeafletMap(props,ref){
 const web=useRef<WebView>(null),layers=useRef(new Map<string,Layer>()),presses=useRef(new Map<string,()=>void>()),ready=useRef(false),pending=useRef<unknown[]>([]);
 const sent=useRef(new Map<string,Layer>());
 const [revision,bump]=useReducer(n=>n+1,0),[error,setError]=useState<string|null>(null),[reload,setReload]=useState(0);
 const callbacks=useRef(props);callbacks.current=props;
 const send=useCallback((message:unknown)=>{if(ready.current)web.current?.injectJavaScript(`window.fleetReceive(${JSON.stringify(message)});true;`);else pending.current.push(message);},[]);
 const signatures=useRef(new Map<string,string>());
 const registry=useMemo<Registry>(()=>({put:(id,layer,press)=>{if(press)presses.current.set(id,press);const signature=JSON.stringify(layer);if(signatures.current.get(id)===signature)return;signatures.current.set(id,signature);layers.current.set(id,layer);bump();},remove:id=>{if(!layers.current.has(id))return;signatures.current.delete(id);layers.current.delete(id);presses.current.delete(id);bump();}}),[]);
 useImperativeHandle(ref,()=>({animateToRegion:region=>send({type:'region',region}),fitToCoordinates:coordinates=>send({type:'fit',coordinates})}),[send]);
 useEffect(()=>{if(ready.current){const changed=[...layers.current.entries()].filter(([id,layer])=>sent.current.get(id)!==layer);const removed=[...sent.current.keys()].filter(id=>!layers.current.has(id));if(changed.length||removed.length)send({type:'updates',layers:changed,removed});sent.current=new Map(layers.current);}},[revision,send]);
 const initial=useRef(props.initialRegion);
 const source=useMemo(()=>({html:mapHtml(initial.current)}),[]);
 return <View style={[{flex:1},props.style]}><Context.Provider value={registry}>{props.children}</Context.Provider>
  <WebView key={reload} ref={web} style={{flex:1}} source={source} originWhitelist={['*']} javaScriptEnabled domStorageEnabled cacheEnabled
   applicationNameForUserAgent="RI-GPS-Tracker/0.1 (com.example.fleettracker)" mixedContentMode="never"
   onShouldStartLoadWithRequest={request=>{if(request.url==='about:blank'||request.url.startsWith('data:text/html'))return true;if(request.url.startsWith('https://www.openstreetmap.org/'))void Linking.openURL(request.url);return false;}}
   onError={()=>setError('Unable to open the map. Check your internet connection.')} onMessage={event=>{
    try{const message=JSON.parse(event.nativeEvent.data);if(message.type==='ready'){ready.current=true;setError(null);send({type:'layers',layers:[...layers.current.entries()]});sent.current=new Map(layers.current);for(const item of pending.current)send(item);pending.current=[];callbacks.current.onMapReady?.();}
     else if(message.type==='region')callbacks.current.onRegionChangeComplete?.(message.region);
     else if(message.type==='pan')callbacks.current.onPanDrag?.();else if(message.type==='press')presses.current.get(message.id)?.();
     else if(message.type==='tiles-error')setError('Map tiles could not load. Check internet access and retry.');else if(message.type==='tiles-ok')setError(null);
    }catch{/* Ignore malformed messages from the embedded map. */}
   }}/>
  {error?<View style={{position:'absolute',top:8,left:8,right:8,padding:10,backgroundColor:'white'}}><Text>{error}</Text><Pressable onPress={()=>{ready.current=false;pending.current=[];setError(null);setReload(n=>n+1);}}><Text style={{color:'#087ca7'}}>Retry map</Text></Pressable></View>:null}
 </View>;
});
export default LeafletMap;
