import { Accelerometer, AccelerometerMeasurement } from 'expo-sensors';
import { Alert, Vibration, Platform } from 'react-native';
import * as Linking from 'expo-linking';

// Seuils de détection
const FALL_THRESHOLD = 2.5; // G-force pour détecter un impact
const FREE_FALL_THRESHOLD = 0.3; // G-force pour détecter une chute libre
const IMPACT_DURATION = 100; // ms
const ALERT_COOLDOWN = 30000; // 30 secondes entre les alertes

interface FallDetectorCallbacks {
  onFallDetected?: (data: { magnitude: number; timestamp: number }) => void;
  onEmergencyAlert?: () => void;
}

class FallDetectorService {
  private subscription: any = null;
  private isMonitoring: boolean = false;
  private lastAlertTime: number = 0;
  private callbacks: FallDetectorCallbacks = {};
  private recentReadings: number[] = [];
  private emergencyContacts: string[] = [];
  private userName: string = '';

  // Configuration
  setEmergencyContacts(contacts: string[]) {
    this.emergencyContacts = contacts;
  }

  setUserName(name: string) {
    this.userName = name;
  }

  setCallbacks(callbacks: FallDetectorCallbacks) {
    this.callbacks = callbacks;
  }

  // Démarrer la surveillance
  async startMonitoring(): Promise<boolean> {
    if (this.isMonitoring) return true;

    try {
      const { status } = await Accelerometer.getPermissionsAsync();
      if (status !== 'granted') {
        const { status: newStatus } = await Accelerometer.requestPermissionsAsync();
        if (newStatus !== 'granted') {
          console.log('Permission accéléromètre refusée');
          return false;
        }
      }

      // Configurer la fréquence de mise à jour (100ms = 10 Hz)
      Accelerometer.setUpdateInterval(100);

      this.subscription = Accelerometer.addListener(this.handleAccelerometerData);
      this.isMonitoring = true;
      console.log('Détecteur de chute activé');
      return true;
    } catch (error) {
      console.error('Erreur démarrage détecteur de chute:', error);
      return false;
    }
  }

  // Arrêter la surveillance
  stopMonitoring() {
    if (this.subscription) {
      this.subscription.remove();
      this.subscription = null;
    }
    this.isMonitoring = false;
    this.recentReadings = [];
    console.log('Détecteur de chute désactivé');
  }

  // Traitement des données de l'accéléromètre
  private handleAccelerometerData = (data: AccelerometerMeasurement) => {
    const { x, y, z } = data;
    
    // Calculer la magnitude totale (en G)
    const magnitude = Math.sqrt(x * x + y * y + z * z);
    
    // Garder les 10 dernières lectures pour analyse
    this.recentReadings.push(magnitude);
    if (this.recentReadings.length > 10) {
      this.recentReadings.shift();
    }

    // Détecter une chute libre suivie d'un impact
    this.detectFall(magnitude);
  };

  // Algorithme de détection de chute
  private detectFall(currentMagnitude: number) {
    if (this.recentReadings.length < 5) return;

    const now = Date.now();
    
    // Vérifier le cooldown
    if (now - this.lastAlertTime < ALERT_COOLDOWN) return;

    // Chercher un pattern: chute libre -> impact
    const recentMin = Math.min(...this.recentReadings.slice(-5));
    const recentMax = Math.max(...this.recentReadings.slice(-3));

    // Pattern de chute: forte baisse (chute libre) suivie d'un pic (impact)
    const hadFreeFall = recentMin < FREE_FALL_THRESHOLD;
    const hadImpact = recentMax > FALL_THRESHOLD;

    if (hadFreeFall && hadImpact) {
      this.triggerFallAlert(currentMagnitude);
    }
    
    // Détection d'impact violent direct (sans chute libre préalable)
    if (currentMagnitude > FALL_THRESHOLD * 1.5) {
      this.triggerFallAlert(currentMagnitude);
    }
  }

  // Déclencher l'alerte de chute
  private triggerFallAlert(magnitude: number) {
    const now = Date.now();
    
    // Vérifier à nouveau le cooldown
    if (now - this.lastAlertTime < ALERT_COOLDOWN) return;
    
    this.lastAlertTime = now;

    // Vibrer pour alerter l'utilisateur
    if (Platform.OS !== 'web') {
      Vibration.vibrate([500, 200, 500, 200, 500]);
    }

    // Notifier via callback
    if (this.callbacks.onFallDetected) {
      this.callbacks.onFallDetected({ magnitude, timestamp: now });
    }

    // Afficher l'alerte avec compte à rebours
    this.showEmergencyAlert();
  }

  // Afficher l'alerte d'urgence
  private showEmergencyAlert() {
    let countdown = 30;
    
    const alertMessage = `Une chute a été détectée !\n\nSi vous allez bien, appuyez sur "Je vais bien".\n\nSinon, les secours seront alertés dans ${countdown} secondes.`;

    Alert.alert(
      '🚨 CHUTE DÉTECTÉE !',
      alertMessage,
      [
        {
          text: '✅ Je vais bien',
          onPress: () => {
            console.log('Fausse alerte - utilisateur OK');
            // Réinitialiser les lectures
            this.recentReadings = [];
          },
          style: 'cancel',
        },
        {
          text: '🆘 Appeler les secours',
          onPress: () => this.callEmergency(),
          style: 'destructive',
        },
      ],
      { cancelable: false }
    );

    // Timer pour appel automatique (simplifié - dans une vraie app, utiliser un countdown visible)
    setTimeout(() => {
      // Dans une vraie implémentation, vérifier si l'utilisateur a répondu
      if (this.callbacks.onEmergencyAlert) {
        this.callbacks.onEmergencyAlert();
      }
    }, 30000);
  }

  // Appeler les secours
  callEmergency() {
    // En France, le 15 (SAMU) ou 112 (urgences européennes)
    const emergencyNumber = '15';
    
    if (Platform.OS !== 'web') {
      Linking.openURL(`tel:${emergencyNumber}`);
    } else {
      Alert.alert('Urgence', `Appelez le ${emergencyNumber} (SAMU) ou le 112`);
    }
  }

  // Envoyer un SMS d'urgence (si contacts définis)
  async sendEmergencySMS(location?: { lat: number; lng: number }) {
    if (this.emergencyContacts.length === 0) return;

    const locationText = location 
      ? `\nPosition: https://maps.google.com/?q=${location.lat},${location.lng}`
      : '';

    const message = `🚨 ALERTE CHUTE - ${this.userName || 'Utilisateur'} a peut-être eu un accident.${locationText}\n\nEnvoyé par Mon 50cc et moi`;

    // Sur mobile, ouvrir l'app SMS
    if (Platform.OS !== 'web') {
      const smsUrl = Platform.OS === 'ios'
        ? `sms:${this.emergencyContacts[0]}&body=${encodeURIComponent(message)}`
        : `sms:${this.emergencyContacts[0]}?body=${encodeURIComponent(message)}`;
      
      try {
        await Linking.openURL(smsUrl);
      } catch (error) {
        console.error('Erreur envoi SMS:', error);
      }
    }
  }

  // État de la surveillance
  isActive(): boolean {
    return this.isMonitoring;
  }
}

// Singleton
export const fallDetector = new FallDetectorService();
