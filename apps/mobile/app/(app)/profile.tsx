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
            <View style={[styles.actionIconBadge, { backgroundColor: '#fee2e2' }]}>
              <MaterialCommunityIcons name="car" size={28} color="#dc2626" />
            </View>
            <Text style={styles.quickActionLabel}>Vehicle</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View Subscriptions"
            style={styles.quickAction}
            onPress={() => router.push('/(app)/subscription')}
          >
            <View style={[styles.actionIconBadge, { backgroundColor: '#e0f2fe' }]}>
              <MaterialCommunityIcons name="calendar-month" size={28} color="#0284c7" />
            </View>
            <Text style={styles.quickActionLabel}>Subscription</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open Settings"
            style={styles.quickAction}
            onPress={() => router.push('/(app)/settings')}
          >
            <View style={[styles.actionIconBadge, { backgroundColor: '#fef3c7' }]}>
              <MaterialCommunityIcons name="cog" size={28} color="#d97706" />
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
            onPress={() => router.push('/(app)')}
          >
            <View style={[styles.menuIconBadge, { backgroundColor: '#e0e7ff' }]}>
              <MaterialCommunityIcons name="view-dashboard" size={22} color="#4f46e5" />
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
            <View style={[styles.menuIconBadge, { backgroundColor: '#dcfce7' }]}>
              <MaterialCommunityIcons name="map-marker-path" size={22} color="#16a34a" />
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
            <View style={[styles.menuIconBadge, { backgroundColor: '#fef9c3' }]}>
              <MaterialCommunityIcons name="shield-check" size={22} color="#ca8a04" />
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
            <View style={[styles.menuIconBadge, { backgroundColor: '#e0f2fe' }]}>
              <MaterialCommunityIcons name="lock-reset" size={22} color="#0284c7" />
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
            <View style={[styles.menuIconBadge, { backgroundColor: '#fee2e2' }]}>
              <MaterialCommunityIcons name="account-arrow-right" size={22} color="#dc2626" />
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
    paddingBottom: 28,
  },
  headerCard: {
    backgroundColor: '#ee0509',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 24,
    gap: 16,
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
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
    fontSize: 40,
    fontWeight: '800',
    color: '#ee0509',
  },
  headerInfo: {
    flex: 1,
    gap: 4,
  },
  userName: {
    fontSize: 21,
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
    marginTop: 16,
    borderRadius: 18,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  quickAction: {
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  actionIconBadge: {
    width: 54,
    height: 54,
    borderRadius: 27,
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
    marginTop: 16,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 6,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 14,
  },
  lastMenuItem: {
    borderBottomWidth: 0,
  },
  menuIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
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
    marginTop: 20,
    borderRadius: 16,
    paddingVertical: 15,
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
    fontSize: 17,
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
