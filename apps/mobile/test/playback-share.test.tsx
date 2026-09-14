import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Share, type ShareContent } from 'react-native';
import { ShareSheet, shareDurations } from '../components/fleet/ShareSheet';
import { createDemoAdapter } from '../features/demo/adapter';
import PlaybackViewWeb from '../features/playback/PlaybackView.web';
import axios from 'axios';
import { calculateRouteStats } from '../features/playback/route';

vi.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  Pressable: 'Pressable',
  Modal: ({ children, visible }: { children: React.ReactNode; visible: boolean }) =>
    visible ? React.createElement('Modal', null, children) : null,
  StyleSheet: { create: (s: unknown) => s, absoluteFill: {} },
  Share: {
    share: vi.fn(),
  },
}));

vi.mock('expo-router', () => ({
  router: { push: vi.fn(), back: vi.fn() },
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  useLocalSearchParams: () => ({ vehicleId: 'demo-car', vehicleNumber: 'HR12AY6674' }),
}));

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

vi.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: 'MaterialCommunityIcons',
  Feather: 'Feather',
  Ionicons: 'Ionicons',
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe('ShareSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all duration options and calls Share.share with clear disclaimer', async () => {
    let tree!: ReactTestRenderer;
    const onClose = vi.fn();
    await act(async () => {
      tree = create(<ShareSheet vehicleNumber="HR12AY6674" onClose={onClose} />);
    });

    const buttons = tree.root
      .findAllByType('Pressable' as React.ElementType)
      .filter(p => p.props.accessibilityLabel?.startsWith('Share for '));
    expect(buttons.length).toBe(shareDurations.length);

    // Tap first option (15 Minutes)
    await act(async () => {
      await buttons[0].props.onPress();
    });

    expect(Share.share).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Vehicle HR12AY6674 Share',
        message: expect.stringContaining('HR12AY6674'),
      })
    );

    // Verify it plainly states that live tracking link is unavailable (does not fabricate a fake link)
    const callArg = (vi.mocked(Share.share).mock.calls[0][0] as ShareContent).message;
    expect(callArg).toContain('unavailable');
    expect(callArg).not.toContain('http://');
    expect(callArg).not.toContain('https://');
    expect(onClose).toHaveBeenCalled();

    await act(async () => tree.unmount());
  });
});

describe('Demo History & Playback API Integration', () => {
  it('calls getHistory in demo mode through the demo adapter and calculates realistic stats', async () => {
    const demoClient = axios.create({
      baseURL: 'https://demo.local/api/v1',
      adapter: createDemoAdapter(),
      headers: { Authorization: 'Bearer local-demo-access-not-a-jwt' },
    });

    const { data: resp } = await demoClient.get('/vehicles/demo-car/history', {
      params: {
        from: '2026-09-13T00:00:00.000Z',
        to: '2026-09-13T23:59:59.000Z',
      },
    });

    expect(resp.success).toBe(true);
    expect(Array.isArray(resp.data)).toBe(true);
    expect(resp.data.length).toBeGreaterThan(0);

    const stats = calculateRouteStats(resp.data);
    expect(stats.kmTravelled).toBeGreaterThan(0);
    expect(stats.totalRunningSeconds).toBeGreaterThan(0);
    expect(stats.maxSpeedKmh).toBeGreaterThan(0);
  });

  it('renders PlaybackViewWeb safely for web platform boundary', async () => {
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(<PlaybackViewWeb />);
    });
    expect(JSON.stringify(tree.toJSON())).toContain('Playback Map available on Android and iOS');
    await act(async () => tree.unmount());
  });
});

