package com.neo.assistant;

import android.app.Notification;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

/**
 * Captures WhatsApp + Telegram notification previews (title + text) so voice can read aloud what appeared in the shade.
 * User must enable <i>Notification access</i> for Neo in system settings.
 */
public class NeoNotificationListenerService extends NotificationListenerService {

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        if (sbn == null) return;
        String pkg = sbn.getPackageName();
        String appKey;
        if ("com.whatsapp".equals(pkg) || "com.whatsapp.w4b".equals(pkg)) {
            appKey = "wa";
        } else if ("org.telegram.messenger".equals(pkg) || "org.thunderdog.challegram".equals(pkg)) {
            appKey = "tg";
        } else {
            return;
        }
        Notification n = sbn.getNotification();
        if (n == null) return;
        CharSequence title = n.extras.getCharSequence(Notification.EXTRA_TITLE);
        CharSequence text = n.extras.getCharSequence(Notification.EXTRA_TEXT);
        NeoPrefs.appendMessengerNotif(getApplicationContext(), appKey, title, text);
    }
}
