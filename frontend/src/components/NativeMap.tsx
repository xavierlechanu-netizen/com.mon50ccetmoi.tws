import React, { forwardRef } from 'react';
import { View, StyleSheet } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Polyline } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';

interface Signal {
  id: string;
  lat: number;
  lng: number;
  type: string;
  description?: string;
  upvotes: number;
  downvotes: number;
  user_id: string;
  created_at: string;
}

const SIGNAL_COLORS: { [key: string]: string } = {
  police: '#3b82f6',
  danger: '#ef4444',
  tunnel: '#8b5cf6',
  speed_limit: '#f97316',
  parking: '#10b981',
};

const SIGNAL_ICONS: { [key: string]: string } = {
  police: 'shield',
  danger: 'warning',
  tunnel: 'remove-circle',
  speed_limit: 'speedometer',
  parking: 'navigate',
};

interface NativeMapProps {
  initialLatitude: number;
  initialLongitude: number;
  signals: Signal[];
  onSignalPress: (signal: Signal) => void;
  onMapReady?: () => void;
}

const NativeMap = forwardRef<any, NativeMapProps>((
  { initialLatitude, initialLongitude, signals, onSignalPress, onMapReady },
  ref
) => {
  return (
    <MapView
      ref={ref}
      style={StyleSheet.absoluteFillObject}
      provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
      initialRegion={{
        latitude: initialLatitude,
        longitude: initialLongitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }}
      showsUserLocation
      showsMyLocationButton={false}
      onMapReady={onMapReady}
    >
      {signals.map((signal) => (
        <Marker
          key={signal.id}
          coordinate={{ latitude: signal.lat, longitude: signal.lng }}
          onPress={() => onSignalPress(signal)}
        >
          <View style={[styles.markerContainer, { backgroundColor: SIGNAL_COLORS[signal.type] || '#ef4444' }]}>
            <Ionicons
              name={(SIGNAL_ICONS[signal.type] || 'warning') as any}
              size={18}
              color="#fff"
            />
          </View>
        </Marker>
      ))}
    </MapView>
  );
});

NativeMap.displayName = 'NativeMap';

export default NativeMap;
export const isMapAvailable = true;

const styles = StyleSheet.create({
  markerContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
});
