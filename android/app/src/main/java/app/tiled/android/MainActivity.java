package app.tiled.android;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public class MainActivity extends Activity {

    /** Production URL — Render static site. */
    private static final String APP_URL = "https://tiled.onrender.com";

    private WebView webView;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // ── Edge-to-edge dark chrome ──────────────────────────────────────
        getWindow().setStatusBarColor(Color.parseColor("#050506"));
        getWindow().setNavigationBarColor(Color.parseColor("#050506"));
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            // Light-on-dark icons in status bar (we have a dark background)
            getWindow().getDecorView().setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
        }

        setContentView(R.layout.activity_main);
        webView = findViewById(R.id.webview);

        // ── WebView settings ──────────────────────────────────────────────
        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);       // localStorage / sessionStorage
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(false);        // lock down file:// access
        s.setMediaPlaybackRequiresUserGesture(false); // autoplay in feed
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);

        // ── Keep all navigation inside the app ───────────────────────────
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view,
                                                     WebResourceRequest request) {
                String url = request.getUrl().toString();
                if (url.startsWith(APP_URL)) {
                    return false; // handle in-app
                }
                // Open external links in the system browser
                startActivity(new Intent(Intent.ACTION_VIEW, request.getUrl()));
                return true;
            }
        });

        // ── Grant camera / mic permissions for tiles ─────────────────────
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(PermissionRequest request) {
                // Grant camera and audio — user will still be prompted by
                // Android's own permission dialog the first time.
                request.grant(request.getResources());
            }
        });

        webView.loadUrl(APP_URL);
    }

    /** Hardware back button navigates WebView history first. */
    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
