import { Image, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSettingsStore } from '../../store/settingsStore';

export default function SettingsScreen() {
  const settings = useSettingsStore();

  const renderRadio = (option: 'Menu' | 'Report' | 'Dashboard') => {
    const isSelected = settings.landingPage === option;
    return (
      <Pressable
        key={option}
        accessibilityRole="radio"
        accessibilityState={{ selected: isSelected }}
        onPress={() => settings.setSetting('landingPage', option)}
        style={styles.radioRow}
      >
        <Text style={styles.optionLabel}>{option}</Text>
        <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
          {isSelected ? <View style={styles.radioInner} /> : null}
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          hitSlop={10}
          style={styles.backButton}
        >
          <Feather name="arrow-left" size={24} color="#111" />
        </Pressable>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Language Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Language</Text>
          <View style={styles.card}>
            <View style={styles.languageRow}>
              <Image
                source={require('../../assets/indianflag.png')}
                style={styles.flagImage}
                resizeMode="contain"
              />
              <View style={styles.languageTextContainer}>
                <Text style={styles.languageTitle}>English</Text>
                <Text style={styles.languageSubtitle}>Change app language</Text>
              </View>
              <Feather name="chevron-right" size={20} color="#9ca3af" />
            </View>
          </View>
        </View>

        {/* Alert Notification Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Alert Notification</Text>
            <Switch
              value={settings.alertNotification}
              onValueChange={() => settings.toggleSetting('alertNotification')}
              trackColor={{ false: '#cbd5e1', true: '#fca5a5' }}
              thumbColor={settings.alertNotification ? '#ee0509' : '#f8fafc'}
            />
          </View>
          <View style={styles.card}>
            <View style={styles.switchRow}>
              <Text style={styles.optionLabel}>Sound</Text>
              <Switch
                value={settings.sound}
                onValueChange={() => settings.toggleSetting('sound')}
                trackColor={{ false: '#cbd5e1', true: '#93c5fd' }}
                thumbColor={settings.sound ? '#ee0509' : '#f8fafc'}
              />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.optionLabel}>Vibration</Text>
              <Switch
                value={settings.vibration}
                onValueChange={() => settings.toggleSetting('vibration')}
                trackColor={{ false: '#cbd5e1', true: '#93c5fd' }}
                thumbColor={settings.vibration ? '#ee0509' : '#f8fafc'}
              />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.optionLabel}>Voice Assistance</Text>
              <Switch
                value={settings.voiceAssistance}
                onValueChange={() => settings.toggleSetting('voiceAssistance')}
                trackColor={{ false: '#e2e8f0', true: '#93c5fd' }}
                thumbColor={settings.voiceAssistance ? '#ee0509' : '#64748b'}
              />
            </View>
          </View>
        </View>

        {/* Landing Page Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Landing Page</Text>
          <View style={styles.card}>
            {(['Menu', 'Report', 'Dashboard'] as const).map(renderRadio)}
          </View>
        </View>

        {/* Live Map Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Live Map</Text>
          <View style={styles.card}>
            <View style={styles.switchRow}>
              <Text style={styles.optionLabel}>Zoom In</Text>
              <Switch
                value={settings.zoomIn}
                onValueChange={() => settings.toggleSetting('zoomIn')}
                trackColor={{ false: '#e2e8f0', true: '#fca5a5' }}
                thumbColor={settings.zoomIn ? '#ee0509' : '#64748b'}
              />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.optionLabel}>Route Draw</Text>
              <Switch
                value={settings.routeDraw}
                onValueChange={() => settings.toggleSetting('routeDraw')}
                trackColor={{ false: '#e2e8f0', true: '#fca5a5' }}
                thumbColor={settings.routeDraw ? '#ee0509' : '#64748b'}
              />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.optionLabel}>Livemap animation</Text>
              <Switch
                value={settings.livemapAnimation}
                onValueChange={() => settings.toggleSetting('livemapAnimation')}
                trackColor={{ false: '#e2e8f0', true: '#fca5a5' }}
                thumbColor={settings.livemapAnimation ? '#ee0509' : '#64748b'}
              />
            </View>
          </View>
        </View>

        {/* Other Settings Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Other Settings</Text>
          <View style={styles.card}>
            <View style={styles.switchRow}>
              <Text style={styles.optionLabel}>Save filter state</Text>
              <Switch
                value={settings.saveFilterState}
                onValueChange={() => settings.toggleSetting('saveFilterState')}
                trackColor={{ false: '#e2e8f0', true: '#fca5a5' }}
                thumbColor={settings.saveFilterState ? '#ee0509' : '#64748b'}
              />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.optionLabel}>Enable 12 hours time format</Text>
              <Switch
                value={settings.enable12HoursTimeFormat}
                onValueChange={() => settings.toggleSetting('enable12HoursTimeFormat')}
                trackColor={{ false: '#e2e8f0', true: '#fca5a5' }}
                thumbColor={settings.enable12HoursTimeFormat ? '#ee0509' : '#64748b'}
              />
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    height: 52,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    padding: 4,
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#dc2626',
    marginBottom: 8,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 16,
    paddingVertical: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
  },
  languageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 14,
  },
  flagImage: {
    width: 38,
    height: 26,
    borderRadius: 4,
  },
  languageTextContainer: {
    flex: 1,
  },
  languageTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  languageSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#94a3b8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: '#ee0509',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ee0509',
  },
});
