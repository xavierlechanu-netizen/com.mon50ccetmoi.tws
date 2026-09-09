package com.mon50ccetmoi.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothManager;
import android.bluetooth.le.BluetoothLeScanner;
import android.bluetooth.le.ScanCallback;
import android.bluetooth.le.ScanResult;
import android.bluetooth.le.ScanSettings;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

public class MeshScannerService extends Service {

    private static final String TAG = "MeshScannerService";
    private static final String CHANNEL_ID = "MeshNetworkChannel";
    private BluetoothLeScanner bluetoothLeScanner;
    private boolean isScanning = false;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("🛡️ Mon 50cc et moi")
                .setContentText("Radar communautaire antivol actif en arrière-plan.")
                .setSmallIcon(R.mipmap.ic_launcher)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .build();
        try {
            if (Build.VERSION.SDK_INT >= 34) { // Android 14+ (UPSIDE_DOWN_CAKE)
                startForeground(1, notification, 
                    android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE | 
                    android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
            } else {
                startForeground(1, notification);
            }
        } catch (Exception e) {
            Log.e(TAG, "Erreur SecurityException au démarrage du Foreground Service (permissions manquantes ?)", e);
            stopSelf();
            return;
        }
        
        initBluetoothScanner();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel serviceChannel = new NotificationChannel(
                    CHANNEL_ID,
                    "Radar Antivol Communautaire",
                    NotificationManager.IMPORTANCE_LOW
            );
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(serviceChannel);
            }
        }
    }

    private void initBluetoothScanner() {
        BluetoothManager bluetoothManager = (BluetoothManager) getSystemService(Context.BLUETOOTH_SERVICE);
        if (bluetoothManager != null) {
            BluetoothAdapter bluetoothAdapter = bluetoothManager.getAdapter();
            if (bluetoothAdapter != null && bluetoothAdapter.isEnabled()) {
                bluetoothLeScanner = bluetoothAdapter.getBluetoothLeScanner();
                startScanning();
            } else {
                Log.w(TAG, "Bluetooth est désactivé.");
            }
        }
    }

    private void startScanning() {
        if (bluetoothLeScanner != null && !isScanning) {
            ScanSettings settings = new ScanSettings.Builder()
                    .setScanMode(ScanSettings.SCAN_MODE_LOW_POWER) // Économie de batterie
                    .build();

            try {
                bluetoothLeScanner.startScan(null, settings, leScanCallback);
                isScanning = true;
                Log.i(TAG, "Scan BLE en arrière-plan démarré.");
            } catch (SecurityException e) {
                Log.e(TAG, "Permissions manquantes pour le scan Bluetooth", e);
            }
        }
    }

    private void stopScanning() {
        if (bluetoothLeScanner != null && isScanning) {
            try {
                bluetoothLeScanner.stopScan(leScanCallback);
                isScanning = false;
                Log.i(TAG, "Scan BLE arrêté.");
            } catch (SecurityException e) {
                Log.e(TAG, "Erreur de sécurité lors de l'arrêt du scan", e);
            }
        }
    }

    private ScanCallback leScanCallback = new ScanCallback() {
        @Override
        public void onScanResult(int callbackType, ScanResult result) {
            super.onScanResult(callbackType, result);
            if (result.getDevice() != null) {
                try {
                    String deviceName = result.getDevice().getName();
                    if (deviceName != null && deviceName.startsWith("MON50CC-SOS")) {
                        Log.w(TAG, "🚨 SCOOTER VOLÉ DÉTECTÉ EN ARRIÈRE-PLAN : " + deviceName);
                        // Lancement d'un thread pour envoyer la localisation au Cloud
                        reportStolenScooterToCloud(result.getDevice().getAddress());
                    }
                } catch (SecurityException e) {
                    // Ignore
                }
            }
        }
    };

    private void reportStolenScooterToCloud(String macAddress) {
        new Thread(() -> {
            try {
                URL url = new URL("https://us-central1-votre-projet.cloudfunctions.net/reportTheftSignal");
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json; utf-8");
                conn.setRequestProperty("Accept", "application/json");
                conn.setDoOutput(true);
                
                // MOCK GPS Location for now
                String jsonInputString = "{\"mac\": \"" + macAddress + "\", \"lat\": 48.8566, \"lng\": 2.3522}";
                try(OutputStream os = conn.getOutputStream()) {
                    byte[] input = jsonInputString.getBytes("utf-8");
                    os.write(input, 0, input.length);
                }
                
                int code = conn.getResponseCode();
                Log.i(TAG, "Alerte envoyée à Firebase avec le code " + code);
            } catch (Exception e) {
                Log.e(TAG, "Erreur réseau Firebase", e);
            }
        }).start();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        return START_STICKY; // Redémarre le service s'il est tué par le système
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        stopScanning();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
