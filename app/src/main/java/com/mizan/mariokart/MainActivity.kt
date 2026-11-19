package com.mizan.mariokart

import android.annotation.SuppressLint
import android.app.UiModeManager
import android.content.Context
import android.content.res.Configuration
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Build
import android.os.Bundle
import android.os.CombinedVibration
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.util.Log
import android.view.InputDevice
import android.view.KeyEvent
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.webkit.ConsoleMessage
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.webkit.WebViewAssetLoader
import org.json.JSONArray

class MainActivity : AppCompatActivity(), SensorEventListener {

    private lateinit var webView: WebView
    private var vibrator: Vibrator? = null
    private var vibratorManager: VibratorManager? = null

    private var sensorManager: SensorManager? = null
    private var accelerometer: Sensor? = null

    private var isTvDevice = false

    // Gamepad state tracking
    private var lastSteer = 0f
    private var gasPressed = false
    private var brakePressed = false
    private var driftPressed = false
    private var itemPressed = false

    // Sensor throttling
    private var lastSensorPostTime = 0L
    private var lastRoll = 0f
    private var lastPitch = 0f

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Keep screen on while playing
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        // Enable layout in cutout area for modern borderless displays
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            window.attributes.layoutInDisplayCutoutMode =
                WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
        }

        // Detect if running on Android TV
        val uiModeManager = getSystemService(Context.UI_MODE_SERVICE) as? UiModeManager
        isTvDevice = uiModeManager?.currentModeType == Configuration.UI_MODE_TYPE_TELEVISION

        // Initialize vibration service
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            vibratorManager = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
            vibrator = vibratorManager?.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            vibrator = getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
        }

        // Initialize tilt sensor
        sensorManager = getSystemService(Context.SENSOR_SERVICE) as? SensorManager
        accelerometer = sensorManager?.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)

        // Setup WebView
        setupWebView()
        setContentView(webView)

        // Handle modern gesture/hardware back navigation cleanly across all screens
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                handleBackPress()
            }
        })

        hideSystemUI()
    }

    private fun handleBackPress() {
        webView.evaluateJavascript(
            "typeof window.__handleBackNavigation === 'function' ? window.__handleBackNavigation() : false"
        ) { result ->
            val handled = result?.trim('"', '\'') == "true"
            Log.d("MarioKartNav", "Back pressed - handled by webview: $handled")
            if (!handled) {
                // User is on the root main menu hub: exit activity cleanly
                Log.d("MarioKartNav", "Exiting activity from root menu")
                finish()
            }
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        if (BuildConfig.DEBUG) {
            WebView.setWebContentsDebuggingEnabled(true)
        }

        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        webView = WebView(this).apply {
            setLayerType(View.LAYER_TYPE_HARDWARE, null)
            setBackgroundColor(0xFF081325.toInt())
            isFocusable = true
            isFocusableInTouchMode = true
            requestFocus()
            scrollBarStyle = View.SCROLLBARS_INSIDE_OVERLAY
            isVerticalScrollBarEnabled = false
            isHorizontalScrollBarEnabled = false
            overScrollMode = View.OVER_SCROLL_NEVER

            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                mediaPlaybackRequiresUserGesture = false
                allowFileAccess = false
                allowContentAccess = false
                useWideViewPort = true
                loadWithOverviewMode = true
                cacheMode = WebSettings.LOAD_DEFAULT
                mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            }

            addJavascriptInterface(AndroidGameBridge(), "AndroidBridge")

            webChromeClient = object : WebChromeClient() {
                override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
                    consoleMessage?.let {
                        Log.d("MarioKartJS", "${it.message()} -- From line ${it.lineNumber()} of ${it.sourceId()}")
                    }
                    return true
                }
            }

            webViewClient = object : WebViewClient() {
                override fun shouldInterceptRequest(
                    view: WebView?,
                    request: WebResourceRequest?
                ): WebResourceResponse? {
                    return request?.url?.let { assetLoader.shouldInterceptRequest(it) }
                }

                override fun onPageFinished(view: WebView?, url: String?) {
                    super.onPageFinished(view, url)
                    hideSystemUI()
                }

                override fun onReceivedError(
                    view: WebView?,
                    request: WebResourceRequest?,
                    error: WebResourceError?
                ) {
                    super.onReceivedError(view, request, error)
                    Log.e("MarioKart", "WebView error: ${error?.description} for ${request?.url}")
                }
            }

            loadUrl("https://appassets.androidplatform.net/assets/game/index.html")
        }
    }

    private fun hideSystemUI() {
        WindowCompat.setDecorFitsSystemWindows(window, false)
        val controller = WindowInsetsControllerCompat(window, window.decorView)
        controller.hide(WindowInsetsCompat.Type.systemBars())
        controller.systemBarsBehavior =
            WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
    }

    override fun onResume() {
        super.onResume()
        hideSystemUI()
        webView.onResume()
        webView.resumeTimers()
        accelerometer?.let {
            sensorManager?.registerListener(this, it, SensorManager.SENSOR_DELAY_GAME)
        }
    }

    override fun onPause() {
        super.onPause()
        webView.evaluateJavascript("window.dispatchEvent(new Event('blur'));", null)
        webView.onPause()
        webView.pauseTimers()
        sensorManager?.unregisterListener(this)
    }

    override fun onDestroy() {
        sensorManager?.unregisterListener(this)
        (webView.parent as? android.view.ViewGroup)?.removeView(webView)
        webView.stopLoading()
        webView.destroy()
        super.onDestroy()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) {
            hideSystemUI()
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Sensor Handling (Tilt Steering)
    // ─────────────────────────────────────────────────────────────────────────────
    override fun onSensorChanged(event: SensorEvent?) {
        if (event == null || event.sensor.type != Sensor.TYPE_ACCELEROMETER) return
        if (isFinishing || isDestroyed) return
        // In landscape, event.values[1] represents sideways tilt roll
        val roll = InputBridgeUtils.computeRollDegrees(event.values[1])
        val pitch = InputBridgeUtils.computePitchDegrees(event.values[0])

        val now = System.currentTimeMillis()
        if (now - lastSensorPostTime < 33L && Math.abs(roll - lastRoll) < 0.5f && Math.abs(pitch - lastPitch) < 0.5f) {
            return
        }
        lastSensorPostTime = now
        lastRoll = roll
        lastPitch = pitch

        webView.post {
            if (!isFinishing && !isDestroyed) {
                webView.evaluateJavascript("window.onNativeSensorOrientation?.($roll, $pitch);", null)
            }
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}

    // ─────────────────────────────────────────────────────────────────────────────
    // Gamepad & TV Remote Input Dispatch
    // ─────────────────────────────────────────────────────────────────────────────
    override fun dispatchGenericMotionEvent(event: MotionEvent): Boolean {
        if (event.source and InputDevice.SOURCE_CLASS_JOYSTICK != 0 ||
            event.source and InputDevice.SOURCE_GAMEPAD != 0
        ) {
            if (event.action == MotionEvent.ACTION_MOVE) {
                // Left stick X
                var steer = event.getAxisValue(MotionEvent.AXIS_X)
                // D-Pad Hat X
                val hatX = event.getAxisValue(MotionEvent.AXIS_HAT_X)
                if (Math.abs(hatX) > 0.1f) {
                    steer = hatX
                }

                // Triggers
                val rTrigger = event.getAxisValue(MotionEvent.AXIS_RTRIGGER)
                val gasAxis = event.getAxisValue(MotionEvent.AXIS_GAS)
                val isGasTrigger = (rTrigger > 0.2f || gasAxis > 0.2f)

                val lTrigger = event.getAxisValue(MotionEvent.AXIS_LTRIGGER)
                val brakeAxis = event.getAxisValue(MotionEvent.AXIS_BRAKE)
                val isBrakeTrigger = (lTrigger > 0.2f || brakeAxis > 0.2f)

                if (Math.abs(steer - lastSteer) > 0.03f || isGasTrigger != gasPressed || isBrakeTrigger != brakePressed) {
                    lastSteer = steer
                    gasPressed = isGasTrigger
                    brakePressed = isBrakeTrigger
                    dispatchGamepadState()
                }
                return true
            }
        }
        return super.dispatchGenericMotionEvent(event)
    }

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        val isDown = event.action == KeyEvent.ACTION_DOWN

        when (event.keyCode) {
            KeyEvent.KEYCODE_DPAD_LEFT -> {
                lastSteer = if (isDown) -1.0f else 0.0f
                dispatchGamepadState()
                return true
            }
            KeyEvent.KEYCODE_DPAD_RIGHT -> {
                lastSteer = if (isDown) 1.0f else 0.0f
                dispatchGamepadState()
                return true
            }
            KeyEvent.KEYCODE_BUTTON_A, KeyEvent.KEYCODE_DPAD_CENTER, KeyEvent.KEYCODE_ENTER -> {
                gasPressed = isDown
                dispatchGamepadState()
                if (isDown) {
                    webView.evaluateJavascript("window.onAndroidConfirm?.();", null)
                }
                return true
            }
            KeyEvent.KEYCODE_BUTTON_B -> {
                brakePressed = isDown
                dispatchGamepadState()
                return true
            }
            KeyEvent.KEYCODE_BUTTON_X, KeyEvent.KEYCODE_BUTTON_R1 -> {
                driftPressed = isDown
                dispatchGamepadState()
                return true
            }
            KeyEvent.KEYCODE_BUTTON_Y, KeyEvent.KEYCODE_BUTTON_L1 -> {
                itemPressed = isDown
                dispatchGamepadState()
                return true
            }
            KeyEvent.KEYCODE_BUTTON_START, KeyEvent.KEYCODE_MENU -> {
                if (isDown) {
                    webView.evaluateJavascript("document.getElementById('pause-btn')?.click();", null)
                }
                return true
            }
            KeyEvent.KEYCODE_BACK -> {
                if (isDown) {
                    handleBackPress()
                }
                return true
            }
        }

        return super.dispatchKeyEvent(event)
    }

    private fun dispatchGamepadState() {
        if (isFinishing || isDestroyed) return
        val json = InputBridgeUtils.formatGamepadJson(
            steer = lastSteer,
            gas = gasPressed,
            brake = brakePressed,
            drift = driftPressed,
            item = itemPressed
        )
        webView.post {
            if (!isFinishing && !isDestroyed) {
                webView.evaluateJavascript("window.onNativeGamepadInput?.($json);", null)
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // JavaScript Bridge API
    // ─────────────────────────────────────────────────────────────────────────────
    inner class AndroidGameBridge {

        @JavascriptInterface
        fun isTv(): Boolean = isTvDevice

        @JavascriptInterface
        fun vibrate(durationMs: Long) {
            try {
                vibrator?.vibrate(
                    VibrationEffect.createOneShot(durationMs, VibrationEffect.DEFAULT_AMPLITUDE)
                )
            } catch (e: Exception) {
                Log.w("MarioKart", "Vibration failed: ${e.message}")
            }
        }

        @JavascriptInterface
        fun vibratePattern(patternJson: String) {
            try {
                val timings = InputBridgeUtils.parseVibrationPattern(patternJson)
                vibrator?.vibrate(
                    VibrationEffect.createWaveform(timings, -1)
                )
            } catch (e: Exception) {
                Log.w("MarioKart", "Pattern vibration failed: ${e.message}")
            }
        }

        @JavascriptInterface
        fun triggerBack() {
            runOnUiThread {
                handleBackPress()
            }
        }

        @JavascriptInterface
        fun exitGame() {
            runOnUiThread {
                finish()
            }
        }
    }
}

/**
 * Utility functions for input formatting, sensor math, and bridge message serialization.
 * Extracted for clean testability and production robustness.
 */
object InputBridgeUtils {

    fun formatGamepadJson(
        steer: Float,
        gas: Boolean,
        brake: Boolean,
        drift: Boolean,
        item: Boolean
    ): String {
        return """
            {
                "steer": $steer,
                "gas": $gas,
                "brake": $brake,
                "drift": $drift,
                "item": $item
            }
        """.trimIndent()
    }

    fun parseVibrationPattern(patternJson: String): LongArray {
        val array = JSONArray(patternJson)
        return LongArray(array.length()) { i -> array.getLong(i) }
    }

    fun computeRollDegrees(accelerometerY: Float): Float {
        return accelerometerY * 9.0f
    }

    fun computePitchDegrees(accelerometerX: Float): Float {
        return accelerometerX * 9.0f
    }
}
