package com.homefitnesscoach.app

import androidx.activity.result.ActivityResult
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.ActiveCaloriesBurnedRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.time.TimeRangeFilter
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

/**
 * Health Connect (Android): read-only steps and active calories, nothing is written and nothing is
 * uploaded by this plugin. The web layer decides what to do with the numbers.
 */
@CapacitorPlugin(name = "ApexHealth")
class ApexHealthPlugin : Plugin() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private val permissions = setOf(
        HealthPermission.getReadPermission(StepsRecord::class),
        HealthPermission.getReadPermission(ActiveCaloriesBurnedRecord::class),
    )

    private fun sdkStatus(): Int = HealthConnectClient.getSdkStatus(context)
    private fun client(): HealthConnectClient = HealthConnectClient.getOrCreate(context)

    /** available: ready to use. needsInstall: the Health Connect app is missing/outdated (Android 13 and below). */
    @PluginMethod
    fun status(call: PluginCall) {
        val s = sdkStatus()
        val out = JSObject()
        out.put("available", s == HealthConnectClient.SDK_AVAILABLE)
        out.put("needsInstall", s == HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED)
        if (s != HealthConnectClient.SDK_AVAILABLE) { call.resolve(out.also { it.put("granted", false) }); return }
        scope.launch {
            try {
                out.put("granted", client().permissionController.getGrantedPermissions().containsAll(permissions))
                call.resolve(out)
            } catch (e: Exception) { call.reject(e.message ?: "Health Connect error") }
        }
    }

    @PluginMethod
    fun requestHealthAccess(call: PluginCall) {
        if (sdkStatus() != HealthConnectClient.SDK_AVAILABLE) { call.reject("Health Connect isn't available on this device."); return }
        val intent = PermissionController.createRequestPermissionResultContract().createIntent(context, permissions)
        startActivityForResult(call, intent, "onPermissionResult")
    }

    @ActivityCallback
    private fun onPermissionResult(call: PluginCall?, @Suppress("UNUSED_PARAMETER") result: ActivityResult) {
        if (call == null) return
        scope.launch {
            try {
                val granted = client().permissionController.getGrantedPermissions().containsAll(permissions)
                call.resolve(JSObject().put("granted", granted))
            } catch (e: Exception) { call.reject(e.message ?: "Health Connect error") }
        }
    }

    /** Steps + active kcal for today and the previous days-1 days (local time). */
    @PluginMethod
    fun getSummary(call: PluginCall) {
        val days = (call.getInt("days") ?: 7).coerceIn(1, 30)
        if (sdkStatus() != HealthConnectClient.SDK_AVAILABLE) { call.reject("Health Connect isn't available on this device."); return }
        scope.launch {
            try {
                val c = client()
                val zone = ZoneId.systemDefault()
                val arr = JSArray()
                for (i in 0 until days) {
                    val date = LocalDate.now(zone).minusDays(i.toLong())
                    val start = date.atStartOfDay(zone).toInstant()
                    val end = if (i == 0) Instant.now() else date.plusDays(1).atStartOfDay(zone).toInstant()
                    val r = c.aggregate(
                        AggregateRequest(
                            metrics = setOf(StepsRecord.COUNT_TOTAL, ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL),
                            timeRangeFilter = TimeRangeFilter.between(start, end),
                        ),
                    )
                    arr.put(
                        JSObject()
                            .put("dayKey", date.toString())
                            .put("steps", r[StepsRecord.COUNT_TOTAL] ?: 0L)
                            .put("kcal", Math.round(r[ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL]?.inKilocalories ?: 0.0)),
                    )
                }
                call.resolve(JSObject().put("days", arr))
            } catch (e: SecurityException) {
                call.reject("Permission not granted.", "PERMISSION")
            } catch (e: Exception) { call.reject(e.message ?: "Health Connect error") }
        }
    }
}
