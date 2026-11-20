package io.github.freejcj87gif.hanguldefense;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // 앱 안 플러그인은 super.onCreate 전에 등록한다(Capacitor 문서의 사용자 플러그인 방식).
        registerPlugin(ScreenAwakePlugin.class);
        // 진행 파일 옮기기(보호자 화면): 저장·보내기·불러오기. 권한 없음(ProgressFilePlugin 설명)
        registerPlugin(ProgressFilePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
