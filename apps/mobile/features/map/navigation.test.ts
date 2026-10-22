import {beforeEach,it,expect,vi} from 'vitest';
const native=vi.hoisted(()=>({canOpenURL:vi.fn(),openURL:vi.fn(),os:{OS:'android'}}));
vi.mock('react-native',()=>({Linking:native,Platform:native.os}));
import {openVehicleDirections,vehicleDirectionsUrl} from './navigation';
beforeEach(()=>{native.canOpenURL.mockReset();native.openURL.mockReset();native.os.OS='android'});
it('uses the selected vehicle GPS destination with no phone origin or permission request',async()=>{
 native.canOpenURL.mockResolvedValue(true);native.openURL.mockResolvedValue(undefined);
 await openVehicleDirections({latitude:28,longitude:76});expect(native.openURL).toHaveBeenCalledWith('google.navigation:q=28%2C76&mode=d');
 expect(vehicleDirectionsUrl({latitude:29,longitude:77})).toBe('https://www.google.com/maps/dir/?api=1&destination=29%2C77&travelmode=driving');
});
it('tries the universal Maps/browser link if the native app is missing or fails',async()=>{
 native.canOpenURL.mockResolvedValue(true);native.openURL.mockRejectedValueOnce(new Error('No app')).mockResolvedValueOnce(undefined);
 await openVehicleDirections({latitude:28,longitude:76});expect(native.openURL).toHaveBeenLastCalledWith(vehicleDirectionsUrl({latitude:28,longitude:76}));
 native.os.OS='ios';native.openURL.mockResolvedValue(undefined);await openVehicleDirections({latitude:28,longitude:76});expect(native.openURL).toHaveBeenLastCalledWith('comgooglemaps://?daddr=28%2C76&directionsmode=driving');
});
it('rejects absent, invalid and placeholder coordinates and reports opening failures',async()=>{
 for(const point of [undefined,{latitude:0,longitude:0},{latitude:91,longitude:76},{latitude:null,longitude:76},{latitude:28,longitude:NaN}])await expect(openVehicleDirections(point)).rejects.toThrow('no valid GPS');
 expect(native.openURL).not.toHaveBeenCalled();native.canOpenURL.mockResolvedValue(false);native.openURL.mockRejectedValue(new Error('No browser'));await expect(openVehicleDirections({latitude:28,longitude:76})).rejects.toThrow('Could not open Google Maps');
});
