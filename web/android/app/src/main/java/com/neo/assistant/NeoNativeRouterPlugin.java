package com.neo.assistant;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "NeoNativeRouter")
public class NeoNativeRouterPlugin extends Plugin {

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
