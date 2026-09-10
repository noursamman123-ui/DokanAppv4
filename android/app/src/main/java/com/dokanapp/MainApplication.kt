package com.dokanapp

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.modules.network.OkHttpClientProvider
import java.net.Inet4Address
import java.net.InetAddress
import okhttp3.Dns

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // Packages that cannot be autolinked yet can be added manually here, for example:
          // add(MyReactNativePackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()

    // FCM's own auto-created fallback channel uses IMPORTANCE_DEFAULT, which
    // never shows a heads-up popup — only a silent shade entry. Push
    // notifications are set to target this channel instead (see
    // AndroidManifest.xml's default_notification_channel_id meta-data).
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(
        "dokan_promotions",
        "العروض والإشعارات",
        NotificationManager.IMPORTANCE_HIGH
      )
      val notificationManager = getSystemService(NotificationManager::class.java)
      notificationManager.createNotificationChannel(channel)
    }

    OkHttpClientProvider.setOkHttpClientFactory {
      OkHttpClientProvider.createClientBuilder(applicationContext)
        .dns(
          object : Dns {
            override fun lookup(hostname: String): List<InetAddress> {
              val addresses = Dns.SYSTEM.lookup(hostname)
              val ipv4Addresses = addresses.filterIsInstance<Inet4Address>()

              return if (ipv4Addresses.isNotEmpty()) {
                ipv4Addresses
              } else {
                addresses
              }
            }
          }
        )
        .build()
    }

    loadReactNative(this)
  }
}
