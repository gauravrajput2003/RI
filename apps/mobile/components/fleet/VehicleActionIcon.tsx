import {Image,View} from 'react-native';
import {SvgXml} from 'react-native-svg';
import notification from '../../assets/action-icons/notification.png';
import nearby from '../../assets/action-icons/nearby.png';
import parking from '../../assets/action-icons/parking.png';
import type {BikeAction} from './BikeActions';

// Local assets and vectors keep these small symbols identical on Android and iOS.
const pictures={Notification:notification,NearBy:nearby,Parking:parking};
const vectors={
 'Live Map':'<path d="M3 24L10 21L21 24L29 20V30L21 33L10 30L3 33Z" fill="#83cf9c"/><path d="M10 21V30M21 24V33" stroke="#fff" stroke-width="1.5"/><path d="M16 1C9 1 6 6 6 11C6 17 16 26 16 26S26 17 26 11C26 6 23 1 16 1Z" fill="#ff5268"/><circle cx="16" cy="10" r="4" fill="#fff"/>',
 'Play Back':'<circle cx="16" cy="17" r="14" fill="#40bd74"/><path d="M12 9L24 17L12 25Z" fill="#fff"/>',
 Share:'<path d="M9 17L24 7M9 17L24 28" fill="none" stroke="#8b9692" stroke-width="1.5"/><circle cx="7" cy="17" r="5" fill="#f45176"/><circle cx="25" cy="6" r="5" fill="#77c65e"/><circle cx="25" cy="29" r="5" fill="#f4b94b"/>',
 Report:'<rect x="6" y="5" width="21" height="28" rx="2" fill="#f6bf80"/><rect x="8" y="7" width="17" height="24" fill="#fff"/><rect x="12" y="2" width="9" height="6" rx="2" fill="#91cce3"/><path d="M12 23V28M17 18V28M22 14V28" stroke="#f7ac61" stroke-width="2"/><path d="M11 12H22" stroke="#92a8b8" stroke-width="1.5"/>',
 'Street View':'<circle cx="16" cy="6" r="4" fill="#ffc70b"/><path d="M12 12H20L22 23H19V33H14V23H10Z" fill="#ffbc00"/><ellipse cx="16" cy="33" rx="9" ry="2" fill="#ffd967"/>',
 Lock:'<path d="M9 15V9C9 0 23 0 23 9V15" fill="none" stroke="#ef3655" stroke-width="2"/><rect x="5" y="14" width="23" height="20" rx="3" fill="#ff3150"/><circle cx="16" cy="22" r="3" fill="#fff"/><path d="M16 24V28" stroke="#fff" stroke-width="2"/>',
 Driver:'<path d="M6 34V29Q6 22 16 22Q26 22 26 29V34" fill="#bde4f2"/><path d="M12 23L16 28L20 23M16 28V34" fill="#fff" stroke="#6d94a5"/><ellipse cx="16" cy="14" rx="6" ry="8" fill="#f6c99a"/><path d="M9 8Q16 3 23 8V12H9Z" fill="#344c73"/><path d="M8 6Q16 0 24 6L22 9H10Z" fill="#344c73"/><path d="M11 8H21" stroke="#f5bf4e" stroke-width="2"/>',
 Edit:'<path d="M5 4H20V32H5Z" fill="#8cbdda"/><path d="M12 26L15 18L27 6L31 10L19 22Z" fill="#54788e" stroke="#fff" stroke-width="1.5"/>',
};
export function VehicleActionIcon({action}:{action:BikeAction}){
 const image=Object.hasOwn(pictures,action)?pictures[action as keyof typeof pictures]:null;
 return <View testID={`vehicle-action-icon-${action}`} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{width:26,height:28,alignItems:'center',justifyContent:'center'}}>{image?<Image source={image} resizeMode="contain" style={{width:26,height:26}}/>:<SvgXml xml={`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 34 36">${vectors[action as keyof typeof vectors]}</svg>`} width={26} height={28}/>}</View>;
}
