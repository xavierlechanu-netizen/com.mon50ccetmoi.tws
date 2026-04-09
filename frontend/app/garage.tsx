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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../src/contexts/AuthContext';
import { apiService } from '../src/services/api';

const BRANDS = ["Peugeot", "MBK", "Piaggio", "Kymco", "Sym", "Honda", "Yamaha", "Aprilia", "Vespa", "Derbi", "Gilera", "Malaguti", "Autre"];

interface Vehicle {
  _id: string;
  brand: string;
  model: string;
  year: number;
  engine_type: string;
  mileage: number;
  last_oil_change_km?: number;
  last_belt_change_km?: number;
  last_spark_plug_change_km?: number;
}

interface Tip {
  type: string;
  priority: string;
  icon: string;
  title: string;
  description: string;
  action: string;
}

interface Problem {
  symptom: string;
  icon: string;
  causes: { cause: string; solution: string; difficulty: string }[];
}

export default function GarageScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { user, isLoading: authLoading } = useAuth();

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [tips, setTips] = useState<Tip[]>([]);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'tips' | 'problems' | 'ai'>('tips');
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [showProblemDetail, setShowProblemDetail] = useState<Problem | null>(null);
  
  // AI Chat state
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiAnswer, setAiAnswer] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState<any[]>([]);

  // Vehicle form state
  const [formBrand, setFormBrand] = useState('');
  const [formModel, setFormModel] = useState('');
  const [formYear, setFormYear] = useState('');
  const [formEngineType, setFormEngineType] = useState('4T');
  const [formMileage, setFormMileage] = useState('');
  const [formLastOilKm, setFormLastOilKm] = useState('');
  const [formLastBeltKm, setFormLastBeltKm] = useState('');

  const colors = {
    background: isDark ? '#1a1a2e' : '#f5f5f5',
    card: isDark ? '#16213e' : '#ffffff',
    text: isDark ? '#ffffff' : '#1a1a2e',
    textSecondary: isDark ? '#a0a0a0' : '#666666',
    primary: '#e94560',
    success: '#4ade80',
    warning: '#fbbf24',
    danger: '#ef4444',
    info: '#3b82f6',
  };

  useEffect(() => {
    if (user) {
      loadData();
    } else {
      setIsLoading(false);
    }
  }, [user]);

  const loadData = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) return;

      const [vehicleData, tipsData, problemsData] = await Promise.all([
        apiService.getMyVehicle(token).catch(() => null),
        apiService.getMaintenanceTips(token).catch(() => ({ tips: [] })),
        apiService.getCommonProblems(token).catch(() => ({ problems: [] })),
      ]);

      setVehicle(vehicleData);
      setTips(tipsData?.tips || []);
      setProblems(problemsData?.problems || []);

      if (vehicleData) {
        setFormBrand(vehicleData.brand);
        setFormModel(vehicleData.model);
        setFormYear(String(vehicleData.year));
        setFormEngineType(vehicleData.engine_type);
        setFormMileage(String(vehicleData.mileage));
        setFormLastOilKm(String(vehicleData.last_oil_change_km || ''));
        setFormLastBeltKm(String(vehicleData.last_belt_change_km || ''));
      }
    } catch (error) {
      console.error('Error loading garage data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveVehicle = async () => {
    if (!formBrand || !formModel || !formYear || !formMileage) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs obligatoires');
      return;
    }

    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) return;

      const vehicleData = {
        brand: formBrand,
        model: formModel,
        year: parseInt(formYear),
        engine_type: formEngineType,
        mileage: parseInt(formMileage),
        last_oil_change_km: formLastOilKm ? parseInt(formLastOilKm) : null,
        last_belt_change_km: formLastBeltKm ? parseInt(formLastBeltKm) : null,
      };

      await apiService.createVehicle(vehicleData, token);
      setShowVehicleModal(false);
      loadData();
      Alert.alert('Succès', 'Véhicule enregistré !');
    } catch (error: any) {
      Alert.alert('Erreur', error.message);
    }
  };

  const askMechanic = async () => {
    if (!aiQuestion.trim()) return;

    setIsAiLoading(true);
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) return;

      const response = await apiService.askMechanic(aiQuestion, null, token);
      setAiAnswer(response.answer);
      setChatHistory(prev => [{
        question: aiQuestion,
        answer: response.answer,
        created_at: new Date().toISOString()
      }, ...prev]);
      setAiQuestion('');
    } catch (error: any) {
      Alert.alert('Erreur', error.message);
    } finally {
      setIsAiLoading(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return colors.danger;
      case 'medium': return colors.warning;
      default: return colors.info;
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'facile': return colors.success;
      case 'moyen': return colors.warning;
      default: return colors.danger;
    }
  };

  if (!user) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.authRequired}>
          <Ionicons name="construct" size={64} color={colors.primary} />
          <Text style={[styles.authTitle, { color: colors.text }]}>Mon Garage</Text>
          <Text style={[styles.authSubtitle, { color: colors.textSecondary }]}>
            Connectez-vous pour accéder aux conseils personnalisés pour votre scooter
          </Text>
          <TouchableOpacity
            style={[styles.authButton, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/(auth)/login')}
          >
            <Text style={styles.authButtonText}>Se connecter</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (isLoading || authLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
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
        <Text style={[styles.headerTitle, { color: colors.text }]}>Mon Garage</Text>
        <TouchableOpacity onPress={() => setShowVehicleModal(true)}>
          <Ionicons name="settings" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Vehicle Card */}
      {vehicle ? (
        <View style={[styles.vehicleCard, { backgroundColor: colors.card }]}>
          <View style={[styles.vehicleIcon, { backgroundColor: colors.primary }]}>
            <Ionicons name="bicycle" size={32} color="#fff" />
          </View>
          <View style={styles.vehicleInfo}>
            <Text style={[styles.vehicleName, { color: colors.text }]}>
              {vehicle.brand} {vehicle.model}
            </Text>
            <Text style={[styles.vehicleDetails, { color: colors.textSecondary }]}>
              {vehicle.year} • {vehicle.engine_type} • {vehicle.mileage.toLocaleString()} km
            </Text>
          </View>
          <TouchableOpacity onPress={() => setShowVehicleModal(true)}>
            <Ionicons name="create" size={24} color={colors.primary} />
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.addVehicleCard, { backgroundColor: colors.card, borderColor: colors.primary }]}
          onPress={() => setShowVehicleModal(true)}
        >
          <Ionicons name="add-circle" size={48} color={colors.primary} />
          <Text style={[styles.addVehicleText, { color: colors.text }]}>
            Ajouter mon scooter
          </Text>
          <Text style={[styles.addVehicleSubtext, { color: colors.textSecondary }]}>
            Pour des conseils personnalisés
          </Text>
        </TouchableOpacity>
      )}

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'tips' && { backgroundColor: colors.primary }]}
          onPress={() => setActiveTab('tips')}
        >
          <Ionicons name="bulb" size={18} color={activeTab === 'tips' ? '#fff' : colors.text} />
          <Text style={[styles.tabText, { color: activeTab === 'tips' ? '#fff' : colors.text }]}>
            Conseils
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'problems' && { backgroundColor: colors.primary }]}
          onPress={() => setActiveTab('problems')}
        >
          <Ionicons name="construct" size={18} color={activeTab === 'problems' ? '#fff' : colors.text} />
          <Text style={[styles.tabText, { color: activeTab === 'problems' ? '#fff' : colors.text }]}>
            Pannes
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'ai' && { backgroundColor: colors.primary }]}
          onPress={() => setActiveTab('ai')}
        >
          <Ionicons name="chatbubbles" size={18} color={activeTab === 'ai' ? '#fff' : colors.text} />
          <Text style={[styles.tabText, { color: activeTab === 'ai' ? '#fff' : colors.text }]}>
            IA Mécano
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {activeTab === 'tips' && (
          <>
            {tips.length === 0 ? (
              <View style={[styles.emptyCard, { backgroundColor: colors.card }]}>
                <Ionicons name="checkmark-circle" size={48} color={colors.success} />
                <Text style={[styles.emptyText, { color: colors.text }]}>
                  Tout est en ordre !
                </Text>
              </View>
            ) : (
              tips.map((tip, index) => (
                <View
                  key={index}
                  style={[
                    styles.tipCard,
                    { backgroundColor: colors.card, borderLeftColor: getPriorityColor(tip.priority) }
                  ]}
                >
                  <View style={[styles.tipIcon, { backgroundColor: getPriorityColor(tip.priority) + '20' }]}>
                    <Ionicons name={tip.icon as any} size={24} color={getPriorityColor(tip.priority)} />
                  </View>
                  <View style={styles.tipContent}>
                    <Text style={[styles.tipTitle, { color: colors.text }]}>{tip.title}</Text>
                    <Text style={[styles.tipDescription, { color: colors.textSecondary }]}>
                      {tip.description}
                    </Text>
                    <View style={[styles.tipAction, { backgroundColor: getPriorityColor(tip.priority) + '10' }]}>
                      <Text style={[styles.tipActionText, { color: getPriorityColor(tip.priority) }]}>
                        → {tip.action}
                      </Text>
                    </View>
                  </View>
                </View>
              ))
            )}
          </>
        )}

        {activeTab === 'problems' && (
          <>
            {problems.map((problem, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.problemCard, { backgroundColor: colors.card }]}
                onPress={() => setShowProblemDetail(problem)}
              >
                <View style={[styles.problemIcon, { backgroundColor: colors.warning + '20' }]}>
                  <Ionicons name={problem.icon as any} size={24} color={colors.warning} />
                </View>
                <View style={styles.problemContent}>
                  <Text style={[styles.problemTitle, { color: colors.text }]}>{problem.symptom}</Text>
                  <Text style={[styles.problemSubtitle, { color: colors.textSecondary }]}>
                    {problem.causes.length} causes possibles
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            ))}
          </>
        )}

        {activeTab === 'ai' && (
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={[styles.aiCard, { backgroundColor: colors.card }]}>
              <View style={styles.aiHeader}>
                <Ionicons name="hardware-chip" size={24} color={colors.primary} />
                <Text style={[styles.aiTitle, { color: colors.text }]}>Demandez à l'IA Mécano</Text>
              </View>
              <Text style={[styles.aiSubtitle, { color: colors.textSecondary }]}>
                Posez vos questions sur l'entretien, les pannes ou les réparations de votre 50cc
              </Text>
              <TextInput
                style={[styles.aiInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.textSecondary }]}
                placeholder="Ex: Comment savoir si ma courroie est usée ?"
                placeholderTextColor={colors.textSecondary}
                value={aiQuestion}
                onChangeText={setAiQuestion}
                multiline
              />
              <TouchableOpacity
                style={[styles.aiButton, { backgroundColor: colors.primary }]}
                onPress={askMechanic}
                disabled={isAiLoading || !aiQuestion.trim()}
              >
                {isAiLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="send" size={20} color="#fff" />
                    <Text style={styles.aiButtonText}>Demander</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {aiAnswer && (
              <View style={[styles.aiAnswerCard, { backgroundColor: colors.card }]}>
                <View style={styles.aiAnswerHeader}>
                  <Ionicons name="chatbubble-ellipses" size={20} color={colors.primary} />
                  <Text style={[styles.aiAnswerTitle, { color: colors.text }]}>Réponse</Text>
                </View>
                <Text style={[styles.aiAnswerText, { color: colors.text }]}>{aiAnswer}</Text>
              </View>
            )}

            {chatHistory.length > 0 && (
              <View style={styles.historySection}>
                <Text style={[styles.historyTitle, { color: colors.text }]}>Historique</Text>
                {chatHistory.slice(0, 5).map((chat, index) => (
                  <View key={index} style={[styles.historyItem, { backgroundColor: colors.card }]}>
                    <Text style={[styles.historyQuestion, { color: colors.primary }]}>
                      Q: {chat.question}
                    </Text>
                    <Text style={[styles.historyAnswer, { color: colors.textSecondary }]} numberOfLines={2}>
                      {chat.answer}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </KeyboardAvoidingView>
        )}
      </ScrollView>

      {/* Vehicle Modal */}
      <Modal visible={showVehicleModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Mon Scooter 50cc</Text>
              <TouchableOpacity onPress={() => setShowVehicleModal(false)}>
                <Ionicons name="close" size={28} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Marque *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.brandScroll}>
                {BRANDS.map(brand => (
                  <TouchableOpacity
                    key={brand}
                    style={[
                      styles.brandChip,
                      { backgroundColor: formBrand === brand ? colors.primary : colors.background }
                    ]}
                    onPress={() => setFormBrand(brand)}
                  >
                    <Text style={[styles.brandChipText, { color: formBrand === brand ? '#fff' : colors.text }]}>
                      {brand}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={[styles.inputLabel, { color: colors.text }]}>Modèle *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.textSecondary }]}
                placeholder="Ex: Speedfight, Booster, Zip..."
                placeholderTextColor={colors.textSecondary}
                value={formModel}
                onChangeText={setFormModel}
              />

              <View style={styles.row}>
                <View style={styles.halfInput}>
                  <Text style={[styles.inputLabel, { color: colors.text }]}>Année *</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.textSecondary }]}
                    placeholder="2020"
                    placeholderTextColor={colors.textSecondary}
                    value={formYear}
                    onChangeText={setFormYear}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.halfInput}>
                  <Text style={[styles.inputLabel, { color: colors.text }]}>Kilométrage *</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.textSecondary }]}
                    placeholder="5000"
                    placeholderTextColor={colors.textSecondary}
                    value={formMileage}
                    onChangeText={setFormMileage}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <Text style={[styles.inputLabel, { color: colors.text }]}>Type moteur *</Text>
              <View style={styles.engineTypeRow}>
                <TouchableOpacity
                  style={[
                    styles.engineTypeButton,
                    { backgroundColor: formEngineType === '4T' ? colors.primary : colors.background }
                  ]}
                  onPress={() => setFormEngineType('4T')}
                >
                  <Text style={[styles.engineTypeText, { color: formEngineType === '4T' ? '#fff' : colors.text }]}>
                    4 Temps
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.engineTypeButton,
                    { backgroundColor: formEngineType === '2T' ? colors.primary : colors.background }
                  ]}
                  onPress={() => setFormEngineType('2T')}
                >
                  <Text style={[styles.engineTypeText, { color: formEngineType === '2T' ? '#fff' : colors.text }]}>
                    2 Temps
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={[styles.sectionTitle, { color: colors.text }]}>Historique entretien</Text>

              <Text style={[styles.inputLabel, { color: colors.text }]}>Dernière vidange (km)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.textSecondary }]}
                placeholder="Ex: 4500"
                placeholderTextColor={colors.textSecondary}
                value={formLastOilKm}
                onChangeText={setFormLastOilKm}
                keyboardType="numeric"
              />

              <Text style={[styles.inputLabel, { color: colors.text }]}>Dernière courroie (km)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.textSecondary }]}
                placeholder="Ex: 3000"
                placeholderTextColor={colors.textSecondary}
                value={formLastBeltKm}
                onChangeText={setFormLastBeltKm}
                keyboardType="numeric"
              />
            </ScrollView>

            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: colors.primary }]}
              onPress={saveVehicle}
            >
              <Text style={styles.saveButtonText}>Enregistrer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Problem Detail Modal */}
      <Modal visible={!!showProblemDetail} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]} numberOfLines={2}>
                {showProblemDetail?.symptom}
              </Text>
              <TouchableOpacity onPress={() => setShowProblemDetail(null)}>
                <Ionicons name="close" size={28} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              <Text style={[styles.causesTitle, { color: colors.text }]}>Causes possibles :</Text>
              {showProblemDetail?.causes.map((cause, index) => (
                <View
                  key={index}
                  style={[styles.causeCard, { backgroundColor: colors.background }]}
                >
                  <View style={styles.causeHeader}>
                    <Text style={[styles.causeName, { color: colors.text }]}>{cause.cause}</Text>
                    <View style={[styles.difficultyBadge, { backgroundColor: getDifficultyColor(cause.difficulty) + '20' }]}>
                      <Text style={[styles.difficultyText, { color: getDifficultyColor(cause.difficulty) }]}>
                        {cause.difficulty}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.solutionText, { color: colors.textSecondary }]}>
                    💡 {cause.solution}
                  </Text>
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
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  authRequired: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  authTitle: { fontSize: 24, fontWeight: 'bold', marginTop: 16 },
  authSubtitle: { fontSize: 16, textAlign: 'center', marginTop: 8, marginBottom: 24 },
  authButton: { paddingVertical: 14, paddingHorizontal: 32, borderRadius: 12 },
  authButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, margin: 16, borderRadius: 16 },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  vehicleCard: { flexDirection: 'row', alignItems: 'center', margin: 16, marginTop: 0, padding: 16, borderRadius: 16 },
  vehicleIcon: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
  vehicleInfo: { flex: 1, marginLeft: 16 },
  vehicleName: { fontSize: 18, fontWeight: 'bold' },
  vehicleDetails: { fontSize: 14, marginTop: 4 },
  addVehicleCard: { margin: 16, marginTop: 0, padding: 24, borderRadius: 16, alignItems: 'center', borderWidth: 2, borderStyle: 'dashed' },
  addVehicleText: { fontSize: 18, fontWeight: 'bold', marginTop: 12 },
  addVehicleSubtext: { fontSize: 14, marginTop: 4 },
  tabsContainer: { flexDirection: 'row', marginHorizontal: 16, borderRadius: 12, overflow: 'hidden', backgroundColor: 'rgba(0,0,0,0.1)' },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, gap: 6, borderRadius: 12 },
  tabText: { fontSize: 13, fontWeight: '600' },
  content: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  emptyCard: { padding: 32, borderRadius: 16, alignItems: 'center' },
  emptyText: { fontSize: 16, fontWeight: '600', marginTop: 12 },
  tipCard: { flexDirection: 'row', padding: 16, borderRadius: 16, marginBottom: 12, borderLeftWidth: 4 },
  tipIcon: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  tipContent: { flex: 1, marginLeft: 12 },
  tipTitle: { fontSize: 16, fontWeight: 'bold' },
  tipDescription: { fontSize: 14, marginTop: 4, lineHeight: 20 },
  tipAction: { marginTop: 8, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, alignSelf: 'flex-start' },
  tipActionText: { fontSize: 13, fontWeight: '600' },
  problemCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, marginBottom: 12 },
  problemIcon: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  problemContent: { flex: 1, marginLeft: 12 },
  problemTitle: { fontSize: 15, fontWeight: '600' },
  problemSubtitle: { fontSize: 13, marginTop: 2 },
  aiCard: { padding: 16, borderRadius: 16, marginBottom: 16 },
  aiHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  aiTitle: { fontSize: 18, fontWeight: 'bold' },
  aiSubtitle: { fontSize: 14, marginBottom: 16 },
  aiInput: { borderWidth: 1, borderRadius: 12, padding: 16, fontSize: 16, minHeight: 80, textAlignVertical: 'top', marginBottom: 12 },
  aiButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 12, gap: 8 },
  aiButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  aiAnswerCard: { padding: 16, borderRadius: 16, marginBottom: 16 },
  aiAnswerHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  aiAnswerTitle: { fontSize: 16, fontWeight: 'bold' },
  aiAnswerText: { fontSize: 15, lineHeight: 22 },
  historySection: { marginTop: 8 },
  historyTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 12 },
  historyItem: { padding: 12, borderRadius: 12, marginBottom: 8 },
  historyQuestion: { fontSize: 14, fontWeight: '600' },
  historyAnswer: { fontSize: 13, marginTop: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { maxHeight: '90%', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', flex: 1 },
  modalContent: { maxHeight: 500 },
  inputLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8, marginTop: 12 },
  input: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 16 },
  brandScroll: { marginBottom: 8 },
  brandChip: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, marginRight: 8 },
  brandChipText: { fontSize: 14, fontWeight: '500' },
  row: { flexDirection: 'row', gap: 12 },
  halfInput: { flex: 1 },
  engineTypeRow: { flexDirection: 'row', gap: 12 },
  engineTypeButton: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center' },
  engineTypeText: { fontSize: 16, fontWeight: '600' },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', marginTop: 24, marginBottom: 4 },
  saveButton: { padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  causesTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 12 },
  causeCard: { padding: 16, borderRadius: 12, marginBottom: 12 },
  causeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  causeName: { fontSize: 15, fontWeight: '600', flex: 1 },
  difficultyBadge: { paddingVertical: 4, paddingHorizontal: 12, borderRadius: 12 },
  difficultyText: { fontSize: 12, fontWeight: '600' },
  solutionText: { fontSize: 14, lineHeight: 20 },
});
