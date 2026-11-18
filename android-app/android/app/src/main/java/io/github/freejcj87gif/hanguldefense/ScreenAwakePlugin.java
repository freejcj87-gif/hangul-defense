package io.github.freejcj87gif.hanguldefense;

import android.app.Activity;
import android.view.WindowManager;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * 화면 켜두기(앱 안 전용 플러그인). app-shell.js가 늑대 세계가 흐르는 동안만 on, 그 밖에는 off로 부른다.
 * 긴 지문을 읽는 동안 화면이 꺼지지 않게 하려는 것이며, 권한이 필요 없다(FLAG_KEEP_SCREEN_ON).
 */
@CapacitorPlugin(name = "ScreenAwake")
public class ScreenAwakePlugin extends Plugin {

    @PluginMethod
    public void set(PluginCall call) {
        final boolean on = Boolean.TRUE.equals(call.getBoolean("on", false));
        final Activity activity = getActivity();
        if (activity == null) {
            call.resolve();
            return;
        }
        activity.runOnUiThread(() -> {
            if (on) {
                activity.getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            } else {
                activity.getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            }
            call.resolve();
        });
    }
}
