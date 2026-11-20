package io.github.freejcj87gif.hanguldefense;

import android.content.pm.ActivityInfo;
import android.content.res.Configuration;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    /**
     * 폰(가장 짧은 변이 600dp 미만)은 세로로만 쓴다. 근거(launch\android\04 문서): 폰을 가로로 들면 내용 높이가 약 300~340dp라
     * 지문·보기·장면이 한 화면에 들지 않고, 게임의 폰 화면 규칙(폭 760px 이하)은 세로를 기준으로 만들어졌다.
     * 태블릿·접은 폰을 편 화면·크롬북(600dp 이상)과 화면 나누기는 고정하지 않는다(Android 16은 큰 화면에서 방향 고정을 어차피 무시하고,
     * Play 큰 화면 품질 기준도 고정하지 말라고 한다). 사용자가 자동 회전을 켜 두면 거꾸로 세로도 된다(USER_PORTRAIT).
     * 폰 가로를 지원하기로 하면 PHONE_PORTRAIT를 false로 바꾸면 된다.
     */
    private static final boolean PHONE_PORTRAIT = true;
    private static final int PHONE_MAX_SMALLEST_WIDTH_DP = 600;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // 앱 안 플러그인은 super.onCreate 전에 등록한다(Capacitor 문서의 사용자 플러그인 방식).
        registerPlugin(ScreenAwakePlugin.class);
        // 진행 파일 옮기기(보호자 화면): 저장·보내기·불러오기. 권한 없음(ProgressFilePlugin 설명)
        registerPlugin(ProgressFilePlugin.class);
        // 보호자 문턱의 기기 화면 잠금 확인. 권한 없음(DeviceGatePlugin 설명)
        registerPlugin(DeviceGatePlugin.class);
        super.onCreate(savedInstanceState);
        applyOrientationPolicy(getResources().getConfiguration());
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        // 접는 폰을 접거나 펴면 가장 짧은 변이 바뀐다(매니페스트 configChanges에 smallestScreenSize가 있어 액티비티는 다시 만들지 않는다)
        applyOrientationPolicy(newConfig);
    }

    /** 화면 나누기에 들어가거나 나올 때. 최소 SDK 24라 API 24부터 있는 한 인자 형태를 쓴다(두 인자 형태는 API 26). */
    @Override
    @SuppressWarnings("deprecation")
    public void onMultiWindowModeChanged(boolean isInMultiWindowMode) {
        super.onMultiWindowModeChanged(isInMultiWindowMode);
        applyOrientationPolicy(getResources().getConfiguration());
    }

    private void applyOrientationPolicy(Configuration config) {
        int sw = config.smallestScreenWidthDp;
        boolean phone = PHONE_PORTRAIT &&
            sw != Configuration.SMALLEST_SCREEN_WIDTH_DP_UNDEFINED &&
            sw < PHONE_MAX_SMALLEST_WIDTH_DP &&
            !isInMultiWindowMode();
        int want = phone ? ActivityInfo.SCREEN_ORIENTATION_USER_PORTRAIT : ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED;
        if (getRequestedOrientation() != want) {
            setRequestedOrientation(want);
        }
    }
}
