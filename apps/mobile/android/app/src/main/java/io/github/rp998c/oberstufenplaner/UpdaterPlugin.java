package io.github.rp998c.oberstufenplaner;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/**
 * Updates from the GitHub release "android-latest": compares version.json with the installed
 * version, downloads the APK and hands it to the Android installer. Android only installs an
 * update signed with the same key, and always asks the user to confirm.
 */
@CapacitorPlugin(name = "Updater")
public class UpdaterPlugin extends Plugin {

    private static final String BASE =
        "https://github.com/rp998c/oberstufen-planer/releases/download/android-latest/";

    private static long versionCode(PackageInfo pi) {
        return Build.VERSION.SDK_INT >= 28 ? pi.getLongVersionCode() : pi.versionCode;
    }

    private PackageInfo installed() throws PackageManager.NameNotFoundException {
        Context ctx = getContext();
        return ctx.getPackageManager().getPackageInfo(ctx.getPackageName(), 0);
    }

    private static HttpURLConnection open(String url) throws IOException {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setInstanceFollowRedirects(true);
        c.setUseCaches(false);
        c.setConnectTimeout(15000);
        c.setReadTimeout(30000);
        c.setRequestProperty("User-Agent", "oberstufen-planer-app");
        c.setRequestProperty("Cache-Control", "no-cache");
        int status = c.getResponseCode();
        if (status != 200) throw new IOException("HTTP " + status);
        return c;
    }

    @PluginMethod
    public void current(PluginCall call) {
        try {
            PackageInfo pi = installed();
            JSObject r = new JSObject();
            r.put("code", versionCode(pi));
            r.put("name", pi.versionName);
            call.resolve(r);
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    @PluginMethod
    public void latest(PluginCall call) {
        getBridge().execute(() -> {
            try {
                HttpURLConnection c = open(BASE + "version.json?t=" + System.currentTimeMillis());
                ByteArrayOutputStream out = new ByteArrayOutputStream();
                try (InputStream in = c.getInputStream()) {
                    byte[] buf = new byte[4096];
                    int n;
                    while ((n = in.read(buf)) > 0 && out.size() < 65536) out.write(buf, 0, n);
                }
                call.resolve(new JSObject(out.toString(StandardCharsets.UTF_8.name())));
            } catch (Exception e) {
                call.reject("Keine Verbindung zu GitHub: " + e.getMessage(), "offline");
            }
        });
    }

    @PluginMethod
    public void install(PluginCall call) {
        Context ctx = getContext();
        PackageManager pm = ctx.getPackageManager();
        if (Build.VERSION.SDK_INT >= 26 && !pm.canRequestPackageInstalls()) {
            Intent i = new Intent(
                Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:" + ctx.getPackageName())
            );
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(i);
            call.reject(
                "Bitte erlaube der App, Updates zu installieren, und tippe dann noch einmal auf Installieren.",
                "permission"
            );
            return;
        }
        getBridge().execute(() -> {
            try {
                File dir = new File(ctx.getCacheDir(), "updates");
                if (!dir.isDirectory() && !dir.mkdirs()) throw new IOException("Kein Speicherplatz");
                File apk = new File(dir, "oberstufen-planer.apk");
                HttpURLConnection c = open(BASE + "oberstufen-planer.apk");
                long total = c.getContentLength();
                long done = 0;
                int lastPercent = -1;
                try (InputStream in = c.getInputStream(); OutputStream out = new FileOutputStream(apk)) {
                    byte[] buf = new byte[65536];
                    int n;
                    while ((n = in.read(buf)) > 0) {
                        out.write(buf, 0, n);
                        done += n;
                        int percent = total > 0 ? (int) (done * 100 / total) : -1;
                        if (percent != lastPercent) {
                            lastPercent = percent;
                            JSObject p = new JSObject();
                            p.put("percent", percent);
                            notifyListeners("progress", p);
                        }
                    }
                }
                // only hand over an APK of this app that is really newer
                PackageInfo archive = pm.getPackageArchiveInfo(apk.getPath(), 0);
                if (archive == null || !ctx.getPackageName().equals(archive.packageName)) {
                    throw new IOException("Die heruntergeladene Datei ist keine gültige App.");
                }
                if (versionCode(archive) <= versionCode(installed())) {
                    throw new IOException("Die App ist schon aktuell.");
                }
                Uri uri = FileProvider.getUriForFile(ctx, ctx.getPackageName() + ".fileprovider", apk);
                Intent i = new Intent(Intent.ACTION_VIEW);
                i.setDataAndType(uri, "application/vnd.android.package-archive");
                i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                ctx.startActivity(i);
                call.resolve();
            } catch (Exception e) {
                call.reject(e.getMessage() == null ? "Update fehlgeschlagen." : e.getMessage());
            }
        });
    }
}
