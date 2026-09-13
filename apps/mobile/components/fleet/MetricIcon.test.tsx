import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import { MetricIcon, type MetricIconKind } from './MetricIcon';

vi.mock('react-native', () => ({ View: 'View', Text: 'Text', StyleSheet: { create: (styles: unknown) => styles } }));
vi.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: 'Icon' }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe('reference-style dashboard metric icons', () => {
  it('uses six distinct drawings in the same fixed-size frame', async () => {
    const drawings: string[] = [];
    for (const kind of ['distance', 'fuel', 'speed', 'maxSpeed', 'since', 'lastSync'] satisfies MetricIconKind[]) {
      let tree!: ReactTestRenderer;
      await act(async () => { tree = create(<MetricIcon kind={kind} />); });
      const frame = tree.root.findByProps({ testID: 'metric-icon-' + kind });
      expect(frame.props.style).toMatchObject({ width: 20, height: 20 });
      const json = tree.toJSON() as { children: unknown };
      drawings.push(JSON.stringify(json.children));
      await act(async () => tree.unmount());
    }
    expect(new Set(drawings).size).toBe(6);
    expect(drawings[0]).toContain('KM');
    expect(drawings[0]).not.toContain('gas-station');
    expect(drawings[1]).toContain('gas-station');
    expect(drawings[4]).toContain('SINCE');
  });
});
