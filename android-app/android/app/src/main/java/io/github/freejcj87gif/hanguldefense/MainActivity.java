package io.github.freejcj87gif.hanguldefense;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // 앱 안 플러그인은 super.onCreate 전에 등록한다(Capacitor 문서의 사용자 플러그인 방식).
        registerPlugin(ScreenAwakePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
