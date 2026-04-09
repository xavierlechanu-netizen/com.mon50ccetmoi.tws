import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useColorScheme,
  ScrollView,
  TextInput,
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

interface Parking {
  id: string;
  name: string;
  type: string;
  lat: number;
  lng: number;
  description?: string;
  upvotes: number;
  downvotes: number;
  created_at: string;
}

export default function ParkingScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { user } = useAuth();

  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [parkings, setParkings] = useState<Parking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newParkingName, setNewParkingName] = useState('');
  const [newParkingType, setNewParkingType] = useState('free');
  const [newParkingDescription, setNewParkingDescription] = useState('');

  const colors = {
    background: isDark ? '#1a1a2e' : '#f5f5f5',
    card: isDark ? '#16213e' : '#ffffff',
    text: isDark ? '#ffffff' : '#1a1a2e',
    textSecondary: isDark ? '#a0a0a0' : '#666666',
    primary: '#e94560',
    success: '#4ade80',
    warning: '#fbbf24',
    info: '#3b82f6',
    free: '#10b981',
    paid: '#f97316',
    limited: '#8b5cf6',
  };

  useEffect(() => {
    initLocation();
  }, []);

  const initLocation = async () => {
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
      loadParkings(currentLocation.coords.latitude, currentLocation.coords.longitude);
    } catch (error) {
      console.error('Location error:', error);
      setIsLoading(false);
    }
  };

  const loadParkings = async (lat: number, lng: number) => {
    try {
      const response = await apiService.getNearbyParking(lat, lng, 5000);
      setParkings(response.parkings || []);
    } catch (error) {
      console.error('Error loading parkings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const addParking = async () => {
    if (!user) {
      Alert.alert('Connexion requise', 'Connectez-vous pour ajouter un parking', [
        { text: 'Annuler' },
        { text: 'Connexion', onPress: () => router.push('/(auth)/login') },
      ]);
      return;
    }

    if (!location) {
      Alert.alert('Erreur', 'Position non disponible');
      return;
    }

    if (!newParkingName.trim()) {
      Alert.alert('Erreur', 'Veuillez donner un nom au parking');
      return;
    }

    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) return;

      await apiService.createParking({
        name: newParkingName,
        type: newParkingType,
        lat: location.coords.latitude,
        lng: location.coords.longitude,
        description: newParkingDescription || undefined,
      }, token);

      setShowAddModal(false);
      setNewParkingName('');
      setNewParkingDescription('');
      setNewParkingType('free');
      loadParkings(location.coords.latitude, location.coords.longitude);
      Alert.alert('Merci !', 'Parking ajouté avec succès');
    } catch (error: any) {
      Alert.alert('Erreur', error.message);
    }
  };

  const voteParking = async (parkingId: string, voteType: 'up' | 'down') => {
    if (!user) {
      Alert.alert('Connexion requise', 'Connectez-vous pour voter');
      return;
    }

    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) return;

      await apiService.voteParking(parkingId, voteType, token);
      if (location) {
        loadParkings(location.coords.latitude, location.coords.longitude);
      }
    } catch (error: any) {
      Alert.alert('Erreur', error.message);
    }
  };

  const getDistance = (lat: number, lng: number): string => {
    if (!location) return '?';
    const R = 6371000;
    const dLat = (lat - location.coords.latitude) * Math.PI / 180;
    const dLng = (lng - location.coords.longitude) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(location.coords.latitude * Math.PI / 180) * Math.cos(lat * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    if (distance < 1000) {
      return `${Math.round(distance)}m`;
    }
    return `${(distance / 1000).toFixed(1)}km`;
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'free': return colors.free;
      case 'paid': return colors.paid;
      case 'limited': return colors.limited;
      default: return colors.info;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'free': return 'Gratuit';
      case 'paid': return 'Payant';
      case 'limited': return 'Limité';
      default: return type;
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.text }]}>Recherche des parkings...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.card }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Parkings 50cc</Text>
        <TouchableOpacity onPress={() => setShowAddModal(true)}>
          <Ionicons name="add-circle" size={28} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Info */}
      <View style={[styles.infoCard, { backgroundColor: colors.free + '20', borderColor: colors.free }]}>
        <Ionicons name="information-circle" size={24} color={colors.free} />
        <Text style={[styles.infoText, { color: colors.text }]}>
          Trouvez et partagez les parkings gratuits pour scooters 50cc près de vous
        </Text>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.free }]} />
          <Text style={[styles.legendText, { color: colors.text }]}>Gratuit</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.paid }]} />
          <Text style={[styles.legendText, { color: colors.text }]}>Payant</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.limited }]} />
          <Text style={[styles.legendText, { color: colors.text }]}>Limité</Text>
        </View>
      </View>

      {/* Parking List */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {parkings.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.card }]}>
            <Ionicons name="car" size={48} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.text }]}>
              Aucun parking trouvé
            </Text>
            <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
              Soyez le premier à signaler un parking gratuit !
            </Text>
            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: colors.primary }]}
              onPress={() => setShowAddModal(true)}
            >
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={styles.addButtonText}>Ajouter un parking</Text>
            </TouchableOpacity>
          </View>
        ) : (
          parkings.map((parking) => (
            <View key={parking.id} style={[styles.parkingCard, { backgroundColor: colors.card }]}>
              <View style={styles.parkingHeader}>
                <View style={[styles.parkingIcon, { backgroundColor: getTypeColor(parking.type) + '20' }]}>
                  <Ionicons name="car" size={24} color={getTypeColor(parking.type)} />
                </View>
                <View style={styles.parkingInfo}>
                  <Text style={[styles.parkingName, { color: colors.text }]}>{parking.name}</Text>
                  <View style={styles.parkingMeta}>
                    <View style={[styles.typeBadge, { backgroundColor: getTypeColor(parking.type) + '20' }]}>
                      <Text style={[styles.typeText, { color: getTypeColor(parking.type) }]}>
                        {getTypeLabel(parking.type)}
                      </Text>
                    </View>
                    <Text style={[styles.distance, { color: colors.textSecondary }]}>
                      {getDistance(parking.lat, parking.lng)}
                    </Text>
                  </View>
                </View>
              </View>
              
              {parking.description && (
                <Text style={[styles.parkingDescription, { color: colors.textSecondary }]}>
                  {parking.description}
                </Text>
              )}
              
              <View style={styles.voteRow}>
                <TouchableOpacity
                  style={[styles.voteButton, { backgroundColor: colors.success + '20' }]}
                  onPress={() => voteParking(parking.id, 'up')}
                >
                  <Ionicons name="thumbs-up" size={18} color={colors.success} />
                  <Text style={[styles.voteCount, { color: colors.success }]}>{parking.upvotes}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.voteButton, { backgroundColor: colors.primary + '20' }]}
                  onPress={() => voteParking(parking.id, 'down')}
                >
                  <Ionicons name="thumbs-down" size={18} color={colors.primary} />
                  <Text style={[styles.voteCount, { color: colors.primary }]}>{parking.downvotes}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Add Parking Modal */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Ajouter un parking</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={28} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.inputLabel, { color: colors.text }]}>Nom du parking *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.textSecondary }]}
              placeholder="Ex: Parking Place de la Mairie"
              placeholderTextColor={colors.textSecondary}
              value={newParkingName}
              onChangeText={setNewParkingName}
            />

            <Text style={[styles.inputLabel, { color: colors.text }]}>Type</Text>
            <View style={styles.typeButtons}>
              {['free', 'paid', 'limited'].map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.typeButton,
                    { backgroundColor: newParkingType === type ? getTypeColor(type) : colors.background }
                  ]}
                  onPress={() => setNewParkingType(type)}
                >
                  <Text style={[
                    styles.typeButtonText,
                    { color: newParkingType === type ? '#fff' : colors.text }
                  ]}>
                    {getTypeLabel(type)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.inputLabel, { color: colors.text }]}>Description (optionnel)</Text>
            <TextInput
              style={[styles.input, styles.textArea, { backgroundColor: colors.background, color: colors.text, borderColor: colors.textSecondary }]}
              placeholder="Ex: 10 places disponibles, accès facile..."
              placeholderTextColor={colors.textSecondary}
              value={newParkingDescription}
              onChangeText={setNewParkingDescription}
              multiline
            />

            <TouchableOpacity
              style={[styles.submitButton, { backgroundColor: colors.primary }]}
              onPress={addParking}
            >
              <Ionicons name="checkmark" size={20} color="#fff" />
              <Text style={styles.submitButtonText}>Ajouter ce parking</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary }]}
        onPress={() => setShowAddModal(true)}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 16, fontSize: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, margin: 16, borderRadius: 16 },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  infoCard: { flexDirection: 'row', padding: 16, borderRadius: 12, borderLeftWidth: 4, marginHorizontal: 16, marginBottom: 16, gap: 12, alignItems: 'flex-start' },
  infoText: { flex: 1, fontSize: 14, lineHeight: 20 },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: 24, marginBottom: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendText: { fontSize: 14 },
  content: { flex: 1, paddingHorizontal: 16 },
  emptyCard: { padding: 32, borderRadius: 16, alignItems: 'center' },
  emptyText: { fontSize: 16, fontWeight: '600', marginTop: 12 },
  emptySubtext: { fontSize: 14, marginTop: 4, textAlign: 'center' },
  addButton: { flexDirection: 'row', alignItems: 'center', marginTop: 16, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12, gap: 8 },
  addButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  parkingCard: { padding: 16, borderRadius: 16, marginBottom: 12 },
  parkingHeader: { flexDirection: 'row', alignItems: 'center' },
  parkingIcon: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  parkingInfo: { flex: 1, marginLeft: 12 },
  parkingName: { fontSize: 16, fontWeight: 'bold' },
  parkingMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 8 },
  typeBadge: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 8 },
  typeText: { fontSize: 12, fontWeight: '600' },
  distance: { fontSize: 14 },
  parkingDescription: { fontSize: 14, marginTop: 12, lineHeight: 20 },
  voteRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  voteButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 10, borderRadius: 12, gap: 8 },
  voteCount: { fontSize: 14, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  inputLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8, marginTop: 12 },
  input: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 16 },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  typeButtons: { flexDirection: 'row', gap: 12 },
  typeButton: { flex: 1, padding: 12, borderRadius: 12, alignItems: 'center' },
  typeButtonText: { fontSize: 14, fontWeight: '600' },
  submitButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 12, marginTop: 24, gap: 8 },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  fab: { position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', elevation: 4 },
});
