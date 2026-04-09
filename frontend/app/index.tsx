import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useColorScheme,
  Alert,
  Platform,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../src/contexts/AuthContext';
import { apiService } from '../src/services/api';
import { socketService } from '../src/services/socket';

interface Signal {
  id: string;
  lat: number;
  lng: number;
  type: string;
  upvotes: number;
  downvotes: number;
  user_id: string;
  created_at: string;
}

const { width, height } = Dimensions.get('window');

export default function MapScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { user, isLoading: authLoading } = useAuth();
  
  const mapRef = useRef<MapView>(null);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [antivol, setAntivol] = useState(false);
  const [lastPos, setLastPos] = useState<{ lat: number; lng: number } | null>(null);
  const [lastSignalTime, setLastSignalTime] = useState<number>(0);
  const [lastAlertTime, setLastAlertTime] = useState<number>(0);
  const [selectedSignal, setSelectedSignal] = useState<Signal | null>(null);

  const colors = {
    background: isDark ? '#1a1a2e' : '#f5f5f5',
    card: isDark ? '#16213e' : '#ffffff',
    text: isDark ? '#ffffff' : '#1a1a2e',
    textSecondary: isDark ? '#a0a0a0' : '#666666',
    primary: '#e94560',
    success: '#4ade80',
    warning: '#fbbf24',
  };

  // Request location permissions and start tracking
  useEffect(() => {
    let locationSubscription: Location.LocationSubscription | null = null;

    const startLocationTracking = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission refusée', 'L\'accès à la localisation est nécessaire');
          setIsLoading(false);
          return;
        }

        // Get initial location
        const currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        setLocation(currentLocation);
        setIsLoading(false);

        // Start watching location
        locationSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            distanceInterval: 10,
            timeInterval: 5000,
          },
          (newLocation) => {
            setLocation(newLocation);
            checkProximity(newLocation.coords.latitude, newLocation.coords.longitude);
            checkAntivol(newLocation.coords.latitude, newLocation.coords.longitude);
          }
        );
      } catch (error) {
        console.error('Location error:', error);
        setIsLoading(false);
      }
    };

    startLocationTracking();

    return () => {
      locationSubscription?.remove();
    };
  }, []);

  // Fetch signals and setup socket
  useEffect(() => {
    fetchSignals();
    socketService.connect();

    const unsubNew = socketService.on('new_signal', (signal: Signal) => {
      setSignals(prev => [...prev, signal]);
    });

    const unsubUpdated = socketService.on('signal_updated', (signal: Signal) => {
      setSignals(prev => prev.map(s => s.id === signal.id ? signal : s));
    });

    const unsubDeleted = socketService.on('signal_deleted', (data: { id: string }) => {
      setSignals(prev => prev.filter(s => s.id !== data.id));
    });

    return () => {
      unsubNew();
      unsubUpdated();
      unsubDeleted();
      socketService.disconnect();
    };
  }, []);

  const fetchSignals = async () => {
    try {
      const data = await apiService.getSignals();
      setSignals(data);
    } catch (error) {
      console.error('Error fetching signals:', error);
    }
  };

  const checkProximity = useCallback((lat: number, lng: number) => {
    const now = Date.now();
    if (now - lastAlertTime < 15000) return;

    for (const signal of signals) {
      const distance = getDistance(lat, lng, signal.lat, signal.lng);
      if (distance < 500) {
        setLastAlertTime(now);
        Alert.alert(
          '⚠️ Attention !',
          `${signal.type === 'police' ? '🚓 Police' : '⚠️ Danger'} signalé à ${Math.round(distance)}m`,
          [{ text: 'OK' }]
        );
        break;
      }
    }
  }, [signals, lastAlertTime]);

  const checkAntivol = useCallback((lat: number, lng: number) => {
    if (!antivol) return;

    if (lastPos) {
      const distance = getDistance(lat, lng, lastPos.lat, lastPos.lng);
      if (distance > 20) {
        Alert.alert('🚨 ALERTE ANTIVOL', 'Mouvement détecté sur votre véhicule !');
      }
    }
    setLastPos({ lat, lng });
  }, [antivol, lastPos]);

  const getDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371000; // Earth radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const addSignal = async (type: string) => {
    if (!user) {
      Alert.alert('Connexion requise', 'Connectez-vous pour signaler', [
        { text: 'Annuler' },
        { text: 'Connexion', onPress: () => router.push('/(auth)/login') },
      ]);
      return;
    }

    if (!location) {
      Alert.alert('Erreur', 'Position non disponible');
      return;
    }

    const now = Date.now();
    if (now - lastSignalTime < 20000) {
      Alert.alert('Patience', 'Attendez 20 secondes entre chaque signalement');
      return;
    }

    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) return;

      await apiService.createSignal(
        location.coords.latitude,
        location.coords.longitude,
        type,
        token
      );
      setLastSignalTime(now);
      Alert.alert('Merci !', 'Signalement ajouté');
    } catch (error: any) {
      Alert.alert('Erreur', error.message);
    }
  };

  const voteOnSignal = async (signalId: string, voteType: 'up' | 'down') => {
    if (!user) {
      Alert.alert('Connexion requise', 'Connectez-vous pour voter');
      return;
    }

    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) return;

      await apiService.voteSignal(signalId, voteType, token);
      setSelectedSignal(null);
    } catch (error: any) {
      Alert.alert('Erreur', error.message);
    }
  };

  const toggleAntivol = () => {
    if (!antivol && location) {
      setLastPos({
        lat: location.coords.latitude,
        lng: location.coords.longitude,
      });
    }
    setAntivol(!antivol);
    Alert.alert(
      antivol ? '🔓 Antivol désactivé' : '🔐 Antivol activé',
      antivol ? '' : 'Vous serez alerté si votre véhicule bouge'
    );
  };

  const centerOnUser = () => {
    if (location && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    }
  };

  const getMarkerColor = (type: string) => {
    return type === 'police' ? '#3b82f6' : '#ef4444';
  };

  if (authLoading || isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.text }]}>Chargement...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Map */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={{
          latitude: location?.coords.latitude || 48.8566,
          longitude: location?.coords.longitude || 2.3522,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        showsUserLocation
        showsMyLocationButton={false}
        userInterfaceStyle={isDark ? 'dark' : 'light'}
      >
        {signals.map((signal) => (
          <Marker
            key={signal.id}
            coordinate={{ latitude: signal.lat, longitude: signal.lng }}
            onPress={() => setSelectedSignal(signal)}
          >
            <View style={[styles.markerContainer, { backgroundColor: getMarkerColor(signal.type) }]}>
              <Ionicons
                name={signal.type === 'police' ? 'shield' : 'warning'}
                size={20}
                color="#fff"
              />
            </View>
          </Marker>
        ))}
      </MapView>

      {/* Header */}
      <SafeAreaView style={styles.headerContainer}>
        <View style={[styles.header, { backgroundColor: colors.card }]}>
          <Text style={[styles.title, { color: colors.text }]}>Mon 50cc et moi</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Ton GPS intelligent pour scooter
          </Text>
          {user ? (
            <TouchableOpacity
              style={styles.userBadge}
              onPress={() => router.push('/(auth)/profile')}
            >
              <Ionicons name="person-circle" size={20} color={colors.primary} />
              <Text style={[styles.userName, { color: colors.primary }]}>{user.name}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.loginButton, { backgroundColor: colors.primary }]}
              onPress={() => router.push('/(auth)/login')}
            >
              <Text style={styles.loginButtonText}>Connexion</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>

      {/* Signal Info Card */}
      {selectedSignal && (
        <View style={[styles.signalCard, { backgroundColor: colors.card }]}>
          <View style={styles.signalHeader}>
            <View style={[styles.signalTypeIcon, { backgroundColor: getMarkerColor(selectedSignal.type) }]}>
              <Ionicons
                name={selectedSignal.type === 'police' ? 'shield' : 'warning'}
                size={24}
                color="#fff"
              />
            </View>
            <View style={styles.signalInfo}>
              <Text style={[styles.signalType, { color: colors.text }]}>
                {selectedSignal.type === 'police' ? '🚓 Police' : '⚠️ Danger'}
              </Text>
              <Text style={[styles.signalTime, { color: colors.textSecondary }]}>
                {new Date(selectedSignal.created_at).toLocaleTimeString('fr-FR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setSelectedSignal(null)}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <View style={styles.voteContainer}>
            <TouchableOpacity
              style={[styles.voteButton, { backgroundColor: colors.success }]}
              onPress={() => voteOnSignal(selectedSignal.id, 'up')}
            >
              <Ionicons name="thumbs-up" size={20} color="#fff" />
              <Text style={styles.voteText}>{selectedSignal.upvotes}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.voteButton, { backgroundColor: colors.primary }]}
              onPress={() => voteOnSignal(selectedSignal.id, 'down')}
            >
              <Ionicons name="thumbs-down" size={20} color="#fff" />
              <Text style={styles.voteText}>{selectedSignal.downvotes}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* FAB Buttons */}
      <View style={styles.fabContainer}>
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: colors.card }]}
          onPress={centerOnUser}
        >
          <Ionicons name="locate" size={24} color={colors.primary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.fab, styles.fabLarge, { backgroundColor: '#3b82f6' }]}
          onPress={() => addSignal('police')}
        >
          <Ionicons name="shield" size={28} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.fab, styles.fabLarge, { backgroundColor: '#ef4444' }]}
          onPress={() => addSignal('danger')}
        >
          <Ionicons name="warning" size={28} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.fab,
            { backgroundColor: antivol ? colors.success : colors.card },
          ]}
          onPress={toggleAntivol}
        >
          <Ionicons
            name={antivol ? 'lock-closed' : 'lock-open'}
            size={24}
            color={antivol ? '#fff' : colors.primary}
          />
        </TouchableOpacity>
      </View>

      {/* Antivol Status */}
      {antivol && (
        <View style={[styles.antivolBadge, { backgroundColor: colors.success }]}>
          <Ionicons name="lock-closed" size={16} color="#fff" />
          <Text style={styles.antivolText}>Mode antivol actif</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  headerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  header: {
    margin: 16,
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 4,
  },
  userBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  userName: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
  },
  loginButton: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 24,
    borderRadius: 20,
    alignSelf: 'center',
  },
  loginButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  markerContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  signalCard: {
    position: 'absolute',
    bottom: 120,
    left: 16,
    right: 16,
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  signalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  signalTypeIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  signalInfo: {
    flex: 1,
    marginLeft: 12,
  },
  signalType: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  signalTime: {
    fontSize: 14,
    marginTop: 2,
  },
  voteContainer: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 12,
  },
  voteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  voteText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  fabContainer: {
    position: 'absolute',
    bottom: 32,
    right: 16,
    gap: 12,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  fabLarge: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  antivolBadge: {
    position: 'absolute',
    bottom: 32,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    gap: 8,
  },
  antivolText: {
    color: '#fff',
    fontWeight: '600',
  },
});
