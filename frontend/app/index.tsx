import React, { useEffect, useState, useCallback } from 'react';
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
  description?: string;
  upvotes: number;
  downvotes: number;
  user_id: string;
  created_at: string;
}

// Types de signalements
const SIGNAL_TYPES = {
  police: { icon: 'shield', label: 'Police', color: '#3b82f6', emoji: '🚓' },
  danger: { icon: 'warning', label: 'Danger', color: '#ef4444', emoji: '⚠️' },
  tunnel: { icon: 'remove-circle', label: 'Tunnel interdit', color: '#8b5cf6', emoji: '🚧' },
  speed_limit: { icon: 'speedometer', label: 'Vitesse > 50km/h', color: '#f97316', emoji: '🚫' },
};

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
  const [showAddModal, setShowAddModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [newSignalType, setNewSignalType] = useState<string | null>(null);
  const [newSignalDescription, setNewSignalDescription] = useState('');
  const [activeTab, setActiveTab] = useState<'alerts' | 'forbidden'>('alerts');

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
    tunnel: '#8b5cf6',
    speed_limit: '#f97316',
    info: '#3b82f6',
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
        const signalInfo = SIGNAL_TYPES[signal.type as keyof typeof SIGNAL_TYPES];
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

  const getSignalColor = (type: string) => {
    return SIGNAL_TYPES[type as keyof typeof SIGNAL_TYPES]?.color || colors.danger;
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

  // Filtrer les signalements par catégorie
  const alertSignals = signals.filter(s => s.type === 'police' || s.type === 'danger');
  const forbiddenSignals = signals.filter(s => s.type === 'tunnel' || s.type === 'speed_limit');

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
          <TouchableOpacity
            style={[styles.garageButton, { backgroundColor: colors.warning }]}
            onPress={() => router.push('/garage')}
          >
            <Ionicons name="construct" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.insuranceButton, { backgroundColor: colors.info }]}
            onPress={() => router.push('/insurance')}
          >
            <Ionicons name="shield-checkmark" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.parkingButton, { backgroundColor: colors.success }]}
            onPress={() => router.push('/parking')}
          >
            <Ionicons name="navigate" size={20} color="#fff" />
          </TouchableOpacity>
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
        <TouchableOpacity onPress={() => setShowInfoModal(true)}>
          <Ionicons name="information-circle" size={28} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Signal Buttons */}
      <View style={styles.signalButtonsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.signalButtons}>
          <TouchableOpacity
            style={[styles.signalButton, { backgroundColor: colors.police }]}
            onPress={() => addSignal('police')}
          >
            <Ionicons name="shield" size={24} color="#fff" />
            <Text style={styles.signalButtonText}>Police</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.signalButton, { backgroundColor: colors.danger }]}
            onPress={() => addSignal('danger')}
          >
            <Ionicons name="warning" size={24} color="#fff" />
            <Text style={styles.signalButtonText}>Danger</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.signalButton, { backgroundColor: colors.tunnel }]}
            onPress={() => { setNewSignalType('tunnel'); setShowAddModal(true); }}
          >
            <Ionicons name="remove-circle" size={24} color="#fff" />
            <Text style={styles.signalButtonText}>Tunnel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.signalButton, { backgroundColor: colors.speed_limit }]}
            onPress={() => { setNewSignalType('speed_limit'); setShowAddModal(true); }}
          >
            <Ionicons name="speedometer" size={24} color="#fff" />
            <Text style={styles.signalButtonText}>Vitesse</Text>
          </TouchableOpacity>
        </ScrollView>
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

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'alerts' && { backgroundColor: colors.primary }]}
          onPress={() => setActiveTab('alerts')}
        >
          <Text style={[styles.tabText, { color: activeTab === 'alerts' ? '#fff' : colors.text }]}>
            🚨 Alertes ({alertSignals.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'forbidden' && { backgroundColor: colors.primary }]}
          onPress={() => setActiveTab('forbidden')}
        >
          <Text style={[styles.tabText, { color: activeTab === 'forbidden' ? '#fff' : colors.text }]}>
            🚫 Interdits 50cc ({forbiddenSignals.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Signals List */}
      <ScrollView style={styles.signalsList} showsVerticalScrollIndicator={false}>
        {(activeTab === 'alerts' ? alertSignals : forbiddenSignals).length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.card }]}>
            <Ionicons name="checkmark-circle" size={48} color={colors.success} />
            <Text style={[styles.emptyText, { color: colors.text }]}>
              {activeTab === 'alerts' ? 'Aucune alerte active' : 'Aucune route interdite signalée'}
            </Text>
            <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
              {activeTab === 'alerts' ? 'La route est dégagée !' : 'Signalez les routes interdites aux 50cc'}
            </Text>
          </View>
        ) : (
          (activeTab === 'alerts' ? alertSignals : forbiddenSignals).map((signal) => (
            <TouchableOpacity
              key={signal.id}
              style={[styles.signalCard, { backgroundColor: colors.card }]}
              onPress={() => setSelectedSignal(signal)}
            >
              <View style={[styles.signalIcon, { backgroundColor: getSignalColor(signal.type) }]}>
                <Ionicons
                  name={SIGNAL_TYPES[signal.type as keyof typeof SIGNAL_TYPES]?.icon as any || 'warning'}
                  size={24}
                  color="#fff"
                />
              </View>
              <View style={styles.signalInfo}>
                <Text style={[styles.signalType, { color: colors.text }]}>
                  {SIGNAL_TYPES[signal.type as keyof typeof SIGNAL_TYPES]?.emoji || '⚠️'}{' '}
                  {SIGNAL_TYPES[signal.type as keyof typeof SIGNAL_TYPES]?.label || signal.type}
                </Text>
                {signal.description && (
                  <Text style={[styles.signalDescription, { color: colors.textSecondary }]} numberOfLines={1}>
                    {signal.description}
                  </Text>
                )}
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
            
            <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>
              Description (optionnel)
            </Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.textSecondary }]}
              placeholder="Ex: Tunnel de la Croix-Rousse..."
              placeholderTextColor={colors.textSecondary}
              value={newSignalDescription}
              onChangeText={setNewSignalDescription}
              multiline
            />
            
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: getSignalColor(newSignalType || '') }]}
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
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                📋 Règles pour les 50cc
              </Text>
              <TouchableOpacity onPress={() => setShowInfoModal(false)}>
                <Ionicons name="close" size={28} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.infoContent}>
              <View style={[styles.infoItem, { borderColor: colors.tunnel }]}>
                <View style={[styles.infoIcon, { backgroundColor: colors.tunnel }]}>
                  <Ionicons name="remove-circle" size={24} color="#fff" />
                </View>
                <View style={styles.infoText}>
                  <Text style={[styles.infoTitle, { color: colors.text }]}>🚧 Tunnels interdits</Text>
                  <Text style={[styles.infoDescription, { color: colors.textSecondary }]}>
                    Certains tunnels sont interdits aux cyclomoteurs et scooters 50cc pour des raisons de sécurité.
                  </Text>
                </View>
              </View>
              
              <View style={[styles.infoItem, { borderColor: colors.speed_limit }]}>
                <View style={[styles.infoIcon, { backgroundColor: colors.speed_limit }]}>
                  <Ionicons name="speedometer" size={24} color="#fff" />
                </View>
                <View style={styles.infoText}>
                  <Text style={[styles.infoTitle, { color: colors.text }]}>🚫 Routes à vitesse min. > 50 km/h</Text>
                  <Text style={[styles.infoDescription, { color: colors.textSecondary }]}>
                    Les voies rapides, périphériques et routes avec vitesse minimale supérieure à 50 km/h sont interdites aux 50cc.
                  </Text>
                </View>
              </View>
              
              <View style={[styles.warningBox, { backgroundColor: colors.warning + '20', borderColor: colors.warning }]}>
                <Ionicons name="alert-circle" size={24} color={colors.warning} />
                <Text style={[styles.warningText, { color: colors.text }]}>
                  Les autoroutes et voies express sont TOUJOURS interdites aux 50cc !
                </Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Signal Detail Modal */}
      {selectedSignal && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <View style={[styles.modalIcon, { backgroundColor: getSignalColor(selectedSignal.type) }]}>
                <Ionicons
                  name={SIGNAL_TYPES[selectedSignal.type as keyof typeof SIGNAL_TYPES]?.icon as any || 'warning'}
                  size={32}
                  color="#fff"
                />
              </View>
              <View style={styles.modalInfo}>
                <Text style={[styles.modalType, { color: colors.text }]}>
                  {SIGNAL_TYPES[selectedSignal.type as keyof typeof SIGNAL_TYPES]?.emoji || '⚠️'}{' '}
                  {SIGNAL_TYPES[selectedSignal.type as keyof typeof SIGNAL_TYPES]?.label || selectedSignal.type}
                </Text>
                <Text style={[styles.modalTime, { color: colors.textSecondary }]}>
                  {getRelativeTime(selectedSignal.created_at)}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedSignal(null)}>
                <Ionicons name="close" size={28} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            
            {selectedSignal.description && (
              <Text style={[styles.detailDescription, { color: colors.text }]}>
                {selectedSignal.description}
              </Text>
            )}
            
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
  garageButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  insuranceButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  parkingButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
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
    marginBottom: 12,
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
  signalButtonsContainer: {
    marginBottom: 12,
  },
  signalButtons: {
    paddingHorizontal: 16,
    gap: 10,
  },
  signalButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  signalButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  antivolButton: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 14,
    borderRadius: 12,
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
  tabsContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  signalsList: {
    flex: 1,
    paddingHorizontal: 16,
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
    textAlign: 'center',
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
    fontSize: 15,
    fontWeight: '600',
  },
  signalDescription: {
    fontSize: 12,
    marginTop: 2,
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
    maxHeight: '80%',
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
  modalTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: 'bold',
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
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalTime: {
    fontSize: 14,
    marginTop: 4,
  },
  modalLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  modalButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  detailDescription: {
    fontSize: 14,
    marginBottom: 16,
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 8,
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
  infoContent: {
    maxHeight: 400,
  },
  infoItem: {
    flexDirection: 'row',
    marginBottom: 16,
    padding: 12,
    borderLeftWidth: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  infoIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoText: {
    flex: 1,
    marginLeft: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  infoDescription: {
    fontSize: 14,
    marginTop: 4,
    lineHeight: 20,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
    marginTop: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
});
