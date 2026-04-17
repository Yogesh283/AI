package com.neo.assistant;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Bundle;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final int REQ_MIC = 2101;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        ensureMicPermission();
        maybeStopWakeService();
    }

    @Override
    public void onResume() {
        super.onResume();
        ensureMicPermission();
        // App foreground (especially Voice page): disable always-on wake listener to avoid interference.
        maybeStopWakeService();
    }

    @Override
    public void onPause() {
        super.onPause();
        // App goes background/lock-screen: re-enable wake listener.
        maybeStartWakeService();
    }

    private void ensureMicPermission() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
            != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(
                this,
                new String[] { Manifest.permission.RECORD_AUDIO },
                REQ_MIC
            );
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != REQ_MIC) return;
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
            == PackageManager.PERMISSION_GRANTED) {
            maybeStartWakeService();
        }
    }

    private void maybeStartWakeService() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
            != PackageManager.PERMISSION_GRANTED) {
            return;
        }
        Intent service = new Intent(this, WakeWordForegroundService.class);
        service.setAction(WakeWordForegroundService.ACTION_START);
        ContextCompat.startForegroundService(this, service);
    }

    private void maybeStopWakeService() {
        Intent service = new Intent(this, WakeWordForegroundService.class);
        service.setAction(WakeWordForegroundService.ACTION_STOP);
        startService(service);
    }
}
