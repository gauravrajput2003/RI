import { useRef, useState } from 'react';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { Image, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { login } from '../../services/api/auth';
import { apiError } from '../../services/api/client';
import { config } from '../../constants/config';
import { languages, translations, support, type Language } from '../../features/auth/login-copy';

import logo from '../../assets/loginlogo.png';
import flag from '../../assets/indianflag.png';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [language, setLanguage] = useState<Language>('en');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const passwordInput = useRef<TextInput>(null);
  const insets = useSafeAreaInsets();
  const copy = translations[language];
  const submit = async () => {
    if (submitting.current || !email.trim() || !password) return;
    submitting.current = true;
    setError(undefined);
    setBusy(true);
    try {
      await login(email.trim(), password);
      router.replace('/(app)');
    } catch (cause) { setError(apiError(cause)); }
    finally { submitting.current = false; setBusy(false); }
  };
  return <SafeAreaView style={styles.page}>
    <StatusBar style="dark" />
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
      <Image source={logo} resizeMode="contain" style={[styles.watermark, styles.watermarkTop]} />
      <Image source={logo} resizeMode="contain" style={[styles.watermark, styles.watermarkMiddle]} />
      <Image source={logo} resizeMode="contain" style={[styles.watermark, styles.watermarkBottom]} />
    </View>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <View style={styles.topBar}>
          <Pressable accessibilityRole="button" accessibilityLabel={copy.chooseLanguage} onPress={() => { Keyboard.dismiss(); setSheetOpen(true); }} style={styles.languageButton}>
            <Image source={flag} resizeMode="contain" style={styles.smallFlag} />
            <Text style={styles.languageButtonText}>{languages.find(item => item.id === language)?.native}</Text>
          </Pressable>
        </View>
        <View style={styles.content}>
          <Image source={logo} resizeMode="contain" accessibilityLabel="RI" style={styles.logo} />
          <Text style={styles.label}>{copy.username}</Text>
          <TextInput accessibilityLabel={copy.username} autoCapitalize="none" autoCorrect={false} autoComplete="email" keyboardType="email-address" placeholder={copy.usernamePlaceholder} placeholderTextColor="#929292" value={email} onChangeText={setEmail} style={styles.input} returnKeyType="next" onSubmitEditing={() => passwordInput.current?.focus()} submitBehavior="submit" />
          <Text style={[styles.label, styles.passwordLabel]}>{copy.password}</Text>
          <View style={styles.passwordRow}>
            <TextInput ref={passwordInput} accessibilityLabel={copy.password} autoCapitalize="none" autoCorrect={false} autoComplete="password" placeholder={copy.passwordPlaceholder} placeholderTextColor="#929292" secureTextEntry={!visible} value={password} onChangeText={setPassword} style={[styles.input, styles.passwordInput]} returnKeyType="go" onSubmitEditing={() => void submit()} />
            <Pressable accessibilityRole="button" accessibilityLabel={visible ? 'Hide password' : 'Show password'} onPress={() => { setVisible(current => !current); passwordInput.current?.focus(); }} style={styles.eye}>
              <Ionicons name={visible ? 'eye-outline' : 'eye-off-outline'} size={23} color="#151515" />
            </Pressable>
          </View>
          {error ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
          <Pressable accessibilityRole="button" accessibilityLabel={copy.login} accessibilityState={{ disabled: busy || !email.trim() || !password, busy }} disabled={busy || !email.trim() || !password} onPress={() => void submit()} android_ripple={{ color: '#c90606' }} style={[styles.loginButton, busy && styles.pressed]}>
            <Text style={styles.loginText}>{busy ? copy.signingIn : copy.login}</Text>
          </Pressable>
          <View style={styles.support}>
            <Text style={styles.supportHeading}>{copy.help}</Text>
            <View style={styles.divider} />
            <View style={styles.supportRow}><Ionicons name="call" size={16} color="#626273" /><Text selectable style={styles.supportText}>{support.phone}</Text></View>
            <View style={styles.supportRow}><Ionicons name="mail" size={16} color="#626273" /><Text selectable style={styles.supportText}>{support.email}</Text></View>
          </View>
          {config.demoMode ? <Text style={styles.demo}>Demo mode</Text> : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
    <Modal visible={sheetOpen} transparent animationType="slide" statusBarTranslucent navigationBarTranslucent onRequestClose={() => setSheetOpen(false)}>
      <View style={styles.modal}>
        <Pressable accessibilityRole="button" accessibilityLabel={copy.cancel} onPress={() => setSheetOpen(false)} style={[StyleSheet.absoluteFill, styles.backdrop]} />
        <View accessibilityViewIsModal style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 18), maxHeight: '90%' }]}>
          <View style={styles.handle} />
          <ScrollView bounces={false} contentContainerStyle={styles.sheetContent}>
            <Text accessibilityRole="header" style={styles.sheetTitle}>{copy.selectLanguage}</Text>
            <Text style={styles.sheetSubtitle}>{copy.chooseLanguage}</Text>
            <View accessibilityRole="radiogroup">
              {languages.map(item => {
                const selected = item.id === language;
                return <Pressable key={item.id} accessibilityRole="radio" accessibilityLabel={`${item.native}, ${item.english}`} accessibilityState={{ checked: selected }} onPress={() => { setLanguage(item.id); setSheetOpen(false); }} style={[styles.languageRow, selected && styles.selectedRow]}>
                  <Image source={flag} resizeMode="contain" style={styles.rowFlag} />
                  <View style={styles.languageNames}><Text style={[styles.nativeName, selected && styles.selectedText]}>{item.native}</Text><Text style={styles.englishName}>{item.english}</Text></View>
                  {selected ? <Ionicons name="checkmark" size={25} color="#3f60dc" /> : null}
                </Pressable>;
              })}
            </View>
            <Pressable accessibilityRole="button" onPress={() => setSheetOpen(false)} style={styles.cancel}><Text style={styles.cancelText}>{copy.cancel}</Text></Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#fff' }, flex: { flex: 1 },
  watermark: { position: 'absolute', width: 560, height: 430, opacity: 0.035, transform: [{ rotate: '25deg' }] },
  watermarkTop: { top: -260, left: -100 }, watermarkMiddle: { top: 130, right: -160 }, watermarkBottom: { bottom: -200, left: -120 },
  scroll: { flexGrow: 1, paddingBottom: 10 }, topBar: { alignItems: 'flex-end', paddingTop: 38, paddingRight: 6 },
  languageButton: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#ddd', borderRadius: 4, paddingHorizontal: 12, minHeight: 38 },
  smallFlag: { width: 22, height: 16 }, languageButtonText: { fontSize: 14, fontWeight: '700', color: '#111' },
  content: { width: '100%', maxWidth: 440, alignSelf: 'center', paddingHorizontal: 26 },
  logo: { width: 132, height: 110, alignSelf: 'center', marginTop: 32, marginBottom: 40 },
  label: { fontSize: 20, fontWeight: '700', color: '#555' },
  input: { minHeight: 48, borderBottomWidth: 1, borderBottomColor: '#262626', paddingHorizontal: 4, paddingVertical: 10, fontSize: 20, color: '#292929' },
  passwordLabel: { marginTop: 28 }, passwordRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#262626' },
  passwordInput: { flex: 1, minWidth: 0, borderBottomWidth: 0 }, eye: { width: 44, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  loginButton: { backgroundColor: '#f00808', width: '100%', minHeight: 46, flexShrink: 0, borderRadius: 9, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', marginTop: 44, padding: 10 },
  loginText: { color: '#fff', fontSize: 16, fontWeight: '800' }, pressed: { opacity: 0.7 }, error: { color: '#b91c1c', marginTop: 12, fontSize: 14 },
  support: { backgroundColor: 'rgba(237,237,237,0.78)', borderRadius: 10, paddingHorizontal: 26, paddingTop: 12, paddingBottom: 12, marginTop: 10 },
  supportHeading: { color: '#0b3051', textAlign: 'center', fontSize: 20, fontWeight: '700' }, divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#bbc2c9', marginTop: 5, marginBottom: 8 },
  supportRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 6 }, supportText: { flex: 1, color: '#424255', fontSize: 15, fontWeight: '700' },
  demo: { textAlign: 'center', color: '#777', fontSize: 11, marginTop: 8 },
  modal: { flex: 1, justifyContent: 'flex-end' }, backdrop: { backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 10 },
  handle: { width: 36, height: 3, borderRadius: 2, backgroundColor: '#dedede', alignSelf: 'center', marginBottom: 16 }, sheetContent: { paddingHorizontal: 18 },
  sheetTitle: { color: '#202020', textAlign: 'center', fontSize: 20, fontWeight: '700' }, sheetSubtitle: { color: '#888', textAlign: 'center', fontSize: 14, marginTop: 5, marginBottom: 16 },
  languageRow: { flexDirection: 'row', alignItems: 'center', minHeight: 70, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#f2f2f2', gap: 14 },
  selectedRow: { backgroundColor: '#f0f4ff', borderRadius: 9, borderBottomColor: 'transparent' }, rowFlag: { width: 33, height: 24 }, languageNames: { flex: 1 },
  nativeName: { color: '#202020', fontSize: 19 }, selectedText: { color: '#3f60dc', fontWeight: '500' }, englishName: { color: '#888', fontSize: 14, marginTop: 2 },
  cancel: { backgroundColor: '#f5f5f5', minHeight: 48, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginTop: 17, marginBottom: 8, padding: 10 }, cancelText: { color: '#555', fontSize: 16, fontWeight: '500' },
});
