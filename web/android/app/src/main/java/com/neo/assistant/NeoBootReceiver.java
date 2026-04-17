package com.neo.assistant;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import androidx.core.content.ContextCompat;

public class NeoBootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || intent.getAction() == null) return;
        String action = intent.getAction();
        if (Intent.ACTION_BOOT_COMPLETED.equals(action) || Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)) {
            Intent service = new Intent(context, WakeWordForegroundService.class);
            service.setAction(WakeWordForegroundService.ACTION_START);
            ContextCompat.startForegroundService(context, service);
        }
    }
}
