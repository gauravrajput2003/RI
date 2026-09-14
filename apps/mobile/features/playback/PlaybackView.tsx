import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather, MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import MapView, { Marker, Polyline, type Region } from 'react-native-maps';
import { useHistory } from '../vehicles/queries';
import { hasPosition } from '../map/viewport';
import {
  calculateRouteStats,
  formatDate,
  formatDateTime,
  formatDuration,
  formatTime,
  parseDateTime,
} from './route';

export default function PlaybackView() {
  const map = useRef<MapView>(null);
  const router = useRouter();
  const params = useLocalSearchParams<{ vehicleId?: string; vehicleNumber?: string }>();
  const vehicleId = params.vehicleId ?? '';
  const vehicleNumber = params.vehicleNumber ?? 'Vehicle';

  const today = useMemo(() => new Date(), []);
  const defaultStartDate = useMemo(() => formatDate(today), [today]);
  const defaultDueDate = useMemo(() => formatDate(today), [today]);

  const [startDateStr, setStartDateStr] = useState(defaultStartDate);
  const [startTimeStr, setStartTimeStr] = useState('00:00');
  const [dueDateStr, setDueDateStr] = useState(defaultDueDate);
  const [dueTimeStr, setDueTimeStr] = useState('23:59');

  const [formOpen, setFormOpen] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  const [confirmedRange, setConfirmedRange] = useState<{ from: Date; to: Date } | null>(null);
  const [playbackIndex, setPlaybackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const query = useHistory(
    vehicleId,
    confirmedRange?.from ?? null,
    confirmedRange?.to ?? null,
    Boolean(confirmedRange && vehicleId)
  );

  const points = useMemo(() => query.data ?? [], [query.data]);
  const stats = useMemo(() => calculateRouteStats(points), [points]);

  const onConfirmForm = () => {
    const from = parseDateTime(startDateStr, startTimeStr);
    const to = parseDateTime(dueDateStr, dueTimeStr);

    if (!from || !to) {
      setFormError('Please enter valid dates (DD/MM/YYYY) and times (HH:MM)');
      return;
    }

    if (from.getTime() >= to.getTime()) {
      setFormError('Start date/time must be before due date/time');
      return;
    }

    setFormError(null);
    setConfirmedRange({ from, to });
    setPlaybackIndex(0);
    setIsPlaying(false);
    setFormOpen(false);
  };

  const onCancelForm = () => {
    if (!confirmedRange) {
      router.back();
    } else {
      setFormOpen(false);
    }
  };

  const initialRegion = useMemo<Region | undefined>(() => {
    if (points.length === 0) {
      return {
        latitude: 28.8950,
        longitude: 76.6050,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      };
    }
    const first = points[0];
    return {
      latitude: first.latitude ?? 28.8950,
      longitude: first.longitude ?? 76.6050,
      latitudeDelta: 0.08,
      longitudeDelta: 0.08,
    };
  }, [points]);

  const polylineCoords = useMemo(
    () =>
      points
        .filter(hasPosition)
        .map(p => ({ latitude: p.latitude as number, longitude: p.longitude as number })),
    [points]
  );

  const fitRoute = useCallback(() => {
    if (polylineCoords.length === 1) {
      map.current?.animateToRegion({ ...polylineCoords[0], latitudeDelta: 0.02, longitudeDelta: 0.02 }, 250);
    } else if (polylineCoords.length > 1) {
      map.current?.fitToCoordinates(polylineCoords, {
        edgePadding: { top: 40, right: 40, bottom: 60, left: 40 },
        animated: false,
      });
    }
  }, [polylineCoords]);
  useEffect(() => { fitRoute(); }, [fitRoute]);

  const startPoint = polylineCoords[0];
  const endPoint = polylineCoords.length > 1 ? polylineCoords[polylineCoords.length - 1] : undefined;

  const currentPoint = points[playbackIndex] ?? points[points.length - 1];
  const currentSpeed = currentPoint?.speed ?? 0;
  const currentTimestamp = currentPoint
    ? formatTime(new Date(currentPoint.tracker_timestamp || currentPoint.server_received_at))
    : '--';

  return (
    <View style={styles.page}>
      {/* Top Header Bar */}
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Feather name="arrow-left" size={24} color="#111" />
        </Pressable>
        <View style={styles.titleContainer}>
          <Text style={styles.headerTitle}>{vehicleNumber} History</Text>
          <Text style={styles.headerSubtitle}>
            {confirmedRange
              ? `${formatDateTime(confirmedRange.from)} - ${formatDateTime(confirmedRange.to)}`
              : `${startDateStr} 00:00:00 - ${dueDateStr} 23:59:59`}
          </Text>
        </View>
      </View>

      {/* Mini Stats Strip */}
      <View style={styles.miniStatsBar}>
        <View style={styles.miniStat}>
          <View style={styles.miniStatRow}>
            <MaterialCommunityIcons name="map-marker-distance" size={16} color="#0f766e" />
            <Text style={styles.miniStatLabel}>KM Covered</Text>
          </View>
          <Text style={styles.miniStatValue}>{stats.kmTravelled} KM</Text>
        </View>
        <View style={styles.miniStatDivider} />
        <View style={styles.miniStat}>
          <View style={styles.miniStatRow}>
            <MaterialCommunityIcons name="clock-outline" size={16} color="#0284c7" />
            <Text style={styles.miniStatLabel}>GPS Timestamp</Text>
          </View>
          <Text style={styles.miniStatValue}>{currentTimestamp}</Text>
        </View>
        <View style={styles.miniStatDivider} />
        <View style={styles.miniStat}>
          <View style={styles.miniStatRow}>
            <MaterialCommunityIcons name="speedometer" size={16} color="#e11d48" />
            <Text style={styles.miniStatLabel}>Current Speed</Text>
          </View>
          <Text style={styles.miniStatValue}>{currentSpeed} KMH</Text>
        </View>
      </View>

      {/* Map View */}
      <View style={styles.mapContainer}>
        {query.isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#ef4444" />
            <Text style={styles.loadingText}>Loading route playback...</Text>
          </View>
        ) : (
          <MapView ref={map} style={styles.map} initialRegion={initialRegion} onMapReady={fitRoute}>
            {polylineCoords.length > 1 ? (
              <Polyline coordinates={polylineCoords} strokeColor="#000000" strokeWidth={3.5} />
            ) : null}

            {/* Start Marker */}
            {startPoint ? (
              <Marker coordinate={startPoint} title="Start" pinColor="#22c55e">
                <View style={[styles.markerBadge, { backgroundColor: '#22c55e' }]}>
                  <Text style={styles.markerText}>S</Text>
                </View>
              </Marker>
            ) : null}

            {/* End Marker */}
            {endPoint ? (
              <Marker coordinate={endPoint} title="End" pinColor="#ef4444">
                <View style={[styles.markerBadge, { backgroundColor: '#ef4444' }]}>
                  <Text style={styles.markerText}>E</Text>
                </View>
              </Marker>
            ) : null}

            {/* Halt Markers */}
            {stats.halts.map(halt => (
              <Marker
                key={`halt-${halt.haltIndex}`}
                coordinate={{ latitude: halt.latitude, longitude: halt.longitude }}
                title={`Halt ${halt.haltIndex} (${formatDuration(halt.durationSeconds)})`}
                pinColor="#dc2626"
              >
                <View style={styles.haltBadge}>
                  <Text style={styles.haltText}>{halt.haltIndex}</Text>
                </View>
              </Marker>
            ))}
          </MapView>
        )}

        {/* Speed Multiplier Badge */}
        <View style={styles.speedTag}>
          <Text style={styles.speedTagText}>4x</Text>
        </View>
      </View>

      {/* Bottom Controls & Stats Panel */}
      <View style={styles.bottomPanel}>
        {/* Scrubber / Progress Bar */}
        <View style={styles.scrubberContainer}>
          <View style={styles.scrubberTrack}>
            <View
              style={[
                styles.scrubberProgress,
                {
                  width:
                    points.length > 0
                      ? `${Math.min(100, ((playbackIndex + 1) / points.length) * 100)}%`
                      : '0%',
                },
              ]}
            />
            <View
              style={[
                styles.scrubberThumb,
                {
                  left:
                    points.length > 0
                      ? `${Math.min(95, ((playbackIndex + 1) / points.length) * 100)}%`
                      : 0,
                },
              ]}
            />
          </View>
          <View style={styles.controlsRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isPlaying ? 'Pause playback' : 'Start playback'}
              onPress={() => setIsPlaying(!isPlaying)}
              style={styles.playButton}
            >
              <Ionicons
                name={isPlaying ? 'pause' : 'play'}
                size={22}
                color="#fff"
                style={{ marginLeft: isPlaying ? 0 : 2 }}
              />
            </Pressable>
            <View style={styles.controlActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Filter date range"
                onPress={() => setFormOpen(true)}
                style={styles.actionIcon}
              >
                <Ionicons name="funnel-outline" size={22} color="#475569" />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Playback settings"
                style={styles.actionIcon}
              >
                <Ionicons name="options-outline" size={22} color="#475569" />
              </Pressable>
            </View>
          </View>
        </View>

        {/* 2x3 Detailed Stats Grid */}
        <View style={styles.statsGrid}>
          {/* Row 1 */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <View style={styles.statCardHeader}>
                <MaterialCommunityIcons name="map-marker-outline" size={18} color="#ef4444" />
                <Text style={styles.statCardTitle}>KM Travelled</Text>
              </View>
              <Text style={styles.statCardValue}>{stats.kmTravelled}KM</Text>
            </View>
            <View style={styles.statCard}>
              <View style={styles.statCardHeader}>
                <MaterialCommunityIcons name="timer-outline" size={18} color="#22c55e" />
                <Text style={styles.statCardTitle}>Total Running</Text>
              </View>
              <Text style={styles.statCardValue}>{formatDuration(stats.totalRunningSeconds)}</Text>
            </View>
            <View style={styles.statCard}>
              <View style={styles.statCardHeader}>
                <MaterialCommunityIcons name="speedometer-slow" size={18} color="#0284c7" />
                <Text style={styles.statCardTitle}>Avg Speed</Text>
              </View>
              <Text style={styles.statCardValue}>{stats.avgSpeedKmh}KMH</Text>
            </View>
          </View>

          {/* Row 2 */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <View style={styles.statCardHeader}>
                <MaterialCommunityIcons name="gas-station" size={18} color="#f59e0b" />
                <Text style={styles.statCardTitle}>Halt Count</Text>
              </View>
              <Text style={styles.statCardValue}>{stats.haltCount}</Text>
            </View>
            <View style={styles.statCard}>
              <View style={styles.statCardHeader}>
                <MaterialCommunityIcons name="clock-alert-outline" size={18} color="#dc2626" />
                <Text style={styles.statCardTitle}>Total Stoppage</Text>
              </View>
              <Text style={styles.statCardValue}>{formatDuration(stats.totalStoppageSeconds)}</Text>
            </View>
            <View style={styles.statCard}>
              <View style={styles.statCardHeader}>
                <MaterialCommunityIcons name="speedometer" size={18} color="#8b5cf6" />
                <Text style={styles.statCardTitle}>Max Speed</Text>
              </View>
              <Text style={styles.statCardValue}>{stats.maxSpeedKmh}KMH</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Date/Time Filter Dialog Modal */}
      <Modal
        visible={formOpen}
        transparent
        animationType="fade"
        onRequestClose={onCancelForm}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.dialogCard}>
            {/* Red Top Header */}
            <View style={styles.dialogHeader}>
              <Text style={styles.dialogHeaderText}>{vehicleNumber}</Text>
            </View>

            {/* Dialog Form Body */}
            <View style={styles.dialogBody}>
              {/* Start Date */}
              <Text style={styles.fieldLabel}>Start Date</Text>
              <View style={styles.inputRow}>
                <TextInput
                  accessibilityLabel="Start date"
                  value={startDateStr}
                  onChangeText={setStartDateStr}
                  placeholder="DD/MM/YYYY"
                  placeholderTextColor="#999"
                  style={[styles.inputField, { flex: 1.2 }]}
                />
                <TextInput
                  accessibilityLabel="Start time"
                  value={startTimeStr}
                  onChangeText={setStartTimeStr}
                  placeholder="00:00"
                  placeholderTextColor="#999"
                  style={[styles.inputField, { flex: 0.8 }]}
                />
              </View>

              {/* Due Date */}
              <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Due Date</Text>
              <View style={styles.inputRow}>
                <TextInput
                  accessibilityLabel="Due date"
                  value={dueDateStr}
                  onChangeText={setDueDateStr}
                  placeholder="DD/MM/YYYY"
                  placeholderTextColor="#999"
                  style={[styles.inputField, { flex: 1.2 }]}
                />
                <TextInput
                  accessibilityLabel="Due time"
                  value={dueTimeStr}
                  onChangeText={setDueTimeStr}
                  placeholder="23:59"
                  placeholderTextColor="#999"
                  style={[styles.inputField, { flex: 0.8 }]}
                />
              </View>

              {/* Error validation message */}
              {formError ? <Text style={styles.errorText}>{formError}</Text> : null}

              {/* Action Buttons */}
              <View style={styles.dialogActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Confirm playback range"
                  onPress={onConfirmForm}
                  style={styles.confirmCircle}
                >
                  <Ionicons name="checkmark" size={28} color="#22c55e" />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Cancel playback dialog"
                  onPress={onCancelForm}
                  style={styles.cancelCircle}
                >
                  <Ionicons name="close" size={28} color="#ef4444" />
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#f1f5f9' },
  header: {
    height: 52,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backButton: {
    padding: 6,
    marginRight: 8,
  },
  titleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  miniStatsBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  miniStat: {
    flex: 1,
    alignItems: 'center',
  },
  miniStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  miniStatLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  miniStatValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 2,
  },
  miniStatDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#e2e8f0',
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    ...StyleSheet.absoluteFill,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    fontSize: 14,
    color: '#64748b',
  },
  markerBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  markerText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  haltBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  haltText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  speedTag: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  speedTagText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
  },
  bottomPanel: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 12,
    paddingBottom: 8,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  scrubberContainer: {
    marginBottom: 12,
  },
  scrubberTrack: {
    height: 4,
    backgroundColor: '#e2e8f0',
    borderRadius: 2,
    position: 'relative',
    marginHorizontal: 8,
    marginBottom: 10,
  },
  scrubberProgress: {
    height: 4,
    backgroundColor: '#ef4444',
    borderRadius: 2,
  },
  scrubberThumb: {
    position: 'absolute',
    top: -4,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ef4444',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  playButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#65a30d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  actionIcon: {
    padding: 6,
  },
  statsGrid: {
    gap: 8,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  statCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  statCardTitle: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
  },
  statCardValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  // Modal & Dialog
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dialogCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  dialogHeader: {
    backgroundColor: '#ee1526',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogHeaderText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  dialogBody: {
    padding: 20,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    fontStyle: 'italic',
    color: '#df8c17',
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  inputField: {
    borderBottomWidth: 1.5,
    borderBottomColor: '#334155',
    paddingVertical: 4,
    paddingHorizontal: 2,
    fontSize: 15,
    color: '#0f172a',
    fontWeight: '500',
  },
  errorText: {
    marginTop: 10,
    fontSize: 12,
    color: '#ef4444',
    textAlign: 'center',
  },
  dialogActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 32,
    marginTop: 24,
  },
  confirmCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  cancelCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
});
