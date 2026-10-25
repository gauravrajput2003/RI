import {expect,it,vi} from 'vitest';
import type {Socket} from 'node:net';
import {TrackerSockets} from '../src/transport/tracker-sockets.js';
it('replaces by IMEI, destroys the old socket and ignores a late close of that old socket',()=>{
 const registry=new TrackerSockets(),old={destroy:vi.fn()} as unknown as Socket,next={destroy:vi.fn()} as unknown as Socket;
 registry.replace({imei:'864943046904351',deviceId:'uuid',connectionId:'old',protocol:'GT06',socket:old});
 registry.replace({imei:'864943046904351',deviceId:'uuid',connectionId:'new',protocol:'GT06',socket:next});
 expect(old.destroy).toHaveBeenCalledOnce();registry.remove('old',old);expect(registry.get('864943046904351')?.socket).toBe(next);
 registry.remove('new',old);expect(registry.byDevice('uuid')?.socket).toBe(next);
 registry.remove('new',next);expect(registry.get('864943046904351')).toBeUndefined();
});
