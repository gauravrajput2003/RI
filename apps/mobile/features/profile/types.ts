export interface UserProfile {
  name: string;
  email: string;
  phone: string;
  avatarLetter: string;
}

export interface VehicleCardDetail {
  id: string;
  vehicle_number: string;
  timestamp: string;
  speed: number | null;
  overspeed: number | null;
  mileage: number | null;
  odometer: number | null;
  alias: string;
  remark: string;
  subscriptionStart: string;
  subscriptionDue: string;
  visual: 'scooter' | 'car' | 'bike';
}

export interface SubscriptionRecord {
  id: string;
  badgeIndex: number;
  vehicle_number: string;
  subscriptionStart: string;
  subscriptionDue: string;
}

export interface AppSettings {
  language: string;
  alertNotification: boolean;
  sound: boolean;
  vibration: boolean;
  voiceAssistance: boolean;
  landingPage: 'Menu' | 'Report' | 'Dashboard';
  zoomIn: boolean;
  routeDraw: boolean;
  livemapAnimation: boolean;
  saveFilterState: boolean;
  enable12HoursTimeFormat: boolean;
}
