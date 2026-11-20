package com.bikeos.jarvis

import android.Manifest
import android.app.Activity
import android.bluetooth.*
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.content.*
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.View
import android.view.WindowManager
import android.webkit.*
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewClientCompat
import org.json.JSONObject

class MainActivity : Activity() {
    private lateinit var webView: WebView
    private var adapter: BluetoothAdapter? = null
    private val profileStates = mutableMapOf<Int, Boolean>()
    private val permissionRequest = 4102
    private val receiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            when (intent?.action) {
                BluetoothAdapter.ACTION_STATE_CHANGED,
                BluetoothDevice.ACTION_ACL_CONNECTED,
                BluetoothDevice.ACTION_ACL_DISCONNECTED,
                BluetoothHeadset.ACTION_CONNECTION_STATE_CHANGED,
                BluetoothA2dp.ACTION_CONNECTION_STATE_CHANGED -> publishBluetoothStatus()
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        window.decorView.systemUiVisibility = (View.SYSTEM_UI_FLAG_FULLSCREEN or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or View.SYSTEM_UI_FLAG_LAYOUT_STABLE)
        val manager = getSystemService(BLUETOOTH_SERVICE) as BluetoothManager
        adapter = manager.adapter
        webView = WebView(this)
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.databaseEnabled = true
        webView.settings.setGeolocationEnabled(true)
        webView.settings.allowFileAccess = false
        webView.settings.allowContentAccess = false
        webView.addJavascriptInterface(NativeBridge(), "BikeOSNative")
        val assetLoader = WebViewAssetLoader.Builder().addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this)).build()
        webView.webViewClient = object : WebViewClientCompat() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val uri = request.url
                if (uri.host == "appassets.androidplatform.net") return false
                return try { startActivity(Intent(Intent.ACTION_VIEW, uri)); true } catch (_: Exception) { true }
            }
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest) = assetLoader.shouldInterceptRequest(request.url)
        }
        webView.webChromeClient = object : WebChromeClient() {
            override fun onGeolocationPermissionsShowPrompt(origin: String, callback: GeolocationPermissions.Callback) {
                if (hasLocationPermission()) callback.invoke(origin, true, false)
                else { locationCallback = callback; locationOrigin = origin; ActivityCompat.requestPermissions(this@MainActivity, arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION), permissionRequest) }
            }
        }
        setContentView(webView)
        webView.loadUrl("https://appassets.androidplatform.net/assets/index.html")
        registerBluetoothReceiver()
        requestBluetoothPermissionIfNeeded()
        if (!hasLocationPermission()) ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION), permissionRequest)
    }

    private var locationCallback: GeolocationPermissions.Callback? = null
    private var locationOrigin: String? = null
    private fun hasLocationPermission() =
        ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
        ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED

    private fun hasBluetoothPermission() = Build.VERSION.SDK_INT < 31 ||
        ContextCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED

    private fun requestBluetoothPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT >= 31 && !hasBluetoothPermission()) {
            ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.BLUETOOTH_CONNECT), permissionRequest + 1)
        } else refreshBluetoothProfiles()
    }

    private fun registerBluetoothReceiver() {
        val filter = IntentFilter().apply {
            addAction(BluetoothAdapter.ACTION_STATE_CHANGED)
            addAction(BluetoothDevice.ACTION_ACL_CONNECTED)
            addAction(BluetoothDevice.ACTION_ACL_DISCONNECTED)
            addAction(BluetoothHeadset.ACTION_CONNECTION_STATE_CHANGED)
            addAction(BluetoothA2dp.ACTION_CONNECTION_STATE_CHANGED)
        }
        if (Build.VERSION.SDK_INT >= 33) registerReceiver(receiver, filter, RECEIVER_NOT_EXPORTED) else registerReceiver(receiver, filter)
    }

    private fun refreshBluetoothProfiles() {
        if (!hasBluetoothPermission()) { publishBluetoothStatus(); return }
        val a = adapter ?: run { publishBluetoothStatus(); return }
        try {
            a.getProfileProxy(this, object : BluetoothProfile.ServiceListener {
                override fun onServiceConnected(profile: Int, proxy: BluetoothProfile) {
                    try { profileStates[profile] = proxy.connectedDevices.isNotEmpty() } catch (_: SecurityException) { profileStates[profile] = false }
                    publishBluetoothStatus()
                    a.closeProfileProxy(profile, proxy)
                }
                override fun onServiceDisconnected(profile: Int) { profileStates[profile] = false; publishBluetoothStatus() }
            }, BluetoothProfile.HEADSET)
            a.getProfileProxy(this, object : BluetoothProfile.ServiceListener {
                override fun onServiceConnected(profile: Int, proxy: BluetoothProfile) {
                    try { profileStates[profile] = proxy.connectedDevices.isNotEmpty() } catch (_: SecurityException) { profileStates[profile] = false }
                    publishBluetoothStatus()
                    a.closeProfileProxy(profile, proxy)
                }
                override fun onServiceDisconnected(profile: Int) { profileStates[profile] = false; publishBluetoothStatus() }
            }, BluetoothProfile.A2DP)
        } catch (_: SecurityException) { publishBluetoothStatus() }
    }

    private fun publishBluetoothStatus() {
        val a = adapter
        val enabled = try { a?.isEnabled == true } catch (_: SecurityException) { false }
        val connected = profileStates.values.any { it }
        val json = JSONObject().put("supported", a != null).put("enabled", enabled).put("connected", connected)
            .put("permission", hasBluetoothPermission()).toString()
        runOnUiThread {
            if (::webView.isInitialized) webView.evaluateJavascript("window.BikeOSBluetoothUpdate && window.BikeOSBluetoothUpdate($json)", null)
        }
    }

    inner class NativeBridge {
        @JavascriptInterface fun openYouTubeMusic() { runOnUiThread { try { val launch = packageManager.getLaunchIntentForPackage("com.google.android.apps.youtube.music"); if (launch != null) startActivity(launch) else startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://music.youtube.com"))) } catch (_: Exception) { try { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://music.youtube.com"))) } catch (_: Exception) {} } } }
        @JavascriptInterface fun refreshBluetooth() { runOnUiThread { requestBluetoothPermissionIfNeeded(); refreshBluetoothProfiles() } }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == permissionRequest) {
            val granted = grantResults.any { it == PackageManager.PERMISSION_GRANTED }
            locationCallback?.invoke(locationOrigin, granted, false)
            locationCallback = null; locationOrigin = null
        }
        if (requestCode == permissionRequest + 1) refreshBluetoothProfiles()
    }

    override fun onResume() { super.onResume(); if (::webView.isInitialized) refreshBluetoothProfiles() }
    override fun onBackPressed() { if (::webView.isInitialized && webView.canGoBack()) webView.goBack() else super.onBackPressed() }
    override fun onDestroy() {
        try { unregisterReceiver(receiver) } catch (_: Exception) {}
        if (::webView.isInitialized) webView.destroy()
        super.onDestroy()
    }
}