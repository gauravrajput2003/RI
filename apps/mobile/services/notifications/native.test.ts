import {beforeEach,it,expect,vi} from 'vitest';
const environment=vi.hoisted(()=>({ownership:'standalone',execution:'standalone',os:'android'}));
vi.mock('expo-constants',()=>({default:{get appOwnership(){return environment.ownership;},get executionEnvironment(){return environment.execution;}}}));
vi.mock('react-native',()=>({Platform:{get OS(){return environment.os;}}}));
import {loadNativeNotifications} from './native';
beforeEach(()=>{environment.ownership='standalone';environment.execution='standalone';environment.os='android';});
it('never imports the remote push module in Expo Go or the web',()=>{
 const loader=vi.fn(()=>{throw new Error('Remote push is unavailable in Expo Go');});
 environment.ownership='expo';expect(loadNativeNotifications(loader)).toBeNull();
 environment.ownership='standalone';environment.execution='storeClient';expect(loadNativeNotifications(loader)).toBeNull();
 environment.execution='standalone';environment.os='web';expect(loadNativeNotifications(loader)).toBeNull();
 expect(loader).not.toHaveBeenCalled();
});
it('loads remote push in an installed native build',()=>{
 const loader=vi.fn(()=>({}) as typeof import('expo-notifications'));
 expect(loadNativeNotifications(loader)).not.toBeNull();expect(loader).toHaveBeenCalledOnce();
});
