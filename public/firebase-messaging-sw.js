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
  const notificationTitle = payload.notification?.title || payload.data?.title || '📢 Veylentra Notification';
  const callId = payload.data?.callId || '';
  const notifType = payload.data?.type || (callId ? 'call' : 'announcement');
  const linkTab = payload.data?.linkTab || payload.data?.tab || payload.data?.route || (callId ? 'peer_chat' : 'notice_viewer');
  const notifId = payload.data?.notificationId || payload.data?.notifId || payload.data?.id || '';

  let targetUrl = `/?tab=${encodeURIComponent(linkTab)}${notifId ? `&notifId=${encodeURIComponent(notifId)}` : ''}${callId ? `&callId=${encodeURIComponent(callId)}` : ''}`;
  if (payload.data?.url) {
    try {
      const u = new URL(payload.data.url, self.location.origin);
      if (!u.searchParams.has('tab') && linkTab) u.searchParams.set('tab', linkTab);
      if (!u.searchParams.has('notifId') && notifId) u.searchParams.set('notifId', notifId);
      if (!u.searchParams.has('callId') && callId) u.searchParams.set('callId', callId);
      targetUrl = u.pathname + u.search + u.hash;
    } catch (_) {}
  }

  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || 'New announcement available in Veylentra.',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: payload.data?.tag || (notifId ? `studentos-notif-${notifId}` : `studentos-notif-${Date.now()}`),
    data: {
      url: targetUrl,
      linkTab: linkTab,
      notifId: notifId,
      type: notifType,
      callId: callId
    }
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  const data = event.notification.data || {};
  const callId = data.callId || '';
  const notifType = data.type || (callId ? 'call' : 'announcement');
  const targetTab = data.linkTab || data.tab || data.route || (callId ? 'peer_chat' : 'notice_viewer');
  const notifId = data.notifId || data.notificationId || '';
  const targetUrl =
    data.url ||
    `/?tab=${encodeURIComponent(targetTab)}${notifId ? `&notifId=${encodeURIComponent(notifId)}` : ''}${callId ? `&callId=${encodeURIComponent(callId)}` : ''}`;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clientList) => {
      const sameOrigin = clientList.filter((c) => {
        try {
          return new URL(c.url).origin === self.location.origin;
        } catch (_) {
          return false;
        }
      });
      const target = sameOrigin.find((c) => c.focused) || sameOrigin.find((c) => c.visibilityState === 'visible') || sameOrigin[0];
      if (target) {
        try {
          const focused = 'focus' in target ? await target.focus() : target;
          (focused || target).postMessage({
            type: 'STUDENTOS_NAVIGATE_TAB',
            tab: targetTab,
            linkTab: targetTab,
            notifId: notifId,
            callId: callId,
            notifType: notifType,
            url: targetUrl,
            ts: Date.now()
          });
          return focused || target;
        } catch (_) {
          // Fallback to openWindow if focusing failed
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
