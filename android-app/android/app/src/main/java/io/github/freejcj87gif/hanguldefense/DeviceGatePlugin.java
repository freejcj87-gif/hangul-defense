package io.github.freejcj87gif.hanguldefense;

import android.app.Activity;
import android.app.KeyguardManager;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * 보호자 문턱을 기기 화면 잠금으로 확인한다(앱 안 전용 플러그인, 프로듀서 결정 2026-11-20).
 * 잠금을 쓰지 않는 기기는 "none"을 돌려주고, 게임이 웹 어른 문제(글로 적힌 수)로 넘어간다.
 *
 * 권한·의존성이 하나도 늘지 않는 길을 골랐다: KeyguardManager.createConfirmDeviceCredentialIntent(API 21).
 * 시스템이 PIN·패턴·비밀번호(등록돼 있으면 생체 인식도) 확인 화면을 띄우고 결과만 돌려준다. API 29부터 '사용 중단' 표시가 붙었지만
 * 지금 SDK(36)에도 있고, 대안인 BiometricPrompt는 USE_BIOMETRIC 권한이 필요하다(androidx.biometric은 USE_BIOMETRIC·USE_FINGERPRINT를
 * 매니페스트에 직접 넣는다). 앱은 비밀번호·지문을 보지도 저장하지도 않는다.
 *
 * confirm({reason?}) → {result: "ok" | "cancel" | "none", why?: "no-lock" | "no-screen"}
 *   ok: 잠금을 풀었다. cancel: 취소했거나 풀지 못했다. none: 화면 잠금이 없거나 확인 화면을 열 수 없다.
 * status() → {secure: boolean} 화면 잠금(PIN·패턴·비밀번호)이 설정돼 있는지(isDeviceSecure, API 23).
 */
@CapacitorPlugin(name = "DeviceGate")
public class DeviceGatePlugin extends Plugin {

    private static final int REASON_MAX = 80;

    @PluginMethod
    public void status(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("secure", secure());
        call.resolve(ret);
    }

    @PluginMethod
    @SuppressWarnings("deprecation")
    public void confirm(PluginCall call) {
        final Activity activity = getActivity();
        final KeyguardManager keyguard = keyguard();
        if (activity == null || keyguard == null || !secure()) {
            answer(call, "none", "no-lock");
            return;
        }
        String reason = call.getString("reason");
        if (reason == null || reason.trim().isEmpty()) {
            reason = activity.getString(R.string.device_gate_description);
        } else {
            reason = reason.trim();
            if (reason.length() > REASON_MAX) {
                reason = reason.substring(0, REASON_MAX);
            }
        }
        Intent intent = keyguard.createConfirmDeviceCredentialIntent(activity.getString(R.string.device_gate_title), reason);
        if (intent == null) {
            // 문서: 비밀번호가 필요 없으면(잠금 없음) null
            answer(call, "none", "no-lock");
            return;
        }
        try {
            startActivityForResult(call, intent, "confirmResult");
        } catch (ActivityNotFoundException e) {
            getBridge().releaseCall(call);
            answer(call, "none", "no-screen");
        }
    }

    @ActivityCallback
    private void confirmResult(PluginCall call, ActivityResult result) {
        if (call == null) {
            return;
        }
        answer(call, result != null && result.getResultCode() == Activity.RESULT_OK ? "ok" : "cancel", null);
    }

    private KeyguardManager keyguard() {
        return (KeyguardManager) getContext().getSystemService(Context.KEYGUARD_SERVICE);
    }

    private boolean secure() {
        KeyguardManager keyguard = keyguard();
        if (keyguard == null || !keyguard.isDeviceSecure()) {
            return false;
        }
        // API 29부터: 보안 잠금 화면 기능이 없는 기기(일부 전용 기기)는 확인 화면을 띄울 수 없다
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.Q ||
            getContext().getPackageManager().hasSystemFeature(PackageManager.FEATURE_SECURE_LOCK_SCREEN);
    }

    private static void answer(PluginCall call, String result, String why) {
        JSObject ret = new JSObject();
        ret.put("result", result);
        if (why != null) {
            ret.put("why", why);
        }
        call.resolve(ret);
    }
}
