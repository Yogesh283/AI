package com.neo.assistant;

import android.app.Notification;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

/**
 * Captures WhatsApp notification previews (title + text) so voice can read aloud what appeared in the shade.
 * User must enable <i>Notification access</i> for Neo in system settings.
 */
public class NeoNotificationListenerService extends NotificationListenerService {

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        if (sbn == null) return;
        String pkg = sbn.getPackageName();
        if (!"com.whatsapp".equals(pkg) && !"com.whatsapp.w4b".equals(pkg)) {
            return;
        }
        Notification n = sbn.getNotification();
        if (n == null) return;
        CharSequence title = n.extras.getCharSequence(Notification.EXTRA_TITLE);
        CharSequence text = n.extras.getCharSequence(Notification.EXTRA_TEXT);
        StringBuilder sb = new StringBuilder();
        if (title != null && title.length() > 0) {
            sb.append(title);
        }
        if (text != null && text.length() > 0) {
            if (sb.length() > 0) sb.append(" — ");
            sb.append(text);
        }
        String line = sb.toString().trim();
        if (line.length() > 400) {
            line = line.substring(0, 397) + "...";
        }
        if (!line.isEmpty()) {
            NeoPrefs.setLastWhatsAppNotification(getApplicationContext(), line);
        }
    }
}
