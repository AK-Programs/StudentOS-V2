// Import Firebase scripts for background message handling
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

const firebaseConfig = {
  projectId: "gen-lang-client-0785563242",
  appId: "1:940502459076:web:843c78167b4b83a1c25f91",
  apiKey: "AIzaSyCtFjAhG_Y3G28t2iDV_0GzNvFRNUj9nFA",
  authDomain: "gen-lang-client-0785563242.firebaseapp.com",
  storageBucket: "gen-lang-client-0785563242.firebasestorage.app",
  messagingSenderId: "940502459076"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Background FCM Message received:', payload);
  const notificationTitle = payload.notification?.title || payload.data?.title || '📢 StudentOS Notification';
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || 'New announcement available in StudentOS.',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: payload.data?.tag || `studentos-notif-${Date.now()}`,
    data: {
      url: payload.data?.url || `/?tab=${encodeURIComponent(payload.data?.linkTab || 'notice_viewer')}`,
      linkTab: payload.data?.linkTab || 'notice_viewer'
    }
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
