import {describe,it,expect,vi,afterEach} from 'vitest';
import {dateKey,presetDates,reportRange,reportDuration,reportNumber} from './dates';
afterEach(()=>vi.useRealTimers());
describe('India calendar report filters',()=>{
 const now=new Date('2026-10-16T00:00:00Z');
 it.each([['Today','2026-10-16','2026-10-16'],['Yesterday','2026-10-15','2026-10-15'],['This Week','2026-10-12','2026-10-16'],['Last Week','2026-10-05','2026-10-11'],['This Month','2026-10-01','2026-10-16'],['Last Month','2026-09-01','2026-09-30']] as const)('%s selects its own calendar boundaries',(preset,from,to)=>{expect(presetDates(preset,now)).toEqual({from,to})});
 it('uses India midnight and an exclusive next-day end',()=>{vi.useFakeTimers();vi.setSystemTime(now);expect(reportRange('2026-10-01','2026-10-16')).toEqual({start:'2026-09-30T18:30:00.000Z',end:'2026-10-16T18:30:00.000Z',timeZone:'Asia/Kolkata'});expect(dateKey(new Date('2026-10-15T19:00:00Z'))).toBe('2026-10-16')});
 it('handles year, leap month and Monday boundaries',()=>{expect(presetDates('Last Month',new Date('2024-03-01T12:00:00Z'))).toEqual({from:'2024-02-01',to:'2024-02-29'});expect(presetDates('Last Week',new Date('2026-01-01T12:00:00Z'))).toEqual({from:'2025-12-22',to:'2025-12-28'})});
 it('rejects reversed, oversized, impossible and future ranges',()=>{vi.useFakeTimers();vi.setSystemTime(now);for(const [a,b] of [['2026-10-16','2026-10-01'],['2026-08-01','2026-10-01'],['2026-02-30','2026-03-01'],['2026-10-17','2026-10-17']])expect(()=>reportRange(a,b)).toThrow()});
 it('keeps unknown values separate from genuine zero',()=>{expect(reportNumber(null)).toBe('—');expect(reportNumber(0)).toBe('0');expect(reportDuration(null)).toBe('—');expect(reportDuration(0)).toBe('00:00:00')});
});
