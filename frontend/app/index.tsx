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
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
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
    police: '#3b82f6',
    danger: '#ef4444',
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

  const getMarkerColor = (type: string) => {
    return type === 'police' ? colors.police : colors.danger;
  };

  const getRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'À l\'instant';
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    const diffHours = Math.floor(diffMins / 60);
    return `Il y a ${diffHours}h`;
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
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.card }]}>
        <View style={styles.headerContent}>
          <View style={[styles.logoIcon, { backgroundColor: colors.primary }]}>
            <Ionicons name="bicycle" size={24} color="#fff" />
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: colors.text }]}>Mon 50cc et moi</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Ton GPS intelligent pour scooter
            </Text>
          </View>
          {user ? (
            <TouchableOpacity
              style={styles.profileButton}
              onPress={() => router.push('/(auth)/profile')}
            >
              <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                <Text style={styles.avatarText}>{user.name.charAt(0).toUpperCase()}</Text>
              </View>
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
      </View>

      {/* Location Status */}
      <View style={[styles.locationCard, { backgroundColor: colors.card }]}>
        <View style={styles.locationIcon}>
          <Ionicons name="location" size={24} color={colors.primary} />
        </View>
        <View style={styles.locationInfo}>
          <Text style={[styles.locationTitle, { color: colors.text }]}>Votre position</Text>
          {location ? (
            <Text style={[styles.locationCoords, { color: colors.textSecondary }]}>
              {location.coords.latitude.toFixed(4)}, {location.coords.longitude.toFixed(4)}
            </Text>
          ) : (
            <Text style={[styles.locationCoords, { color: colors.textSecondary }]}>
              Recherche en cours...
            </Text>
          )}
        </View>
        {antivol && (
          <View style={[styles.antivolBadge, { backgroundColor: colors.success }]}>
            <Ionicons name="lock-closed" size={16} color="#fff" />
          </View>
        )}
      </View>

      {/* Signal Buttons */}
      <View style={styles.signalButtons}>
        <TouchableOpacity
          style={[styles.signalButton, { backgroundColor: colors.police }]}
          onPress={() => addSignal('police')}
        >
          <Ionicons name="shield" size={32} color="#fff" />
          <Text style={styles.signalButtonText}>Signaler Police</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.signalButton, { backgroundColor: colors.danger }]}
          onPress={() => addSignal('danger')}
        >
          <Ionicons name="warning" size={32} color="#fff" />
          <Text style={styles.signalButtonText}>Signaler Danger</Text>
        </TouchableOpacity>
      </View>

      {/* Antivol Toggle */}
      <TouchableOpacity
        style={[
          styles.antivolButton,
          { backgroundColor: antivol ? colors.success : colors.card },
        ]}
        onPress={toggleAntivol}
      >
        <Ionicons
          name={antivol ? 'lock-closed' : 'lock-open'}
          size={24}
          color={antivol ? '#fff' : colors.text}
        />
        <Text style={[styles.antivolButtonText, { color: antivol ? '#fff' : colors.text }]}>
          {antivol ? 'Antivol activé' : 'Activer l\'antivol'}
        </Text>
      </TouchableOpacity>

      {/* Signals List */}
      <View style={styles.signalsSection}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Signalements à proximité ({signals.length})
        </Text>
        <ScrollView style={styles.signalsList} showsVerticalScrollIndicator={false}>
          {signals.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: colors.card }]}>
              <Ionicons name="checkmark-circle" size={48} color={colors.success} />
              <Text style={[styles.emptyText, { color: colors.text }]}>
                Aucun signalement actif
              </Text>
              <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
                La route est dégagée !
              </Text>
            </View>
          ) : (
            signals.map((signal) => (
              <TouchableOpacity
                key={signal.id}
                style={[styles.signalCard, { backgroundColor: colors.card }]}
                onPress={() => setSelectedSignal(signal)}
              >
                <View style={[styles.signalIcon, { backgroundColor: getMarkerColor(signal.type) }]}>
                  <Ionicons
                    name={signal.type === 'police' ? 'shield' : 'warning'}
                    size={24}
                    color="#fff"
                  />
                </View>
                <View style={styles.signalInfo}>
                  <Text style={[styles.signalType, { color: colors.text }]}>
                    {signal.type === 'police' ? '🚓 Police' : '⚠️ Danger'}
                  </Text>
                  <Text style={[styles.signalTime, { color: colors.textSecondary }]}>
                    {getRelativeTime(signal.created_at)}
                  </Text>
                </View>
                <View style={styles.voteInfo}>
                  <View style={styles.voteItem}>
                    <Ionicons name="thumbs-up" size={16} color={colors.success} />
                    <Text style={[styles.voteCount, { color: colors.text }]}>{signal.upvotes}</Text>
                  </View>
                  <View style={styles.voteItem}>
                    <Ionicons name="thumbs-down" size={16} color={colors.danger} />
                    <Text style={[styles.voteCount, { color: colors.text }]}>{signal.downvotes}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </View>

      {/* Signal Detail Modal */}
      {selectedSignal && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <View style={[styles.modalIcon, { backgroundColor: getMarkerColor(selectedSignal.type) }]}>
                <Ionicons
                  name={selectedSignal.type === 'police' ? 'shield' : 'warning'}
                  size={32}
                  color="#fff"
                />
              </View>
              <View style={styles.modalInfo}>
                <Text style={[styles.modalType, { color: colors.text }]}>
                  {selectedSignal.type === 'police' ? '🚓 Police' : '⚠️ Danger'}
                </Text>
                <Text style={[styles.modalTime, { color: colors.textSecondary }]}>
                  {getRelativeTime(selectedSignal.created_at)}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedSignal(null)}>
                <Ionicons name="close" size={28} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            
            <Text style={[styles.modalQuestion, { color: colors.text }]}>
              Ce signalement est-il toujours valide ?
            </Text>
            
            <View style={styles.voteButtons}>
              <TouchableOpacity
                style={[styles.voteButton, { backgroundColor: colors.success }]}
                onPress={() => voteOnSignal(selectedSignal.id, 'up')}
              >
                <Ionicons name="thumbs-up" size={24} color="#fff" />
                <Text style={styles.voteButtonText}>Oui ({selectedSignal.upvotes})</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.voteButton, { backgroundColor: colors.danger }]}
                onPress={() => voteOnSignal(selectedSignal.id, 'down')}
              >
                <Ionicons name="thumbs-down" size={24} color="#fff" />
                <Text style={styles.voteButtonText}>Non ({selectedSignal.downvotes})</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
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
  header: {
    margin: 16,
    marginBottom: 8,
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    flex: 1,
    marginLeft: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  profileButton: {
    padding: 4,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  loginButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  loginButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  locationCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  locationIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(233, 69, 96, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationInfo: {
    flex: 1,
    marginLeft: 12,
  },
  locationTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  locationCoords: {
    fontSize: 12,
    marginTop: 2,
  },
  antivolBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  signalButtons: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 12,
  },
  signalButton: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  signalButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginTop: 8,
    fontSize: 14,
  },
  antivolButton: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  antivolButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  signalsSection: {
    flex: 1,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  signalsList: {
    flex: 1,
  },
  emptyCard: {
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 4,
  },
  signalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  signalIcon: {
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
    fontSize: 16,
    fontWeight: '600',
  },
  signalTime: {
    fontSize: 12,
    marginTop: 2,
  },
  voteInfo: {
    flexDirection: 'row',
    gap: 12,
  },
  voteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  voteCount: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    padding: 24,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalInfo: {
    flex: 1,
    marginLeft: 16,
  },
  modalType: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalTime: {
    fontSize: 14,
    marginTop: 4,
  },
  modalQuestion: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  voteButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  voteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 16,
    gap: 8,
  },
  voteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
