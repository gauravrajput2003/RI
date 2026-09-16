import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { logout } from '../../services/api/auth';
import { demoUserProfile } from '../../features/demo/data';
import { NoticeSheet } from '../../components/fleet/Sheet';
import { config } from '../../constants/config';

export default function Profile() {
  const [error, setError] = useState(false);
  const [modalType, setModalType] = useState<string | null>(null);

  // The current backend has no profile endpoint; do not infer identity from demo data.
  const user = config.demoMode ? demoUserProfile : null;

  const signOut = async () => {
    try {
      await logout();
    } catch {
      setError(true);
      return;
    }
    router.replace('/(auth)/login');
  };

  return (
    <View style={styles.page}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Red Header Card */}
        <View style={styles.headerCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.avatarLetter ?? '—'}</Text>
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.userName}>{user?.name ?? 'Profile unavailable'}</Text>
            <View style={styles.contactRow}>
              <Feather name="mail" size={14} color="#fff" style={styles.contactIcon} />
              <Text style={styles.contactText}>{user?.email ?? 'Email unavailable'}</Text>
            </View>
            <View style={styles.contactRow}>
              <Feather name="phone" size={14} color="#fff" style={styles.contactIcon} />
              <Text style={styles.contactText}>{user?.phone ?? 'Phone unavailable'}</Text>
            </View>
          </View>
        </View>

        {/* Quick Actions Card (Vehicle, Subscription, Settings) */}
        <View style={styles.quickActionsCard}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View Vehicle List"
            style={styles.quickAction}
            onPress={() => router.push('/(app)/vehicles')}
          >
            <View style={styles.actionIconBadge}>
              <MaterialCommunityIcons name="car" size={28} color="#ef4444" />
            </View>
            <Text style={styles.quickActionLabel}>Vehicle</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View Subscriptions"
            style={styles.quickAction}
            onPress={() => router.push('/(app)/subscription')}
          >
            <View style={styles.actionIconBadge}>
              <MaterialCommunityIcons name="calendar-clock" size={28} color="#2563eb" />
            </View>
            <Text style={styles.quickActionLabel}>Subscription</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open Settings"
            style={styles.quickAction}
            onPress={() => router.push('/(app)/settings')}
          >
            <View style={styles.actionIconBadge}>
              <MaterialCommunityIcons name="cog" size={30} color="#d4a017" />
            </View>
            <Text style={styles.quickActionLabel}>Settings</Text>
          </Pressable>
        </View>

        {/* Main Navigation Menu List */}
        <View style={styles.menuCard}>
          {/* Dashboard */}
          <Pressable
            accessibilityRole="button"
            style={styles.menuItem}
            onPress={() => router.replace('/(app)')}
          >
            <View style={styles.menuIconBadge}>
              <MaterialCommunityIcons name="monitor-dashboard" size={27} color="#818cf8" />
            </View>
            <Text style={styles.menuText}>Dashboard</Text>
            <Feather name="chevron-right" size={20} color="#9ca3af" />
          </Pressable>

          {/* Playback */}
          <Pressable
            accessibilityRole="button"
            style={styles.menuItem}
            onPress={() => setModalType('playback')}
          >
            <View style={styles.menuIconBadge}>
              <MaterialCommunityIcons name="map-marker-path" size={28} color="#65a30d" />
            </View>
            <Text style={styles.menuText}>Playback</Text>
            <Feather name="chevron-right" size={20} color="#9ca3af" />
          </Pressable>

          {/* Privacy Policy */}
          <Pressable
            accessibilityRole="button"
            style={styles.menuItem}
            onPress={() => setModalType('privacy')}
          >
            <View style={styles.menuIconBadge}>
              <MaterialCommunityIcons name="shield-check" size={28} color="#fbbf24" />
            </View>
            <Text style={styles.menuText}>Privacy Policy</Text>
            <Feather name="chevron-right" size={20} color="#9ca3af" />
          </Pressable>

          {/* Change Password */}
          <Pressable
            accessibilityRole="button"
            style={styles.menuItem}
            onPress={() => setModalType('changePassword')}
          >
            <View style={styles.menuIconBadge}>
              <MaterialCommunityIcons name="lock" size={27} color="#38bdf8" />
              <MaterialCommunityIcons name="key" size={16} color="#f59e0b" style={styles.passwordKey} />
            </View>
            <Text style={styles.menuText}>Change Password</Text>
            <Feather name="chevron-right" size={20} color="#9ca3af" />
          </Pressable>

          {/* Logout All Devices */}
          <Pressable
            accessibilityRole="button"
            style={[styles.menuItem, styles.lastMenuItem]}
            onPress={() => setModalType('logoutAll')}
          >
            <View style={styles.menuIconBadge}>
              <MaterialCommunityIcons name="cellphone-arrow-down" size={28} color="#f59e0b" />
            </View>
            <Text style={styles.menuText}>Logout All Devices</Text>
            <Feather name="chevron-right" size={20} color="#9ca3af" />
          </Pressable>
        </View>

        {/* Big Red Logout Button */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sign out of account"
          onPress={signOut}
          style={styles.logoutButton}
        >
          <MaterialCommunityIcons name="power" size={20} color="#fff" style={styles.powerIcon} />
          <Text style={styles.logoutButtonText}>Logout</Text>
        </Pressable>

        {error ? (
          <Text style={styles.errorText}>
            Could not remove saved credentials. Please retry signing out.
          </Text>
        ) : null}
      </ScrollView>

      {/* Sheets / Dialogs for UI Actions */}
      <NoticeSheet
        message={modalType === 'playback' ? 'Playback tracking history will be available once devices stream past route telemetry.' : null}
        onClose={() => setModalType(null)}
      />

      <NoticeSheet
        message={modalType === 'privacy' ? 'Privacy policy unavailable.' : null}
        onClose={() => setModalType(null)}
      />

      <NoticeSheet
        message={modalType === 'changePassword' ? 'Password changes are unavailable. No email has been sent.' : null}
        onClose={() => setModalType(null)}
      />

      <NoticeSheet message={modalType === 'logoutAll' ? 'Signing out all devices is unavailable. Logout signs out only this session.' : null} onClose={() => setModalType(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  content: {
    paddingBottom: 8,
    flexGrow: 1,
  },
  headerCard: {
    backgroundColor: '#ee0509',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 16,
    gap: 14,
  },
  avatar: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  avatarText: {
    fontSize: 36,
    fontWeight: '800',
    color: '#ee0509',
  },
  headerInfo: {
    flex: 1,
    gap: 4,
  },
  userName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  contactIcon: {
    marginRight: 2,
  },
  contactText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#fff',
  },
  quickActionsCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  quickAction: {
    alignItems: 'center',
    gap: 2,
    flex: 1,
  },
  actionIconBadge: {
    width: 38,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
  },
  menuCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 9,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 3,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 10,
  },
  lastMenuItem: {
    borderBottomWidth: 0,
  },
  menuIconBadge: {
    width: 34,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  passwordKey: {
    position: 'absolute',
    right: -1,
    bottom: 1,
  },
  menuText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  logoutButton: {
    backgroundColor: '#ee0509',
    marginHorizontal: 16,
    marginTop: 9,
    marginBottom: 8,
    borderRadius: 12,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#ee0509',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  powerIcon: {
    marginRight: 6,
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 12,
    marginHorizontal: 20,
  },
  dialogText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#334155',
    marginVertical: 12,
    paddingHorizontal: 8,
  },
  dialogActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 12,
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  confirmBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#ee0509',
  },
  confirmBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
});
