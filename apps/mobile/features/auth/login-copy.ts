export type Language = 'en' | 'hi' | 'ta';
export const languages: { id: Language; native: string; english: string }[] = [
  { id: 'en', native: 'English', english: 'English' },
  { id: 'hi', native: 'हिंदी', english: 'Hindi' },
  { id: 'ta', native: 'தமிழ்', english: 'Tamil' },
];
// Screenshot placeholders only, not verified RI support contacts. Edit before release.
export const support = { phone: '9813010101', email: 'JASBIR10101@GMAIL.COM' };
export const translations = {
  en: { username: 'Username', usernamePlaceholder: 'Enter Username', password: 'Password', passwordPlaceholder: 'Enter Password', login: 'LOGIN', signingIn: 'Signing in…', help: 'May I help you', selectLanguage: 'Select Language', chooseLanguage: 'Choose your preferred language', cancel: 'Cancel' },
  hi: { username: 'उपयोगकर्ता नाम', usernamePlaceholder: 'उपयोगकर्ता नाम दर्ज करें', password: 'पासवर्ड', passwordPlaceholder: 'पासवर्ड दर्ज करें', login: 'लॉगिन', signingIn: 'लॉगिन हो रहा है…', help: 'क्या मैं आपकी मदद करूँ', selectLanguage: 'भाषा चुनें', chooseLanguage: 'अपनी पसंदीदा भाषा चुनें', cancel: 'रद्द करें' },
  ta: { username: 'பயனர்பெயர்', usernamePlaceholder: 'பயனர்பெயரை உள்ளிடவும்', password: 'கடவுச்சொல்', passwordPlaceholder: 'கடவுச்சொல்லை உள்ளிடவும்', login: 'உள்நுழைக', signingIn: 'உள்நுழைகிறது…', help: 'நான் உதவலாமா', selectLanguage: 'மொழியைத் தேர்ந்தெடுக்கவும்', chooseLanguage: 'உங்கள் விருப்ப மொழியைத் தேர்ந்தெடுக்கவும்', cancel: 'ரத்து செய்' },
};
