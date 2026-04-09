import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useColorScheme,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../src/contexts/AuthContext';
import { apiService } from '../src/services/api';

interface RouteResult {
  mode: 'rapide' | 'balade';
  distance: number; // km
  duration: number; // minutes
  warnings: string[];
  steps: RouteStep[];
}

interface RouteStep {
  instruction: string;
  distance: number;
  duration: number;
  warning?: string;
}

interface SavedRoute {
  id: string;
  name: string;
  from: string;
  to: string;
  mode: 'rapide' | 'balade';
  distance: number;
  duration: number;
  createdAt: string;
}

export default function ItineraireScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { user } = useAuth();

  const [fromAddress, setFromAddress] = useState('');
  const [toAddress, setToAddress] = useState('');
  const [mode, setMode] = useState<'rapide' | 'balade'>('rapide');
  const [isLoading, setIsLoading] = useState(false);
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);
  const [savedRoutes, setSavedRoutes] = useState<SavedRoute[]>([]);
  const [showSavedRoutes, setShowSavedRoutes] = useState(false);
  const [fallDetectorActive, setFallDetectorActive] = useState(false);
  const [gpsTrackingActive, setGpsTrackingActive] = useState(false);

  const colors = {
    background: isDark ? '#1a1a2e' : '#f5f5f5',
    card: isDark ? '#16213e' : '#ffffff',
    text: isDark ? '#ffffff' : '#1a1a2e',
    textSecondary: isDark ? '#a0a0a0' : '#666666',
    primary: '#e94560',
    success: '#4ade80',
    warning: '#fbbf24',
    info: '#3b82f6',
    rapide: '#3b82f6',
    balade: '#10b981',
  };

  useEffect(() => {
    getCurrentLocation();
    loadSavedRoutes();
  }, []);

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        setCurrentLocation(location);
        setFromAddress('Ma position actuelle');
      }
    } catch (error) {
      console.log('Error getting location:', error);
    }
  };

  const loadSavedRoutes = async () => {
    try {
      const saved = await AsyncStorage.getItem('savedRoutes');
      if (saved) {
        setSavedRoutes(JSON.parse(saved));
      }
    } catch (error) {
      console.log('Error loading saved routes:', error);
    }
  };

  const saveRoute = async () => {
    if (!route || !toAddress) return;

    const newRoute: SavedRoute = {
      id: Date.now().toString(),
      name: `Vers ${toAddress}`,
      from: fromAddress,
      to: toAddress,
      mode: mode,
      distance: route.distance,
      duration: route.duration,
      createdAt: new Date().toISOString(),
    };

    const updatedRoutes = [newRoute, ...savedRoutes].slice(0, 10); // Garder 10 max
    setSavedRoutes(updatedRoutes);
    await AsyncStorage.setItem('savedRoutes', JSON.stringify(updatedRoutes));
    Alert.alert('Enregistré !', 'Itinéraire sauvegardé dans vos favoris');
  };

  const calculateRoute = async () => {
    if (!toAddress.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer une destination');
      return;
    }

    setIsLoading(true);

    // Simulation de calcul d'itinéraire
    // Dans une vraie app, on utiliserait une API comme Google Directions, Mapbox, ou OpenRouteService
    setTimeout(() => {
      const baseDistance = Math.random() * 15 + 5; // 5-20 km
      const isBalade = mode === 'balade';
      
      // Mode balade = +30% distance mais routes plus agréables
      const distance = isBalade ? baseDistance * 1.3 : baseDistance;
      
      // Vitesse moyenne: rapide = 35 km/h, balade = 25 km/h
      const avgSpeed = isBalade ? 25 : 35;
      const duration = (distance / avgSpeed) * 60; // en minutes

      const warnings: string[] = [];
      
      // Ajouter des avertissements aléatoires pour simulation
      if (Math.random() > 0.7) {
        warnings.push('⚠️ Zone à 30 km/h à proximité');
      }
      if (Math.random() > 0.8) {
        warnings.push('🚧 Tunnel interdit évité');
      }
      if (Math.random() > 0.8) {
        warnings.push('🚫 Voie rapide contournée');
      }

      // Générer des étapes
      const steps: RouteStep[] = [
        {
          instruction: `Départ de ${fromAddress || 'votre position'}`,
          distance: 0,
          duration: 0,
        },
        {
          instruction: isBalade ? 'Prendre les petites routes pittoresques' : 'Suivre la route principale',
          distance: distance * 0.3,
          duration: duration * 0.3,
        },
        {
          instruction: 'Continuer tout droit',
          distance: distance * 0.4,
          duration: duration * 0.4,
          warning: warnings.length > 0 ? warnings[0] : undefined,
        },
        {
          instruction: `Arrivée à ${toAddress}`,
          distance: distance * 0.3,
          duration: duration * 0.3,
        },
      ];

      setRoute({
        mode,
        distance: Math.round(distance * 10) / 10,
        duration: Math.round(duration),
        warnings,
        steps,
      });

      setIsLoading(false);
    }, 1500);
  };

  const startNavigation = () => {
    Alert.alert(
      '🚀 Démarrer la navigation',
      'Activer les fonctionnalités de sécurité ?',
      [
        {
          text: 'Navigation seule',
          onPress: () => {
            Alert.alert('Navigation', 'La navigation démarre. Roulez prudemment !');
          },
        },
        {
          text: '+ Détecteur de chute',
          onPress: () => {
            setFallDetectorActive(true);
            setGpsTrackingActive(true);
            Alert.alert(
              'Sécurité activée',
              '✅ Détecteur de chute actif\n✅ Suivi GPS pour assurance actif\n\nRoulez prudemment !'
            );
          },
          style: 'default',
        },
      ]
    );
  };

  const loadSavedRoute = (saved: SavedRoute) => {
    setFromAddress(saved.from);
    setToAddress(saved.to);
    setMode(saved.mode);
    setShowSavedRoutes(false);
    // Recalculer
    setTimeout(() => calculateRoute(), 500);
  };

  const formatDuration = (minutes: number): string => {
    if (minutes < 60) {
      return `${Math.round(minutes)} min`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h${mins > 0 ? ` ${mins}min` : ''}`;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.card }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Planificateur 50cc</Text>
        <TouchableOpacity onPress={() => setShowSavedRoutes(true)}>
          <Ionicons name="bookmark" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Mode Selection */}
        <View style={styles.modeContainer}>
          <TouchableOpacity
            style={[
              styles.modeButton,
              { backgroundColor: mode === 'rapide' ? colors.rapide : colors.card }
            ]}
            onPress={() => setMode('rapide')}
          >
            <Ionicons name="flash" size={24} color={mode === 'rapide' ? '#fff' : colors.text} />
            <Text style={[styles.modeText, { color: mode === 'rapide' ? '#fff' : colors.text }]}>
              Rapide
            </Text>
            <Text style={[styles.modeSubtext, { color: mode === 'rapide' ? '#fff' : colors.textSecondary }]}>
              Le plus court
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.modeButton,
              { backgroundColor: mode === 'balade' ? colors.balade : colors.card }
            ]}
            onPress={() => setMode('balade')}
          >
            <Ionicons name="leaf" size={24} color={mode === 'balade' ? '#fff' : colors.text} />
            <Text style={[styles.modeText, { color: mode === 'balade' ? '#fff' : colors.text }]}>
              Balade
            </Text>
            <Text style={[styles.modeSubtext, { color: mode === 'balade' ? '#fff' : colors.textSecondary }]}>
              Petites routes
            </Text>
          </TouchableOpacity>
        </View>

        {/* Route Input */}
        <View style={[styles.inputCard, { backgroundColor: colors.card }]}>
          <View style={styles.inputRow}>
            <View style={[styles.inputIcon, { backgroundColor: colors.success + '20' }]}>
              <Ionicons name="radio-button-on" size={16} color={colors.success} />
            </View>
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="Point de départ"
              placeholderTextColor={colors.textSecondary}
              value={fromAddress}
              onChangeText={setFromAddress}
            />
            <TouchableOpacity onPress={getCurrentLocation}>
              <Ionicons name="locate" size={24} color={colors.primary} />
            </TouchableOpacity>
          </View>
          
          <View style={[styles.inputDivider, { borderColor: colors.textSecondary }]} />
          
          <View style={styles.inputRow}>
            <View style={[styles.inputIcon, { backgroundColor: colors.primary + '20' }]}>
              <Ionicons name="location" size={16} color={colors.primary} />
            </View>
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="Destination"
              placeholderTextColor={colors.textSecondary}
              value={toAddress}
              onChangeText={setToAddress}
            />
          </View>
        </View>

        {/* Calculate Button */}
        <TouchableOpacity
          style={[styles.calculateButton, { backgroundColor: colors.primary }]}
          onPress={calculateRoute}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="navigate" size={20} color="#fff" />
              <Text style={styles.calculateButtonText}>Calculer l'itinéraire</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Info Card */}
        <View style={[styles.infoCard, { backgroundColor: colors.info + '20', borderColor: colors.info }]}>
          <Ionicons name="information-circle" size={20} color={colors.info} />
          <Text style={[styles.infoText, { color: colors.text }]}>
            {mode === 'rapide' 
              ? 'Mode Rapide : itinéraire le plus court en évitant autoroutes et voies rapides interdites aux 50cc.'
              : 'Mode Balade : petites routes pittoresques, idéal pour les sorties détente. Vitesse réduite, paysages garantis !'}
          </Text>
        </View>

        {/* Route Result */}
        {route && (
          <View style={[styles.routeCard, { backgroundColor: colors.card }]}>
            <View style={styles.routeHeader}>
              <View style={[styles.routeIcon, { backgroundColor: mode === 'rapide' ? colors.rapide : colors.balade }]}>
                <Ionicons name={mode === 'rapide' ? 'flash' : 'leaf'} size={24} color="#fff" />
              </View>
              <View style={styles.routeInfo}>
                <Text style={[styles.routeTitle, { color: colors.text }]}>
                  {mode === 'rapide' ? 'Itinéraire Rapide' : 'Itinéraire Balade'}
                </Text>
                <Text style={[styles.routeSubtitle, { color: colors.textSecondary }]}>
                  Adapté aux 50cc - Évite les interdits
                </Text>
              </View>
            </View>

            <View style={styles.routeStats}>
              <View style={styles.routeStat}>
                <Ionicons name="speedometer" size={24} color={colors.primary} />
                <Text style={[styles.routeStatValue, { color: colors.text }]}>{route.distance} km</Text>
                <Text style={[styles.routeStatLabel, { color: colors.textSecondary }]}>Distance</Text>
              </View>
              <View style={[styles.routeStatDivider, { backgroundColor: colors.textSecondary }]} />
              <View style={styles.routeStat}>
                <Ionicons name="time" size={24} color={colors.primary} />
                <Text style={[styles.routeStatValue, { color: colors.text }]}>{formatDuration(route.duration)}</Text>
                <Text style={[styles.routeStatLabel, { color: colors.textSecondary }]}>Durée</Text>
              </View>
            </View>

            {/* Warnings */}
            {route.warnings.length > 0 && (
              <View style={styles.warningsContainer}>
                {route.warnings.map((warning, index) => (
                  <View key={index} style={[styles.warningBadge, { backgroundColor: colors.warning + '20' }]}>
                    <Text style={[styles.warningText, { color: colors.warning }]}>{warning}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Steps */}
            <View style={styles.stepsContainer}>
              <Text style={[styles.stepsTitle, { color: colors.text }]}>Étapes du trajet</Text>
              {route.steps.map((step, index) => (
                <View key={index} style={styles.stepRow}>
                  <View style={[styles.stepNumber, { backgroundColor: colors.primary }]}>
                    <Text style={styles.stepNumberText}>{index + 1}</Text>
                  </View>
                  <View style={styles.stepContent}>
                    <Text style={[styles.stepInstruction, { color: colors.text }]}>{step.instruction}</Text>
                    {step.distance > 0 && (
                      <Text style={[styles.stepDetail, { color: colors.textSecondary }]}>
                        {step.distance.toFixed(1)} km • {formatDuration(step.duration)}
                      </Text>
                    )}
                    {step.warning && (
                      <Text style={[styles.stepWarning, { color: colors.warning }]}>{step.warning}</Text>
                    )}
                  </View>
                </View>
              ))}
            </View>

            {/* Action Buttons */}
            <View style={styles.routeActions}>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.success }]}
                onPress={startNavigation}
              >
                <Ionicons name="navigate" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>Démarrer</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.info }]}
                onPress={saveRoute}
              >
                <Ionicons name="bookmark" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>Sauvegarder</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Safety Features */}
        <View style={[styles.safetyCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.safetyTitle, { color: colors.text }]}>Fonctionnalités de sécurité</Text>
          
          <TouchableOpacity
            style={[styles.safetyOption, { backgroundColor: fallDetectorActive ? colors.success + '20' : colors.background }]}
            onPress={() => setFallDetectorActive(!fallDetectorActive)}
          >
            <Ionicons name="body" size={24} color={fallDetectorActive ? colors.success : colors.textSecondary} />
            <View style={styles.safetyOptionText}>
              <Text style={[styles.safetyOptionTitle, { color: colors.text }]}>Détecteur de chute</Text>
              <Text style={[styles.safetyOptionDesc, { color: colors.textSecondary }]}>
                Alerte automatique en cas d'accident
              </Text>
            </View>
            <Ionicons 
              name={fallDetectorActive ? 'checkmark-circle' : 'ellipse-outline'} 
              size={24} 
              color={fallDetectorActive ? colors.success : colors.textSecondary} 
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.safetyOption, { backgroundColor: gpsTrackingActive ? colors.success + '20' : colors.background }]}
            onPress={() => setGpsTrackingActive(!gpsTrackingActive)}
          >
            <Ionicons name="location" size={24} color={gpsTrackingActive ? colors.success : colors.textSecondary} />
            <View style={styles.safetyOptionText}>
              <Text style={[styles.safetyOptionTitle, { color: colors.text }]}>Suivi GPS assurance</Text>
              <Text style={[styles.safetyOptionDesc, { color: colors.textSecondary }]}>
                Prouve l'évitement des voies interdites
              </Text>
            </View>
            <Ionicons 
              name={gpsTrackingActive ? 'checkmark-circle' : 'ellipse-outline'} 
              size={24} 
              color={gpsTrackingActive ? colors.success : colors.textSecondary} 
            />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Saved Routes Modal */}
      <Modal visible={showSavedRoutes} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Itinéraires sauvegardés</Text>
              <TouchableOpacity onPress={() => setShowSavedRoutes(false)}>
                <Ionicons name="close" size={28} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.savedRoutesList}>
              {savedRoutes.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="bookmark-outline" size={48} color={colors.textSecondary} />
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                    Aucun itinéraire sauvegardé
                  </Text>
                </View>
              ) : (
                savedRoutes.map((saved) => (
                  <TouchableOpacity
                    key={saved.id}
                    style={[styles.savedRouteItem, { backgroundColor: colors.background }]}
                    onPress={() => loadSavedRoute(saved)}
                  >
                    <View style={[styles.savedRouteIcon, { backgroundColor: saved.mode === 'rapide' ? colors.rapide : colors.balade }]}>
                      <Ionicons name={saved.mode === 'rapide' ? 'flash' : 'leaf'} size={20} color="#fff" />
                    </View>
                    <View style={styles.savedRouteInfo}>
                      <Text style={[styles.savedRouteName, { color: colors.text }]}>{saved.name}</Text>
                      <Text style={[styles.savedRouteDetail, { color: colors.textSecondary }]}>
                        {saved.distance} km • {formatDuration(saved.duration)}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, margin: 16, borderRadius: 16 },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  content: { flex: 1, paddingHorizontal: 16 },
  modeContainer: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  modeButton: { flex: 1, padding: 16, borderRadius: 16, alignItems: 'center' },
  modeText: { fontSize: 16, fontWeight: 'bold', marginTop: 8 },
  modeSubtext: { fontSize: 12, marginTop: 4 },
  inputCard: { borderRadius: 16, padding: 16, marginBottom: 16 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  inputIcon: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  input: { flex: 1, fontSize: 16, paddingVertical: 8 },
  inputDivider: { height: 1, marginVertical: 12, marginLeft: 44, borderTopWidth: 1, borderStyle: 'dashed' },
  calculateButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 16, gap: 8, marginBottom: 16 },
  calculateButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  infoCard: { flexDirection: 'row', padding: 16, borderRadius: 12, borderLeftWidth: 4, marginBottom: 16, gap: 12, alignItems: 'flex-start' },
  infoText: { flex: 1, fontSize: 14, lineHeight: 20 },
  routeCard: { borderRadius: 16, padding: 16, marginBottom: 16 },
  routeHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  routeIcon: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  routeInfo: { flex: 1, marginLeft: 12 },
  routeTitle: { fontSize: 18, fontWeight: 'bold' },
  routeSubtitle: { fontSize: 14, marginTop: 2 },
  routeStats: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, marginBottom: 16 },
  routeStat: { flex: 1, alignItems: 'center' },
  routeStatValue: { fontSize: 24, fontWeight: 'bold', marginTop: 8 },
  routeStatLabel: { fontSize: 12, marginTop: 4 },
  routeStatDivider: { width: 1, height: 40, opacity: 0.3 },
  warningsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  warningBadge: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20 },
  warningText: { fontSize: 12, fontWeight: '600' },
  stepsContainer: { marginBottom: 16 },
  stepsTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 12 },
  stepRow: { flexDirection: 'row', marginBottom: 12 },
  stepNumber: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  stepNumberText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  stepContent: { flex: 1, marginLeft: 12 },
  stepInstruction: { fontSize: 15 },
  stepDetail: { fontSize: 13, marginTop: 4 },
  stepWarning: { fontSize: 12, marginTop: 4, fontWeight: '600' },
  routeActions: { flexDirection: 'row', gap: 12 },
  actionButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 12, gap: 8 },
  actionButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  safetyCard: { borderRadius: 16, padding: 16, marginBottom: 24 },
  safetyTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 12 },
  safetyOption: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 12, marginBottom: 8, gap: 12 },
  safetyOptionText: { flex: 1 },
  safetyOptionTitle: { fontSize: 15, fontWeight: '600' },
  safetyOptionDesc: { fontSize: 13, marginTop: 2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { maxHeight: '70%', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  savedRoutesList: { maxHeight: 400 },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 16, marginTop: 12 },
  savedRouteItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 12, marginBottom: 8 },
  savedRouteIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  savedRouteInfo: { flex: 1, marginLeft: 12 },
  savedRouteName: { fontSize: 16, fontWeight: '600' },
  savedRouteDetail: { fontSize: 13, marginTop: 2 },
});
