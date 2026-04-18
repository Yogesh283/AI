package com.neo.assistant;

import android.content.Intent;
import android.os.Build;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "NeoNativeRouter")
public class NeoNativeRouterPlugin extends Plugin {

    @PluginMethod
    public void setWakeScreenOffListen(PluginCall call) {
        Boolean on = call.getBoolean("enabled", false);
        NeoPrefs.setWakeListenScreenOff(getContext(), Boolean.TRUE.equals(on));
        call.resolve();
    }

    @PluginMethod
    public void getWakeScreenOffListen(PluginCall call) {
        JSObject o = new JSObject();
        o.put("enabled", NeoPrefs.isWakeListenScreenOff(getContext()));
        call.resolve(o);
    }

    @PluginMethod
    public void startWakeListener(PluginCall call) {
        Boolean so = call.getBoolean("screenOffListen", false);
        NeoPrefs.setWakeListenScreenOff(getContext(), Boolean.TRUE.equals(so));
        Intent i = new Intent(getContext(), WakeWordForegroundService.class);
        i.setAction(WakeWordForegroundService.ACTION_START);
        i.putExtra(WakeWordForegroundService.EXTRA_SCREEN_OFF_LISTEN, Boolean.TRUE.equals(so));
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            ContextCompat.startForegroundService(getContext(), i);
        } else {
            getContext().startService(i);
        }
        call.resolve();
    }

    @PluginMethod
    public void stopWakeListener(PluginCall call) {
        Intent i = new Intent(getContext(), WakeWordForegroundService.class);
        i.setAction(WakeWordForegroundService.ACTION_STOP);
        getContext().startService(i);
        call.resolve();
    }

    @PluginMethod
    public void tryRouteCommand(PluginCall call) {
        String text = call.getString("text");
        if (text == null || text.trim().isEmpty()) {
            JSObject out = new JSObject();
            out.put("handled", false);
            call.resolve(out);
            return;
        }
        boolean handled = NeoCommandRouter.execute(getContext(), text);
        JSObject out = new JSObject();
        out.put("handled", handled);
        call.resolve(out);
    }
}
