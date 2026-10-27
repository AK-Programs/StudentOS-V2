const functions = require("firebase-functions");
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * Cloud Function: sendPush
 * Dispatches FCM push notifications to all tokens stored in Firestore collection 'fcmTokens'.
 * Supports HTTP triggers (POST) and callable requests.
 */
exports.sendPush = functions.https.onRequest(async (req, res) => {
  // CORS setup
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(204).send("");
  }

  try {
    const payload = req.body || {};
    const title = payload.title || "📢 StudentOS Notification";
    const body = payload.body || payload.message || "New announcement posted in StudentOS.";
    const linkTab = payload.linkTab || payload.route || "notice_viewer";
    const notifId = payload.notificationId || payload.notifId || `notif_${Date.now()}`;
    const targetUserId = payload.targetUserId || "all";

    // 1. Fetch tokens from Firestore collection 'fcmTokens'
    const db = admin.firestore();
    let query = db.collection("fcmTokens");

    if (targetUserId && targetUserId !== "all") {
      query = query.where("userId", "==", targetUserId);
    }

    const snapshot = await query.get();

    if (snapshot.empty) {
      console.log("[sendPush] No FCM tokens found in fcmTokens collection.");
      return res.status(200).json({
        success: true,
        sentCount: 0,
        message: "No FCM tokens registered in fcmTokens collection."
      });
    }

    const tokensList = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      if (data && data.token) {
        tokensList.push(data.token);
      }
    });

    if (tokensList.length === 0) {
      return res.status(200).json({
        success: true,
        sentCount: 0,
        message: "No valid token strings found in fcmTokens documents."
      });
    }

    // 2. Build FCM multicast message payload
    const messagePayload = {
      notification: {
        title,
        body,
      },
      data: {
        title,
        body,
        linkTab,
        notificationId: notifId,
        url: `/?tab=${encodeURIComponent(linkTab)}`
      },
      tokens: tokensList,
      android: {
        priority: "high",
        notification: {
          sound: "default",
          channelId: "studentos_notifications",
          priority: "high",
          visibility: "public"
        }
      }
    };

    // 3. Dispatch multicast push
    const response = await admin.messaging().sendEachForMulticast(messagePayload);

    console.log(`[sendPush Cloud Function] Dispatched to ${tokensList.length} devices: ${response.successCount} succeeded, ${response.failureCount} failed.`);

    // 4. Clean up invalid/unregistered tokens
    if (response.failureCount > 0) {
      const failedTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const errCode = resp.error?.code;
          if (
            errCode === "messaging/invalid-registration-token" ||
            errCode === "messaging/registration-token-not-registered"
          ) {
            failedTokens.push(tokensList[idx]);
          }
        }
      });

      if (failedTokens.length > 0) {
        const batch = db.batch();
        snapshot.forEach((doc) => {
          if (failedTokens.includes(doc.data()?.token)) {
            batch.delete(doc.ref);
          }
        });
        await batch.commit();
        console.log(`[sendPush Cloud Function] Cleaned up ${failedTokens.length} expired FCM tokens from Firestore.`);
      }
    }

    return res.status(200).json({
      success: true,
      sentCount: response.successCount,
      failureCount: response.failureCount,
      totalTokens: tokensList.length,
      message: `Successfully delivered push to ${response.successCount} device(s)!`
    });
  } catch (error) {
    console.error("[sendPush Cloud Function Error]:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to dispatch FCM push notifications."
    });
  }
});
