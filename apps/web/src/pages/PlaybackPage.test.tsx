import '@testing-library/jest-dom/vitest';
import {cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {MemoryRouter} from 'react-router-dom';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {PlaybackPage} from './PlaybackPage';

const mocks=vi.hoisted(()=>({get:vi.fn()}));
vi.mock('../services/api/client',()=>({api:{get:mocks.get},errorMessage:()=> 'error'}));
vi.mock('../features/map/MapSurface',()=>({PlaybackMap:()=> <div data-testid="playback-map"/>}));

const vehicle={id:'11111111-1111-4111-8111-111111111111',vehicle_number:'RI-TEST-01',owner_id:'owner-1'};
const points=[
 {id:'p1',tracker_timestamp:'2026-09-17T10:00:00.000Z',server_received_at:'2026-09-17T10:00:00.000Z',latitude:28,longitude:77,speed:10,course:0,ignition:true,gps_valid:true,odometer:null,cumulative_distance_km:0,route_avg_speed:20,route_max_speed:30,route_point_count:2},
 {id:'p2',tracker_timestamp:'2026-09-17T10:10:00.000Z',server_received_at:'2026-09-17T10:10:00.000Z',latitude:28.1,longitude:77.1,speed:30,course:0,ignition:true,gps_valid:true,odometer:null,cumulative_distance_km:12.5,route_avg_speed:20,route_max_speed:30,route_point_count:2},
];
const renderPage=(entry='/dashboard/playback')=>render(<MemoryRouter initialEntries={[entry]}><QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><PlaybackPage/></QueryClientProvider></MemoryRouter>);

beforeEach(()=>{mocks.get.mockReset();mocks.get.mockImplementation(async(url:string)=>{if(url==='/dashboard/vehicles')return{data:{data:[vehicle]}};if(url==='/playback')return{data:{data:points,meta:{totalDistanceKm:12.5,avgSpeed:20,maxSpeed:30,pointCount:2,startAt:points[0].tracker_timestamp,endAt:points[1].tracker_timestamp}}};return{data:{data:[]}}})});
afterEach(cleanup);

it('validates playback filters before requesting a route',async()=>{renderPage();fireEvent.click(screen.getByRole('button',{name:'Search route'}));expect(await screen.findByText('Select a vehicle.')).toBeInTheDocument();expect(mocks.get.mock.calls.some(call=>call[0]==='/playback')).toBe(false)});

it('loads an exact report playback deep link',async()=>{renderPage('/dashboard/playback?vehicleId=11111111-1111-4111-8111-111111111111&start=2026-09-17T00%3A00%3A00.000Z&end=2026-09-18T00%3A00%3A00.000Z');await waitFor(()=>expect(mocks.get.mock.calls.some(call=>call[0]==='/playback'&&call[1]?.params.vehicleId===vehicle.id)).toBe(true))});

it('opens the two-month date and time picker with presets, cancel, and apply',async()=>{renderPage();fireEvent.click(screen.getByRole('button',{name:'Choose playback date range'}));let picker=screen.getByRole('dialog',{name:'Choose playback date range'});for(const label of ['Today','Yesterday','Last 7 Days','Custom Range'])expect(within(picker).getByRole('button',{name:label})).toBeVisible();expect(within(picker).getAllByText('Su')).toHaveLength(2);expect(within(picker).getByLabelText('Start hour')).toBeVisible();expect(within(picker).getByLabelText('End minute')).toBeVisible();fireEvent.click(within(picker).getByRole('button',{name:'Cancel'}));expect(screen.queryByRole('dialog',{name:'Choose playback date range'})).not.toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'Choose playback date range'}));picker=screen.getByRole('dialog',{name:'Choose playback date range'});fireEvent.click(within(picker).getByRole('button',{name:'Today'}));fireEvent.click(within(picker).getByRole('button',{name:'Apply'}));expect(screen.queryByRole('dialog',{name:'Choose playback date range'})).not.toBeInTheDocument()});

it('uses one playback index for the map, scrubber, and backend-computed metric chips',async()=>{renderPage('/dashboard/playback?vehicleId=11111111-1111-4111-8111-111111111111&start=2026-09-17T00%3A00%3A00.000Z&end=2026-09-18T00%3A00%3A00.000Z');expect(await screen.findByText('12.50 km')).toBeVisible();const distance=screen.getByText('Distance').parentElement!;expect(within(distance).getByText('0.00 km')).toBeVisible();fireEvent.change(screen.getByRole('slider',{name:'Playback position'}),{target:{value:'1'}});expect(within(distance).getByText('12.50 km')).toBeVisible();expect(within(screen.getByText('Avg speed').parentElement!).getByText('20 km/h')).toBeVisible();expect(within(screen.getByText('Max speed').parentElement!).getByText('30 km/h')).toBeVisible();fireEvent.click(screen.getByRole('button',{name:'Toggle playback filters'}));expect(screen.getByRole('button',{name:'Toggle playback filters'})).toHaveAttribute('aria-pressed','false');expect(screen.getByTestId('playback-map')).toBeInTheDocument()});
