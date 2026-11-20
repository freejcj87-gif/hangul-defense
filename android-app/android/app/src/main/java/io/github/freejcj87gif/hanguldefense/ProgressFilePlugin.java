package io.github.freejcj87gif.hanguldefense;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.ContentResolver;
import android.content.Intent;
import android.net.Uri;
import androidx.activity.result.ActivityResult;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/**
 * 진행 파일 옮기기(앱 안 전용 플러그인). 보호자 화면(문턱 뒤)의 '파일로 내보내기'와 '파일 불러오기'를 앱에서 되게 한다.
 * WebView는 웹판의 내려받기(a download, Blob 주소)를 처리하지 않아서 app-shell.js가 그 누름을 받아 여기로 넘긴다.
 *
 * 권한이 하나도 필요 없다.
 * - save: 시스템 문서 화면(ACTION_CREATE_DOCUMENT)에서 보호자가 고른 곳(기기 폴더·드라이브 등)에 파일 하나를 쓴다.
 *         시스템이 그 파일 하나에만 쓰기 허락을 준다(저장공간 권한 불필요).
 * - share: 캐시 폴더(cache/progress/, 자동 백업 대상 아님)에 파일 하나를 쓰고, FileProvider 주소로 Android 공유 창을 연다.
 *          고른 앱에만 그 파일 하나의 읽기 허락을 준다.
 * - open: 시스템 문서 화면(ACTION_OPEN_DOCUMENT)에서 보호자가 고른 파일 하나를 읽어 글자로 돌려준다. 크기 상한을 넘으면 읽지 않는다.
 * 앱이 스스로 파일을 올리거나 보내지 않는다. 어디로 둘지·보낼지는 보호자가 시스템 화면에서 고른다.
 */
@CapacitorPlugin(name = "ProgressFile")
public class ProgressFilePlugin extends Plugin {

    private static final String MIME = "application/json";
    /** 게임의 진행 파일 상한(book.js FILE_MAX = 1 MiB)과 같게 둔다. JS가 maxBytes로 넘기면 그 값(이 값 이하)을 쓴다. */
    private static final int MAX_BYTES = 1048576;
    private static final String SHARE_DIR = "progress";

    /**
     * 저장할 글. 문서 화면이 떠 있는 동안 Capacitor가 호출 인자를 액티비티 저장 상태(Bundle)에 넣으므로
     * 글은 호출 인자에서 빼서 여기 둔다(큰 Bundle은 TransactionTooLargeException을 낸다).
     * 그 사이 앱 프로세스가 죽으면 글도 사라지고, 결과는 실패로 돌려준다(보호자가 다시 내보내면 된다).
     */
    private String pendingText = null;

    @PluginMethod
    public void save(PluginCall call) {
        final String text = call.getString("text");
        if (text == null || text.isEmpty() || text.length() > MAX_BYTES) {
            call.reject("진행 파일 글이 비었거나 너무 커요", "BAD_TEXT");
            return;
        }
        final String name = safeName(call.getString("name"));
        pendingText = text;
        call.getData().remove("text");
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(MIME);
        intent.putExtra(Intent.EXTRA_TITLE, name);
        try {
            startActivityForResult(call, intent, "saveResult");
        } catch (ActivityNotFoundException e) {
            pendingText = null;
            getBridge().releaseCall(call);
            call.reject("문서 화면을 열 수 없어요", "NO_DOCUMENT_UI");
        }
    }

    @ActivityCallback
    private void saveResult(PluginCall call, ActivityResult result) {
        final String text = pendingText;
        pendingText = null;
        if (call == null) {
            return;
        }
        getBridge().releaseCall(call);
        final Uri uri = resultUri(result);
        if (uri == null) {
            done(call, false);
            return;
        }
        if (text == null) {
            call.reject("앱이 다시 시작되어 저장할 글이 없어요. 다시 내보내 주세요.", "LOST");
            return;
        }
        execute(() -> {
            try (OutputStream out = openForWrite(uri)) {
                if (out == null) {
                    throw new IOException("no output stream");
                }
                out.write(text.getBytes(StandardCharsets.UTF_8));
                out.flush();
                done(call, true);
            } catch (Exception e) {
                call.reject("파일을 쓰지 못했어요", "WRITE_FAILED", e);
            }
        });
    }

    @PluginMethod
    public void share(PluginCall call) {
        final String text = call.getString("text");
        if (text == null || text.isEmpty() || text.length() > MAX_BYTES) {
            call.reject("진행 파일 글이 비었거나 너무 커요", "BAD_TEXT");
            return;
        }
        final Activity activity = getActivity();
        if (activity == null) {
            call.reject("앱 화면이 없어요", "NO_ACTIVITY");
            return;
        }
        try {
            File dir = new File(getContext().getCacheDir(), SHARE_DIR);
            if (!dir.isDirectory() && !dir.mkdirs()) {
                throw new IOException("cannot make " + dir);
            }
            File[] old = dir.listFiles();
            if (old != null) {
                for (File f : old) {
                    // 지난번에 보낸 사본은 지운다(한 벌만 둔다)
                    //noinspection ResultOfMethodCallIgnored
                    f.delete();
                }
            }
            File file = new File(dir, safeName(call.getString("name")));
            try (FileOutputStream out = new FileOutputStream(file)) {
                out.write(text.getBytes(StandardCharsets.UTF_8));
            }
            Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", file);
            Intent send = new Intent(Intent.ACTION_SEND);
            send.setType(MIME);
            send.putExtra(Intent.EXTRA_STREAM, uri);
            send.setClipData(ClipData.newRawUri(file.getName(), uri));
            send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            Intent chooser = Intent.createChooser(send, activity.getString(R.string.progress_share_title));
            chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            activity.startActivity(chooser);
            done(call, true);
        } catch (ActivityNotFoundException e) {
            call.reject("보낼 앱이 없어요", "NO_SHARE_TARGET", e);
        } catch (Exception e) {
            call.reject("보낼 파일을 만들지 못했어요", "SHARE_FAILED", e);
        }
    }

    @PluginMethod
    public void open(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        // 메신저·드라이브를 거친 파일은 형식이 application/json이 아닐 때가 있어 거르지 않는다. 내용은 게임이 검사한다(아니면 '진행 파일이 아니에요').
        intent.setType("*/*");
        try {
            startActivityForResult(call, intent, "openResult");
        } catch (ActivityNotFoundException e) {
            getBridge().releaseCall(call);
            call.reject("문서 화면을 열 수 없어요", "NO_DOCUMENT_UI");
        }
    }

    @ActivityCallback
    private void openResult(PluginCall call, ActivityResult result) {
        if (call == null) {
            return;
        }
        getBridge().releaseCall(call);
        final Uri uri = resultUri(result);
        if (uri == null) {
            done(call, false);
            return;
        }
        final int max = Math.max(1, Math.min(MAX_BYTES, call.getInt("maxBytes", MAX_BYTES)));
        execute(() -> {
            try (InputStream in = getContext().getContentResolver().openInputStream(uri)) {
                if (in == null) {
                    throw new IOException("no input stream");
                }
                ByteArrayOutputStream buf = new ByteArrayOutputStream();
                byte[] chunk = new byte[8192];
                int n;
                while ((n = in.read(chunk)) != -1) {
                    buf.write(chunk, 0, n);
                    if (buf.size() > max) {
                        JSObject big = new JSObject();
                        big.put("done", true);
                        big.put("tooBig", true);
                        call.resolve(big);
                        return;
                    }
                }
                String text = new String(buf.toByteArray(), StandardCharsets.UTF_8);
                if (text.startsWith("﻿")) {
                    text = text.substring(1);
                }
                JSObject ret = new JSObject();
                ret.put("done", true);
                ret.put("text", text);
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("파일을 읽지 못했어요", "READ_FAILED", e);
            }
        });
    }

    private static Uri resultUri(ActivityResult result) {
        if (result == null || result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            return null;
        }
        return result.getData().getData();
    }

    private static void done(PluginCall call, boolean done) {
        JSObject ret = new JSObject();
        ret.put("done", done);
        call.resolve(ret);
    }

    /** 파일 이름: 게임이 만든 kkomaeul-progress-YYYYMMDD.json 모양만 그대로 쓰고, 그 밖의 글자는 바꾼다. */
    private static String safeName(String name) {
        String n = name == null ? "" : name.replaceAll("[^A-Za-z0-9._-]", "_");
        if (n.isEmpty() || n.startsWith(".")) {
            n = "kkomaeul-progress" + n;
        }
        if (!n.endsWith(".json")) {
            n = n + ".json";
        }
        return n.length() > 80 ? n.substring(n.length() - 80) : n;
    }

    private OutputStream openForWrite(Uri uri) throws FileNotFoundException {
        ContentResolver resolver = getContext().getContentResolver();
        try {
            // "wt": 덮어쓸 때 뒤에 옛 내용이 남지 않게 자른다. 이 모드를 받지 않는 문서 제공자가 있어 "w"로 한 번 더 시도한다.
            return resolver.openOutputStream(uri, "wt");
        } catch (FileNotFoundException | IllegalArgumentException | UnsupportedOperationException e) {
            return resolver.openOutputStream(uri, "w");
        }
    }
}
