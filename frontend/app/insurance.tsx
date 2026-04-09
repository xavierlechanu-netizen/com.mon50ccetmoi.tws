import React, { useEffect, useState } from 'react';
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
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiService } from '../src/services/api';

interface Formula {
  name: string;
  price_monthly: number;
  price_yearly: number;
  coverages: string[];
  excluded: string[];
}

interface Provider {
  id: string;
  name: string;
  logo: string;
  color: string;
  rating: number;
  formulas: Formula[];
}

interface Estimate {
  id: string;
  name: string;
  logo: string;
  color: string;
  rating: number;
  formulas: Formula[];
}

interface Broker {
  name: string;
  title: string;
  phone_mobile: string;
  phone_fixed: string;
  description: string;
  special_offer: string;
  color: string;
}

const BRANDS = [
  "Peugeot", "MBK", "Piaggio", "Kymco", "Sym", "Honda", "Yamaha", "Aprilia", "Vespa", "Derbi", "Gilera", "Malaguti",
  "Baotian", "Jiajue", "Znen", "Generic", "Keeway", "CPI", "Sachs", "Rex", "Jinlun", "Qingqi",
  "TNT Motor", "Rieju", "Beta", "Fantic", "Sherco", "Gas Gas", "TGB", "Daelim", "Hyosung", "Benelli",
  "Autre"
];

export default function InsuranceScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [isLoading, setIsLoading] = useState(false);
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<Estimate | null>(null);
  const [showForm, setShowForm] = useState(true);
  const [broker, setBroker] = useState<Broker | null>(null);
  
  // Form state
  const [age, setAge] = useState('18');
  const [experience, setExperience] = useState('0');
  const [vehicleValue, setVehicleValue] = useState('1500');
  const [brand, setBrand] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [showBrandPicker, setShowBrandPicker] = useState(false);

  const colors = {
    background: isDark ? '#1a1a2e' : '#f5f5f5',
    card: isDark ? '#16213e' : '#ffffff',
    text: isDark ? '#ffffff' : '#1a1a2e',
    textSecondary: isDark ? '#a0a0a0' : '#666666',
    primary: '#e94560',
    success: '#4ade80',
    warning: '#fbbf24',
    info: '#3b82f6',
    broker: '#10b981',
  };

  useEffect(() => {
    loadBroker();
  }, []);

  const loadBroker = async () => {
    try {
      const response = await apiService.getInsuranceProviders();
      if (response.broker) {
        setBroker(response.broker);
      }
    } catch (error) {
      console.log('Error loading broker:', error);
    }
  };

  const callBroker = (phoneNumber: string) => {
    Linking.openURL(`tel:${phoneNumber.replace(/\s/g, '')}`);
  };

  const getEstimates = async () => {
    if (!age || !postalCode || !brand) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs obligatoires');
      return;
    }

    setIsLoading(true);
    try {
      const response = await apiService.getInsuranceEstimate({
        driver_age: parseInt(age),
        experience_years: parseInt(experience),
        vehicle_value: parseInt(vehicleValue),
        brand,
        postal_code: postalCode,
      });
      
      setEstimates(response.estimates);
      setShowForm(false);
    } catch (error: any) {
      Alert.alert('Erreur', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const renderStars = (rating: number) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Ionicons
          key={i}
          name={i <= Math.floor(rating) ? 'star' : i - 0.5 <= rating ? 'star-half' : 'star-outline'}
          size={14}
          color={colors.warning}
        />
      );
    }
    return stars;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.card }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Comparateur Assurance</Text>
        {!showForm && (
          <TouchableOpacity onPress={() => setShowForm(true)}>
            <Ionicons name="refresh" size={24} color={colors.primary} />
          </TouchableOpacity>
        )}
        {showForm && <View style={{ width: 24 }} />}
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {showForm ? (
          <>
            {/* Broker Card - Special Offer */}
            {broker && (
              <View style={[styles.brokerCard, { backgroundColor: colors.broker + '15', borderColor: colors.broker }]}>
                <View style={styles.brokerHeader}>
                  <View style={[styles.brokerIcon, { backgroundColor: colors.broker }]}>
                    <Ionicons name="star" size={24} color="#fff" />
                  </View>
                  <View style={styles.brokerInfo}>
                    <Text style={[styles.brokerName, { color: colors.text }]}>{broker.name}</Text>
                    <Text style={[styles.brokerTitle, { color: colors.broker }]}>{broker.title}</Text>
                  </View>
                </View>
                <Text style={[styles.brokerDescription, { color: colors.text }]}>{broker.description}</Text>
                <View style={[styles.brokerOffer, { backgroundColor: colors.broker + '20' }]}>
                  <Ionicons name="gift" size={18} color={colors.broker} />
                  <Text style={[styles.brokerOfferText, { color: colors.broker }]}>{broker.special_offer}</Text>
                </View>
                <View style={styles.brokerPhones}>
                  <TouchableOpacity
                    style={[styles.phoneButton, { backgroundColor: colors.broker }]}
                    onPress={() => callBroker(broker.phone_mobile)}
                  >
                    <Ionicons name="call" size={18} color="#fff" />
                    <Text style={styles.phoneButtonText}>{broker.phone_mobile}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.phoneButton, { backgroundColor: colors.info }]}
                    onPress={() => callBroker(broker.phone_fixed)}
                  >
                    <Ionicons name="call" size={18} color="#fff" />
                    <Text style={styles.phoneButtonText}>{broker.phone_fixed}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Info Card */}
            <View style={[styles.infoCard, { backgroundColor: colors.info + '20', borderColor: colors.info }]}>
              <Ionicons name="information-circle" size={24} color={colors.info} />
              <Text style={[styles.infoText, { color: colors.text }]}>
                Comparez les meilleures offres d'assurance 50cc en France. Prix indicatifs à confirmer auprès des assureurs.
              </Text>
            </View>

            {/* Form */}
            <View style={[styles.formCard, { backgroundColor: colors.card }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Votre profil</Text>
              
              <View style={styles.row}>
                <View style={styles.halfInput}>
                  <Text style={[styles.inputLabel, { color: colors.text }]}>Âge *</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.textSecondary }]}
                    placeholder="18"
                    placeholderTextColor={colors.textSecondary}
                    value={age}
                    onChangeText={setAge}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.halfInput}>
                  <Text style={[styles.inputLabel, { color: colors.text }]}>Expérience (ans)</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.textSecondary }]}
                    placeholder="0"
                    placeholderTextColor={colors.textSecondary}
                    value={experience}
                    onChangeText={setExperience}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <Text style={[styles.inputLabel, { color: colors.text }]}>Code postal *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.textSecondary }]}
                placeholder="Ex: 75001"
                placeholderTextColor={colors.textSecondary}
                value={postalCode}
                onChangeText={setPostalCode}
                keyboardType="numeric"
                maxLength={5}
              />

              <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 24 }]}>Votre scooter</Text>

              <Text style={[styles.inputLabel, { color: colors.text }]}>Marque *</Text>
              <TouchableOpacity
                style={[styles.input, styles.selectInput, { backgroundColor: colors.background, borderColor: colors.textSecondary }]}
                onPress={() => setShowBrandPicker(true)}
              >
                <Text style={[styles.selectText, { color: brand ? colors.text : colors.textSecondary }]}>
                  {brand || 'Sélectionner une marque'}
                </Text>
                <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
              </TouchableOpacity>

              <Text style={[styles.inputLabel, { color: colors.text }]}>Valeur du véhicule (€)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.textSecondary }]}
                placeholder="1500"
                placeholderTextColor={colors.textSecondary}
                value={vehicleValue}
                onChangeText={setVehicleValue}
                keyboardType="numeric"
              />

              <TouchableOpacity
                style={[styles.submitButton, { backgroundColor: colors.primary }]}
                onPress={getEstimates}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="search" size={20} color="#fff" />
                    <Text style={styles.submitButtonText}>Comparer les offres</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Brand Categories Info */}
            <View style={[styles.brandInfoCard, { backgroundColor: colors.card }]}>
              <Text style={[styles.brandInfoTitle, { color: colors.text }]}>Marques disponibles</Text>
              
              <View style={styles.brandCategory}>
                <Text style={[styles.brandCategoryTitle, { color: colors.primary }]}>Marques Premium</Text>
                <Text style={[styles.brandCategoryText, { color: colors.textSecondary }]}>
                  Peugeot, MBK, Piaggio, Honda, Yamaha, Vespa, Aprilia...
                </Text>
              </View>
              
              <View style={styles.brandCategory}>
                <Text style={[styles.brandCategoryTitle, { color: colors.warning }]}>Groupe Baotian France</Text>
                <Text style={[styles.brandCategoryText, { color: colors.textSecondary }]}>
                  Baotian, Jiajue, Znen, Generic, Keeway, CPI, Jinlun, Qingqi...
                </Text>
              </View>
              
              <View style={styles.brandCategory}>
                <Text style={[styles.brandCategoryTitle, { color: colors.info }]}>Maxiscoot / Import</Text>
                <Text style={[styles.brandCategoryText, { color: colors.textSecondary }]}>
                  TNT Motor, Rieju, Beta, Fantic, TGB, Daelim, Hyosung, Benelli...
                </Text>
              </View>
            </View>
          </>
        ) : (
          <>
            {/* Results Header */}
            <View style={[styles.resultsHeader, { backgroundColor: colors.card }]}>
              <View>
                <Text style={[styles.resultsTitle, { color: colors.text }]}>
                  {estimates.length} offres trouvées
                </Text>
                <Text style={[styles.resultsSubtitle, { color: colors.textSecondary }]}>
                  {brand} • {age} ans • {postalCode}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.modifyButton, { borderColor: colors.primary }]}
                onPress={() => setShowForm(true)}
              >
                <Text style={[styles.modifyButtonText, { color: colors.primary }]}>Modifier</Text>
              </TouchableOpacity>
            </View>

            {/* Estimates List */}
            {estimates.map((provider, index) => (
              <TouchableOpacity
                key={provider.id}
                style={[styles.providerCard, { backgroundColor: colors.card }]}
                onPress={() => setSelectedProvider(provider)}
              >
                {index === 0 && (
                  <View style={[styles.bestBadge, { backgroundColor: colors.success }]}>
                    <Text style={styles.bestBadgeText}>Meilleur prix</Text>
                  </View>
                )}
                
                <View style={styles.providerHeader}>
                  <View style={[styles.providerIcon, { backgroundColor: provider.color + '20' }]}>
                    <Ionicons name={provider.logo as any} size={24} color={provider.color} />
                  </View>
                  <View style={styles.providerInfo}>
                    <Text style={[styles.providerName, { color: colors.text }]}>{provider.name}</Text>
                    <View style={styles.ratingContainer}>
                      {renderStars(provider.rating)}
                      <Text style={[styles.ratingText, { color: colors.textSecondary }]}>
                        {provider.rating}/5
                      </Text>
                    </View>
                  </View>
                  <View style={styles.priceContainer}>
                    <Text style={[styles.priceLabel, { color: colors.textSecondary }]}>dès</Text>
                    <Text style={[styles.price, { color: colors.primary }]}>
                      {provider.formulas[0].price_monthly.toFixed(0)}€
                    </Text>
                    <Text style={[styles.priceUnit, { color: colors.textSecondary }]}>/mois</Text>
                  </View>
                </View>

                <View style={styles.formulasPreview}>
                  {provider.formulas.map((formula, idx) => (
                    <View key={idx} style={[styles.formulaChip, { backgroundColor: colors.background }]}>
                      <Text style={[styles.formulaChipName, { color: colors.text }]}>{formula.name}</Text>
                      <Text style={[styles.formulaChipPrice, { color: colors.primary }]}>
                        {formula.price_monthly.toFixed(0)}€
                      </Text>
                    </View>
                  ))}
                </View>

                <View style={styles.viewDetailsRow}>
                  <Text style={[styles.viewDetailsText, { color: colors.primary }]}>Voir les détails</Text>
                  <Ionicons name="chevron-forward" size={20} color={colors.primary} />
                </View>
              </TouchableOpacity>
            ))}

            {/* Disclaimer */}
            <View style={[styles.disclaimer, { backgroundColor: colors.warning + '20', borderColor: colors.warning }]}>
              <Ionicons name="alert-circle" size={20} color={colors.warning} />
              <Text style={[styles.disclaimerText, { color: colors.text }]}>
                Prix indicatifs basés sur votre profil. Obtenez un devis personnalisé directement auprès des assureurs.
              </Text>
            </View>
          </>
        )}
      </ScrollView>

      {/* Brand Picker Modal */}
      <Modal visible={showBrandPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Choisir une marque</Text>
              <TouchableOpacity onPress={() => setShowBrandPicker(false)}>
                <Ionicons name="close" size={28} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.brandList}>
              {BRANDS.map((b) => (
                <TouchableOpacity
                  key={b}
                  style={[styles.brandItem, brand === b && { backgroundColor: colors.primary + '20' }]}
                  onPress={() => { setBrand(b); setShowBrandPicker(false); }}
                >
                  <Text style={[styles.brandItemText, { color: brand === b ? colors.primary : colors.text }]}>
                    {b}
                  </Text>
                  {brand === b && <Ionicons name="checkmark" size={20} color={colors.primary} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Provider Detail Modal */}
      <Modal visible={!!selectedProvider} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <View style={[styles.providerIcon, { backgroundColor: (selectedProvider?.color || '#ccc') + '20' }]}>
                  <Ionicons name={(selectedProvider?.logo as any) || 'shield'} size={24} color={selectedProvider?.color} />
                </View>
                <Text style={[styles.modalTitle, { color: colors.text }]}>{selectedProvider?.name}</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedProvider(null)}>
                <Ionicons name="close" size={28} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.formulasList}>
              {selectedProvider?.formulas.map((formula, idx) => (
                <View key={idx} style={[styles.formulaCard, { backgroundColor: colors.background }]}>
                  <View style={styles.formulaHeader}>
                    <Text style={[styles.formulaName, { color: colors.text }]}>{formula.name}</Text>
                    <View style={styles.formulaPrices}>
                      <Text style={[styles.formulaPrice, { color: colors.primary }]}>
                        {formula.price_monthly.toFixed(2)}€/mois
                      </Text>
                      <Text style={[styles.formulaYearly, { color: colors.textSecondary }]}>
                        ou {formula.price_yearly.toFixed(2)}€/an
                      </Text>
                    </View>
                  </View>

                  <Text style={[styles.coverageTitle, { color: colors.success }]}>✓ Inclus</Text>
                  <View style={styles.coverageList}>
                    {formula.coverages.map((cov, i) => (
                      <View key={i} style={styles.coverageItem}>
                        <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                        <Text style={[styles.coverageText, { color: colors.text }]}>{cov}</Text>
                      </View>
                    ))}
                  </View>

                  {formula.excluded.length > 0 && (
                    <>
                      <Text style={[styles.coverageTitle, { color: colors.warning, marginTop: 12 }]}>✗ Non inclus</Text>
                      <View style={styles.coverageList}>
                        {formula.excluded.map((exc, i) => (
                          <View key={i} style={styles.coverageItem}>
                            <Ionicons name="close-circle" size={16} color={colors.warning} />
                            <Text style={[styles.coverageText, { color: colors.textSecondary }]}>{exc}</Text>
                          </View>
                        ))}
                      </View>
                    </>
                  )}

                  <TouchableOpacity
                    style={[styles.quoteButton, { backgroundColor: selectedProvider?.color }]}
                    onPress={() => Alert.alert('Devis', `Contactez ${selectedProvider?.name} pour obtenir un devis personnalisé pour la formule ${formula.name}.`)}
                  >
                    <Text style={styles.quoteButtonText}>Demander un devis</Text>
                  </TouchableOpacity>
                </View>
              ))}
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
  brokerCard: { padding: 16, borderRadius: 16, borderWidth: 2, marginBottom: 16 },
  brokerHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  brokerIcon: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  brokerInfo: { flex: 1, marginLeft: 12 },
  brokerName: { fontSize: 18, fontWeight: 'bold' },
  brokerTitle: { fontSize: 14, fontWeight: '600' },
  brokerDescription: { fontSize: 14, marginBottom: 12, lineHeight: 20 },
  brokerOffer: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, marginBottom: 12, gap: 8 },
  brokerOfferText: { flex: 1, fontSize: 13, fontWeight: '600' },
  brokerPhones: { flexDirection: 'row', gap: 8 },
  phoneButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 12, gap: 8 },
  phoneButtonText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  infoCard: { flexDirection: 'row', padding: 16, borderRadius: 12, borderLeftWidth: 4, marginBottom: 16, gap: 12, alignItems: 'flex-start' },
  infoText: { flex: 1, fontSize: 14, lineHeight: 20 },
  formCard: { padding: 20, borderRadius: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
  row: { flexDirection: 'row', gap: 12 },
  halfInput: { flex: 1 },
  inputLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8, marginTop: 12 },
  input: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 16 },
  selectInput: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  selectText: { fontSize: 16 },
  submitButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 12, marginTop: 24, gap: 8 },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  brandInfoCard: { padding: 16, borderRadius: 16, marginBottom: 24 },
  brandInfoTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 12 },
  brandCategory: { marginBottom: 12 },
  brandCategoryTitle: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
  brandCategoryText: { fontSize: 13, lineHeight: 18 },
  resultsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderRadius: 16, marginBottom: 16 },
  resultsTitle: { fontSize: 18, fontWeight: 'bold' },
  resultsSubtitle: { fontSize: 14, marginTop: 4 },
  modifyButton: { borderWidth: 1, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20 },
  modifyButtonText: { fontSize: 14, fontWeight: '600' },
  providerCard: { padding: 16, borderRadius: 16, marginBottom: 12, position: 'relative' },
  bestBadge: { position: 'absolute', top: -8, right: 16, paddingVertical: 4, paddingHorizontal: 12, borderRadius: 12 },
  bestBadgeText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  providerHeader: { flexDirection: 'row', alignItems: 'center' },
  providerIcon: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  providerInfo: { flex: 1, marginLeft: 12 },
  providerName: { fontSize: 16, fontWeight: 'bold' },
  ratingContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 },
  ratingText: { fontSize: 12, marginLeft: 4 },
  priceContainer: { alignItems: 'flex-end' },
  priceLabel: { fontSize: 12 },
  price: { fontSize: 24, fontWeight: 'bold' },
  priceUnit: { fontSize: 12 },
  formulasPreview: { flexDirection: 'row', marginTop: 16, gap: 8 },
  formulaChip: { flex: 1, padding: 10, borderRadius: 8, alignItems: 'center' },
  formulaChipName: { fontSize: 12, fontWeight: '600' },
  formulaChipPrice: { fontSize: 14, fontWeight: 'bold', marginTop: 4 },
  viewDetailsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 12 },
  viewDetailsText: { fontSize: 14, fontWeight: '600' },
  disclaimer: { flexDirection: 'row', padding: 16, borderRadius: 12, borderLeftWidth: 4, marginVertical: 16, gap: 12, alignItems: 'flex-start' },
  disclaimerText: { flex: 1, fontSize: 13, lineHeight: 18 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { maxHeight: '90%', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  brandList: { maxHeight: 400 },
  brandItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderRadius: 8, marginBottom: 4 },
  brandItemText: { fontSize: 16 },
  formulasList: { maxHeight: 500 },
  formulaCard: { padding: 16, borderRadius: 12, marginBottom: 12 },
  formulaHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  formulaName: { fontSize: 18, fontWeight: 'bold' },
  formulaPrices: { alignItems: 'flex-end' },
  formulaPrice: { fontSize: 18, fontWeight: 'bold' },
  formulaYearly: { fontSize: 12, marginTop: 2 },
  coverageTitle: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  coverageList: { gap: 6 },
  coverageItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  coverageText: { fontSize: 14 },
  quoteButton: { padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  quoteButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
