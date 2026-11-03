package io.github.rp998c.oberstufenplaner;

import android.content.ComponentName;
import android.content.pm.PackageManager;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Switches the launcher icon by enabling one activity alias and disabling the other. */
@CapacitorPlugin(name = "AppIcon")
public class AppIconPlugin extends Plugin {

    @PluginMethod
    public void setIcon(PluginCall call) {
        String name = call.getString("name", "A");
        if (!"A".equals(name) && !"C".equals(name)) {
            call.reject("Unknown icon");
            return;
        }
        PackageManager pm = getContext().getPackageManager();
        String pkg = getContext().getPackageName();
        for (String icon : new String[] { "A", "C" }) {
            int state = icon.equals(name)
                ? PackageManager.COMPONENT_ENABLED_STATE_ENABLED
                : PackageManager.COMPONENT_ENABLED_STATE_DISABLED;
            pm.setComponentEnabledSetting(
                new ComponentName(pkg, pkg + ".Icon" + icon),
                state,
                PackageManager.DONT_KILL_APP
            );
        }
        call.resolve();
    }
}
