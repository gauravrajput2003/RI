import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { expect, it, vi } from 'vitest';
import { VehicleIcon } from './VehicleIcon';
import { vehicleImageSource } from '../../features/vehicles/artwork';
vi.mock('react-native', () => ({ Image: 'Image', View: 'View', StyleSheet: { create: (s: unknown) => s } }));
vi.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: 'Icon' }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

it.each(['bike', 'scooter', 'car', 'bus', 'truck'])('renders bundled web artwork for %s in every tracker state', async type => {
  for (const [state, file] of [['MOVING', 'running'], ['IDLE', 'idle'], ['STOPPED', 'stopped'], ['OFFLINE', 'unreachable'], ['OVERSPEED', 'running'], ['NEW', 'unreachable']] as const) {
    let tree!: ReactTestRenderer;
    await act(async () => { tree = create(<VehicleIcon type={type} state={state} />); });
    const image = tree.root.findByType('Image' as React.ElementType);
    expect(image.props.source).toContain(`/vehicles/${type}/${file}.png`);
    expect(image.props.resizeMode).toBe('contain');
    await act(async () => tree.unmount());
  }
});
it('normalizes web vehicle names and keeps the fallback for missing van artwork', () => {
  expect(vehicleImageSource('motor bike', 'RUNNING')).toContain('/bike/running.png');
  expect(vehicleImageSource('Scooty', 'STOPPED')).toContain('/scooter/stopped.png');
  expect(vehicleImageSource('delivery van', 'IDLE')).toBeNull();
});
