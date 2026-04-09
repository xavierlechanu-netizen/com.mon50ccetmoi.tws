import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useColorScheme,
  Alert,
  ActivityIndicator,
  ScrollView,
  Modal,
  TextInput,
  Platform,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../src/contexts/AuthContext';
import { apiService } from '../src/services/api';
import { socketService } from '../src/services/socket';

// Conditional import for maps
let MapView: any = null;
let Marker: any = null;
let PROVIDER_GOOGLE: any = null;

try {
  const maps = require('react-native-maps');
  MapView = maps.default;
  Marker = maps.Marker;
  PROVIDER_GOOGLE = maps.PROVIDER_GOOGLE;
} catch (e) {
  console.log('Maps not available on this platform');
}

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

// Types de signalements
const SIGNAL_TYPES: { [key: string]: { icon: string; label: string; color: string; emoji: string } } = {
  police: { icon: 'shield', label: 'Police', color: '#3b82f6', emoji: '🚓' },
  danger: { icon: 'warning', label: 'Danger', color: '#ef4444', emoji: '⚠️' },
  tunnel: { icon: 'remove-circle', label: 'Tunnel interdit', color: '#8b5cf6', emoji: '🚧' },
  speed_limit: { icon: 'speedometer', label: 'Vitesse > 50km/h', color: '#f97316', emoji: '🚫' },
  parking: { icon: 'navigate', label: 'Parking 50cc', color: '#10b981', emoji: '🅿️' },
};

const { width, height } = Dimensions.get('window');

export default function MapScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { user, isLoading: authLoading } = useAuth();
  const mapRef = useRef<any>(null);
  
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [antivol, setAntivol] = useState(false);
  const [lastPos, setLastPos] = useState<{ lat: number; lng: number } | null>(null);
  const [lastSignalTime, setLastSignalTime] = useState<number>(0);
  const [lastAlertTime, setLastAlertTime] = useState<number>(0);
  const [selectedSignal, setSelectedSignal] = useState<Signal | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [newSignalType, setNewSignalType] = useState<string | null>(null);
  const [newSignalDescription, setNewSignalDescription] = useState('');
  const [mapReady, setMapReady] = useState(false);

  const colors = {
    background: isDark ? '#1a1a2e' : '#f5f5f5',
    card: isDark ? 'rgba(22, 33, 62, 0.95)' : 'rgba(255, 255, 255, 0.95)',
    text: isDark ? '#ffffff' : '#1a1a2e',
    textSecondary: isDark ? '#a0a0a0' : '#666666',
    primary: '#e94560',
    success: '#4ade80',
    warning: '#fbbf24',
    police: '#3b82f6',
    danger: '#ef4444',
    tunnel: '#8b5cf6',
    speed_limit: '#f97316',
    info: '#3b82f6',
    parking: '#10b981',
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

        const currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        setLocation(currentLocation);
        setIsLoading(false);

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
    return () => { locationSubscription?.remove(); };
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
        const signalInfo = SIGNAL_TYPES[signal.type];
        const isForbidden = signal.type === 'tunnel' || signal.type === 'speed_limit';
        
        Alert.alert(
          isForbidden ? '🚫 ROUTE INTERDITE AUX 50cc !' : '⚠️ Attention !',
          `${signalInfo?.emoji || '⚠️'} ${signalInfo?.label || signal.type} à ${Math.round(distance)}m${signal.description ? `\n${signal.description}` : ''}`,
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
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const addSignal = async (type: string, description?: string) => {
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
        token,
        description
      );
      setLastSignalTime(now);
      setShowAddModal(false);
      setNewSignalType(null);
      setNewSignalDescription('');
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
      }, 500);
    }
  };

  const getMarkerColor = (type: string) => {
    return SIGNAL_TYPES[type]?.color || colors.danger;
  };

  if (authLoading || isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.text }]}>Chargement...</Text>
      </View>
    );
  }

  // Fallback for web or when maps not available
  const renderMapFallback = () => (
    <View style={[styles.mapFallback, { backgroundColor: isDark ? '#0f1729' : '#e5e7eb' }]}>
      <View style={styles.mapFallbackContent}>
        <Ionicons name="location" size={48} color={colors.primary} />
        <Text style={[styles.mapFallbackText, { color: colors.text }]}>
          {location ? `${location.coords.latitude.toFixed(4)}, ${location.coords.longitude.toFixed(4)}` : 'Position en cours...'}
        </Text>
        <Text style={[styles.mapFallbackSubtext, { color: colors.textSecondary }]}>
          {signals.length} signalements actifs
        </Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Full Screen Map */}
      {MapView && Platform.OS !== 'web' ? (
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
          onMapReady={() => setMapReady(true)}
        >
          {signals.map((signal) => (
            <Marker
              key={signal.id}
              coordinate={{ latitude: signal.lat, longitude: signal.lng }}
              onPress={() => setSelectedSignal(signal)}
            >
              <View style={[styles.markerContainer, { backgroundColor: getMarkerColor(signal.type) }]}>
                <Ionicons
                  name={SIGNAL_TYPES[signal.type]?.icon as any || 'warning'}
                  size={18}
                  color="#fff"
                />
              </View>
            </Marker>
          ))}
        </MapView>
      ) : (
        renderMapFallback()
      )}

      {/* Header Overlay */}
      <SafeAreaView style={styles.headerOverlay} edges={['top']}>
        <View style={[styles.header, { backgroundColor: colors.card }]}>
          <TouchableOpacity onPress={() => setShowMenuModal(true)}>
            <Ionicons name="menu" size={28} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={[styles.title, { color: colors.text }]}>Mon 50cc et moi</Text>
          </View>
          {user ? (
            <TouchableOpacity onPress={() => router.push('/(auth)/profile')}>
              <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                <Text style={styles.avatarText}>{user.name.charAt(0).toUpperCase()}</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
              <Ionicons name="person-circle" size={32} color={colors.primary} />
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>

      {/* Quick Actions - Left Side */}
      <View style={styles.leftActions}>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: colors.card }]}
          onPress={centerOnUser}
        >
          <Ionicons name="locate" size={24} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: antivol ? colors.success : colors.card }]}
          onPress={toggleAntivol}
        >
          <Ionicons name={antivol ? 'lock-closed' : 'lock-open'} size={24} color={antivol ? '#fff' : colors.text} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: colors.card }]}
          onPress={() => setShowInfoModal(true)}
        >
          <Ionicons name="information-circle" size={24} color={colors.info} />
        </TouchableOpacity>
      </View>

      {/* Signal Buttons - Bottom */}
      <View style={styles.bottomActions}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.signalButtons}>
          <TouchableOpacity
            style={[styles.signalBtn, { backgroundColor: colors.police }]}
            onPress={() => addSignal('police')}
          >
            <Ionicons name="shield" size={24} color="#fff" />
            <Text style={styles.signalBtnText}>Police</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.signalBtn, { backgroundColor: colors.danger }]}
            onPress={() => addSignal('danger')}
          >
            <Ionicons name="warning" size={24} color="#fff" />
            <Text style={styles.signalBtnText}>Danger</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.signalBtn, { backgroundColor: colors.tunnel }]}
            onPress={() => { setNewSignalType('tunnel'); setShowAddModal(true); }}
          >
            <Ionicons name="remove-circle" size={24} color="#fff" />
            <Text style={styles.signalBtnText}>Tunnel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.signalBtn, { backgroundColor: colors.speed_limit }]}
            onPress={() => { setNewSignalType('speed_limit'); setShowAddModal(true); }}
          >
            <Ionicons name="speedometer" size={24} color="#fff" />
            <Text style={styles.signalBtnText}>Vitesse</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.signalBtn, { backgroundColor: colors.parking }]}
            onPress={() => router.push('/parking')}
          >
            <Ionicons name="navigate" size={24} color="#fff" />
            <Text style={styles.signalBtnText}>Parking</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Stats Bar */}
        <View style={[styles.statsBar, { backgroundColor: colors.card }]}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.primary }]}>{signals.filter(s => s.type === 'police' || s.type === 'danger').length}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Alertes</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.warning }]}>{signals.filter(s => s.type === 'tunnel' || s.type === 'speed_limit').length}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Interdits</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.success }]}>{antivol ? 'ON' : 'OFF'}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Antivol</Text>
          </View>
        </View>
      </View>

      {/* Menu Modal */}
      <Modal visible={showMenuModal} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowMenuModal(false)}>
          <View style={[styles.menuCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.menuTitle, { color: colors.text }]}>Menu</Text>
            
            <TouchableOpacity style={styles.menuItem} onPress={() => { setShowMenuModal(false); router.push('/itineraire'); }}>
              <View style={[styles.menuIcon, { backgroundColor: colors.primary + '20' }]}>
                <Ionicons name="map" size={24} color={colors.primary} />
              </View>
              <View style={styles.menuItemText}>
                <Text style={[styles.menuItemTitle, { color: colors.text }]}>Planificateur</Text>
                <Text style={[styles.menuItemDesc, { color: colors.textSecondary }]}>Itinéraire Rapide ou Balade</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={() => { setShowMenuModal(false); router.push('/garage'); }}>
              <View style={[styles.menuIcon, { backgroundColor: colors.warning + '20' }]}>
                <Ionicons name="construct" size={24} color={colors.warning} />
              </View>
              <View style={styles.menuItemText}>
                <Text style={[styles.menuItemTitle, { color: colors.text }]}>Mon Garage</Text>
                <Text style={[styles.menuItemDesc, { color: colors.textSecondary }]}>Conseils et entretien</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={() => { setShowMenuModal(false); router.push('/insurance'); }}>
              <View style={[styles.menuIcon, { backgroundColor: colors.info + '20' }]}>
                <Ionicons name="shield-checkmark" size={24} color={colors.info} />
              </View>
              <View style={styles.menuItemText}>
                <Text style={[styles.menuItemTitle, { color: colors.text }]}>Assurance</Text>
                <Text style={[styles.menuItemDesc, { color: colors.textSecondary }]}>Comparateur + Courtier</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={() => { setShowMenuModal(false); router.push('/parking'); }}>
              <View style={[styles.menuIcon, { backgroundColor: colors.success + '20' }]}>
                <Ionicons name="navigate" size={24} color={colors.success} />
              </View>
              <View style={styles.menuItemText}>
                <Text style={[styles.menuItemTitle, { color: colors.text }]}>Parkings</Text>
                <Text style={[styles.menuItemDesc, { color: colors.textSecondary }]}>Places gratuites 50cc</Text>
              </View>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Add Signal Modal */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {newSignalType === 'tunnel' ? '🚧 Tunnel interdit' : '🚫 Route vitesse > 50km/h'}
              </Text>
              <TouchableOpacity onPress={() => { setShowAddModal(false); setNewSignalType(null); setNewSignalDescription(''); }}>
                <Ionicons name="close" size={28} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            
            <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>Description (optionnel)</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.textSecondary }]}
              placeholder="Ex: Tunnel de la Croix-Rousse..."
              placeholderTextColor={colors.textSecondary}
              value={newSignalDescription}
              onChangeText={setNewSignalDescription}
              multiline
            />
            
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: getMarkerColor(newSignalType || '') }]}
              onPress={() => newSignalType && addSignal(newSignalType, newSignalDescription || undefined)}
            >
              <Text style={styles.modalButtonText}>Signaler cette route</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Info Modal */}
      <Modal visible={showInfoModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>📋 Règles 50cc</Text>
              <TouchableOpacity onPress={() => setShowInfoModal(false)}>
                <Ionicons name="close" size={28} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.infoContent}>
              <View style={[styles.infoItem, { backgroundColor: colors.tunnel + '10' }]}>
                <Ionicons name="remove-circle" size={24} color={colors.tunnel} />
                <Text style={[styles.infoText, { color: colors.text }]}>
                  🚧 Certains tunnels sont interdits aux 50cc
                </Text>
              </View>
              <View style={[styles.infoItem, { backgroundColor: colors.speed_limit + '10' }]}>
                <Ionicons name="speedometer" size={24} color={colors.speed_limit} />
                <Text style={[styles.infoText, { color: colors.text }]}>
                  🚫 Routes avec vitesse min. > 50 km/h interdites
                </Text>
              </View>
              <View style={[styles.infoItem, { backgroundColor: colors.danger + '10' }]}>
                <Ionicons name="alert-circle" size={24} color={colors.danger} />
                <Text style={[styles.infoText, { color: colors.text }]}>
                  ⛔ Autoroutes et voies express TOUJOURS interdites !
                </Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Signal Detail Modal */}
      {selectedSignal && (
        <Modal visible={true} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
              <View style={styles.modalHeader}>
                <View style={[styles.signalDetailIcon, { backgroundColor: getMarkerColor(selectedSignal.type) }]}>
                  <Ionicons
                    name={SIGNAL_TYPES[selectedSignal.type]?.icon as any || 'warning'}
                    size={28}
                    color="#fff"
                  />
                </View>
                <View style={styles.signalDetailInfo}>
                  <Text style={[styles.signalDetailType, { color: colors.text }]}>
                    {SIGNAL_TYPES[selectedSignal.type]?.emoji} {SIGNAL_TYPES[selectedSignal.type]?.label}
                  </Text>
                  <Text style={[styles.signalDetailTime, { color: colors.textSecondary }]}>
                    {new Date(selectedSignal.created_at).toLocaleTimeString('fr-FR')}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setSelectedSignal(null)}>
                  <Ionicons name="close" size={28} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              
              {selectedSignal.description && (
                <Text style={[styles.signalDescription, { color: colors.text }]}>
                  {selectedSignal.description}
                </Text>
              )}
              
              <Text style={[styles.voteQuestion, { color: colors.text }]}>
                Ce signalement est-il toujours valide ?
              </Text>
              
              <View style={styles.voteButtons}>
                <TouchableOpacity
                  style={[styles.voteBtn, { backgroundColor: colors.success }]}
                  onPress={() => voteOnSignal(selectedSignal.id, 'up')}
                >
                  <Ionicons name="thumbs-up" size={20} color="#fff" />
                  <Text style={styles.voteBtnText}>Oui ({selectedSignal.upvotes})</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.voteBtn, { backgroundColor: colors.danger }]}
                  onPress={() => voteOnSignal(selectedSignal.id, 'down')}
                >
                  <Ionicons name="thumbs-down" size={20} color="#fff" />
                  <Text style={styles.voteBtnText}>Non ({selectedSignal.downvotes})</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 16, fontSize: 16 },
  map: { ...StyleSheet.absoluteFillObject },
  mapFallback: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  mapFallbackContent: { alignItems: 'center' },
  mapFallbackText: { fontSize: 18, fontWeight: 'bold', marginTop: 16 },
  mapFallbackSubtext: { fontSize: 14, marginTop: 8 },
  headerOverlay: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', margin: 16, padding: 12, borderRadius: 16 },
  headerCenter: { flex: 1, alignItems: 'center' },
  title: { fontSize: 18, fontWeight: 'bold' },
  avatar: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  leftActions: { position: 'absolute', left: 16, top: '40%', gap: 12, zIndex: 10 },
  actionBtn: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 4 },
  bottomActions: { position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10 },
  signalButtons: { paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
  signalBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 24, gap: 8 },
  signalBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  statsBar: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', marginHorizontal: 16, marginBottom: 24, padding: 12, borderRadius: 16 },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: 'bold' },
  statLabel: { fontSize: 11, marginTop: 2 },
  statDivider: { width: 1, height: 30, backgroundColor: 'rgba(0,0,0,0.1)' },
  markerContainer: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#fff' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '70%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  modalTitle: { flex: 1, fontSize: 20, fontWeight: 'bold' },
  modalLabel: { fontSize: 14, marginBottom: 8 },
  modalInput: { borderWidth: 1, borderRadius: 12, padding: 16, fontSize: 16, minHeight: 80, textAlignVertical: 'top', marginBottom: 16 },
  modalButton: { padding: 16, borderRadius: 12, alignItems: 'center' },
  modalButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  menuCard: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  menuTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
  menuIcon: { width: 48, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  menuItemText: { flex: 1, marginLeft: 16 },
  menuItemTitle: { fontSize: 16, fontWeight: '600' },
  menuItemDesc: { fontSize: 13, marginTop: 2 },
  infoContent: { maxHeight: 300 },
  infoItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 12, marginBottom: 12, gap: 12 },
  infoText: { flex: 1, fontSize: 14 },
  signalDetailIcon: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  signalDetailInfo: { flex: 1, marginLeft: 12 },
  signalDetailType: { fontSize: 18, fontWeight: 'bold' },
  signalDetailTime: { fontSize: 14, marginTop: 4 },
  signalDescription: { fontSize: 14, padding: 12, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 8, marginBottom: 16 },
  voteQuestion: { fontSize: 16, textAlign: 'center', marginBottom: 16 },
  voteButtons: { flexDirection: 'row', gap: 12 },
  voteBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 12, gap: 8 },
  voteBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
