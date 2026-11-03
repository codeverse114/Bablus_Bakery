/**
 * BACKREY BASES - ANDROID APP SHELL CONTROLLER
 * Bridge for Capacitor / WebView Native Wrapper (Blueprint Section 6 & Tests P1-P4).
 */

class AndroidAppBridge {
  constructor() {
    this.isNative = typeof window !== 'undefined' && Boolean(window.Capacitor);
    this.fcmToken = null;
    this.init();
  }

  init() {
    console.log('[Android App] Initializing Backrey Bases Operations Mobile Shell...');
    this.setupPushNotifications();
    this.setupNetworkWatchdog();
  }

  // Push Notifications (Tests P4, O3, O5)
  setupPushNotifications() {
    if (this.isNative && window.Capacitor?.Plugins?.PushNotifications) {
      const { PushNotifications } = window.Capacitor.Plugins;

      PushNotifications.requestPermissions().then(result => {
        if (result.receive === 'granted') {
          PushNotifications.register();
        }
      });

      PushNotifications.addListener('registration', token => {
        this.fcmToken = token.value;
        console.log('[Android App] Push Token Registered:', token.value);
      });

      PushNotifications.addListener('pushNotificationReceived', notification => {
        console.log('[Android App] Push Received Foreground:', notification);
        if (window.loadDashboard) window.loadDashboard();
        if (window.loadOrders) window.loadOrders();
      });

      PushNotifications.addListener('pushNotificationActionPerformed', action => {
        console.log('[Android App] Push Action Performed:', action);
        if (window.switchTab) window.switchTab('orders');
      });
    }
  }

  // Camera capture trigger for product photography (Blueprint Section 3.4 & 6)
  async captureProductPhoto() {
    if (this.isNative && window.Capacitor?.Plugins?.Camera) {
      const { Camera, CameraResultType } = window.Capacitor.Plugins;
      try {
        const image = await Camera.getPhoto({
          quality: 85,
          allowEditing: true,
          resultType: CameraResultType.Uri
        });
        return image.webPath;
      } catch (e) {
        console.warn('[Android App] Camera cancelled or unavailable:', e);
        return null;
      }
    }
    return null;
  }

  setupNetworkWatchdog() {
    window.addEventListener('online', () => {
      console.log('[Android App] Back online, syncing orders...');
      if (window.loadDashboard) window.loadDashboard();
    });
  }
}

// Global initialization
if (typeof window !== 'undefined') {
  window.androidApp = new AndroidAppBridge();
}

module.exports = AndroidAppBridge;
