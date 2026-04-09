import React, { forwardRef } from 'react';
import { View, Text, StyleSheet, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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

interface NativeMapProps {
  initialLatitude: number;
  initialLongitude: number;
  signals: Signal[];
  onSignalPress: (signal: Signal) => void;
  onMapReady?: () => void;
}

const NativeMap = forwardRef<any, NativeMapProps>((
  { initialLatitude, initialLongitude, signals, onMapReady },
  ref
) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  React.useEffect(() => {
    onMapReady?.();
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#0f1729' : '#e5e7eb' }]}>
      <View style={styles.content}>
        <Ionicons name="location" size={48} color="#e94560" />
        <Text style={[styles.coords, { color: isDark ? '#fff' : '#1a1a2e' }]}>
          {initialLatitude.toFixed(4)}, {initialLongitude.toFixed(4)}
        </Text>
        <Text style={[styles.subtext, { color: isDark ? '#a0a0a0' : '#666' }]}>
          {signals.length} signalements actifs
        </Text>
        <Text style={[styles.hint, { color: isDark ? '#666' : '#999' }]}>
          La carte est disponible sur l'app mobile
        </Text>
      </View>
    </View>
  );
});

NativeMap.displayName = 'NativeMap';

export default NativeMap;
export const isMapAvailable = false;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
  },
  coords: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
  },
  subtext: {
    fontSize: 14,
    marginTop: 8,
  },
  hint: {
    fontSize: 12,
    marginTop: 16,
    fontStyle: 'italic',
  },
});
