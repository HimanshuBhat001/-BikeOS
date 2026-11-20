package com.bikeos.jarvis

import android.content.ComponentName
import android.media.MediaMetadata
import android.media.session.MediaController
import android.media.session.MediaSessionManager
import android.service.notification.NotificationListenerService
import android.util.Log
import org.json.JSONObject

class YouTubeMediaListener : NotificationListenerService() {
    companion object {
        private const val YT_PACKAGE = "com.google.android.apps.youtube.music"
        @Volatile private var activeController: MediaController? = null
        @Volatile private var listener: YouTubeMediaListener? = null

        fun refresh(context: android.content.Context) { listener?.loadController() }

        fun perform(command: String) {
            val c = activeController ?: return
            try {
                when (command) {
                    "play" -> c.transportControls.play()
                    "pause" -> c.transportControls.pause()
                    "toggle" -> if (c.playbackState?.state == android.media.session.PlaybackState.STATE_PLAYING) c.transportControls.pause() else c.transportControls.play()
                    "next" -> c.transportControls.skipToNext()
                    "previous" -> c.transportControls.skipToPrevious()
                }
                listener?.publish()
            } catch (e: Exception) { Log.w("BikeOSMedia", "Media command failed", e) }
        }
    }

    private val callback = object : MediaController.Callback() {
        override fun onMetadataChanged(metadata: MediaMetadata?) { publish() }
        override fun onPlaybackStateChanged(state: android.media.session.PlaybackState?) { publish() }
        override fun onSessionDestroyed() { activeController = null; publish() }
    }

    override fun onListenerConnected() {
        super.onListenerConnected()
        listener = this
        loadController()
    }

    override fun onListenerDisconnected() {
        activeController?.unregisterCallback(callback)
        activeController = null
        listener = null
        super.onListenerDisconnected()
    }

    override fun onNotificationPosted(sbn: android.service.notification.StatusBarNotification?) {
        if (sbn?.packageName == YT_PACKAGE) loadController()
    }

    override fun onNotificationRemoved(sbn: android.service.notification.StatusBarNotification?) {
        if (sbn?.packageName == YT_PACKAGE) loadController()
    }

    private fun loadController() {
        try {
            val manager = getSystemService(MEDIA_SESSION_SERVICE) as MediaSessionManager
            val controllers = manager.getActiveSessions(ComponentName(this, YouTubeMediaListener::class.java))
            val selected = controllers.firstOrNull { it.packageName == YT_PACKAGE }
            if (selected !== activeController) {
                activeController?.unregisterCallback(callback)
                activeController = selected
                activeController?.registerCallback(callback)
            }
            publish()
        } catch (e: SecurityException) {
            send(JSONObject().put("permission", false).put("available", false).toString())
        } catch (e: Exception) {
            Log.w("BikeOSMedia", "Unable to read YouTube Music session", e)
            send(JSONObject().put("permission", true).put("available", false).toString())
        }
    }

    private fun publish() {
        val c = activeController
        val metadata = c?.metadata
        val state = c?.playbackState
        val duration = metadata?.getLong(MediaMetadata.METADATA_KEY_DURATION) ?: 0L
        val position = state?.position ?: 0L
        val json = JSONObject()
            .put("permission", true)
            .put("available", c != null)
            .put("playing", state?.state == android.media.session.PlaybackState.STATE_PLAYING)
            .put("title", metadata?.getString(MediaMetadata.METADATA_KEY_TITLE) ?: "Nothing playing")
            .put("artist", metadata?.getString(MediaMetadata.METADATA_KEY_ARTIST) ?: metadata?.getString(MediaMetadata.METADATA_KEY_ALBUM_ARTIST) ?: "Start YouTube Music on this phone")
            .put("album", metadata?.getString(MediaMetadata.METADATA_KEY_ALBUM) ?: "")
            .put("duration", duration)
            .put("position", position)
            .toString()
        send(json)
    }

    private fun send(json: String) {
        val activity = MainActivity.instance ?: return
        activity.runOnUiThread {
            if (!activity.isFinishing) activity.webViewForMedia()?.evaluateJavascript("window.BikeOSMediaUpdate && window.BikeOSMediaUpdate($json)", null)
        }
    }

    override fun onDestroy() {
        activeController?.unregisterCallback(callback)
        activeController = null
        listener = null
        super.onDestroy()
    }
}
