/**
 * voice-phrases.js — Dictionnaire des phrases prononcées par Nexus Atlas.
 *
 * Avant (corrigé le 7/11/2026) : quand le téléphone n'était pas réglé en français, chaque
 * phrase partait vers un service de traduction Google non officiel (lent, impossible hors
 * connexion, contraire à l'objectif « zéro Google »). Désormais les phrases sont traduites
 * une fois pour toutes ici, et les voix du téléphone les prononcent, même hors connexion.
 *
 * Ajouter une phrase : l'écrire en français dans le code (speak("…")), puis ajouter sa
 * traduction ici. Le test tests/voice-phrases.test.js signale toute phrase oubliée.
 * Ajouter une langue : ajouter son code à VOICE_LANGUAGES et une colonne à chaque entrée.
 */

export const VOICE_LANGUAGES = ["fr", "en", "es"];

/** Phrases fixes : texte français exact → traductions. */
export const PHRASES = {
  // --- Démarrage, GPS, connexion ---
  "Systèmes opérationnels. Bonne route sur mon 50cc et moi.": { en: "Systems operational. Ride safe with mon 50cc et moi.", es: "Sistemas operativos. Buen viaje con mon 50cc et moi." },
  "L'application nécessite l'accès à votre position pour fonctionner.": { en: "The app needs access to your location to work.", es: "La aplicación necesita acceder a su ubicación para funcionar." },
  "Nouvelle tentative de localisation GPS.": { en: "Retrying GPS location.", es: "Nuevo intento de localización GPS." },
  "Le GPS est bloqué. Vérifiez les permissions de l'application.": { en: "GPS is blocked. Check the app permissions.", es: "El GPS está bloqueado. Compruebe los permisos de la aplicación." },
  "Le GPS est bloqué. Vérifiez les permissions.": { en: "GPS is blocked. Check the permissions.", es: "El GPS está bloqueado. Compruebe los permisos." },
  "Recherche de votre position GPS. L'itinéraire démarrera automatiquement dès que possible.": { en: "Searching for your GPS position. The route will start automatically as soon as possible.", es: "Buscando su posición GPS. La ruta comenzará automáticamente en cuanto sea posible." },
  "Signal GPS insuffisant pour démarrer l'itinéraire.": { en: "GPS signal too weak to start the route.", es: "Señal GPS insuficiente para iniciar la ruta." },
  "Signal GPS récupéré.": { en: "GPS signal recovered.", es: "Señal GPS recuperada." },
  "Signal perdu. Mode tunnel activé, navigation mathématique en cours.": { en: "Signal lost. Tunnel mode on, estimating your position.", es: "Señal perdida. Modo túnel activado, estimando su posición." },
  "GPS requis pour trouver les garages.": { en: "GPS is needed to find garages.", es: "Se necesita el GPS para encontrar talleres." },
  "Mode hors-ligne activé.": { en: "Offline mode on.", es: "Modo sin conexión activado." },
  "Connexion rétablie.": { en: "Connection restored.", es: "Conexión restablecida." },
  "Veuillez vous connecter": { en: "Please sign in", es: "Inicie sesión, por favor" },
  "Carte en cours de chargement, veuillez patienter.": { en: "The map is loading, please wait.", es: "El mapa se está cargando, espere por favor." },
  "Mode économie d'énergie Ultra Max activé. Passage en navigation hors ligne.": { en: "Ultra Max power saving on. Switching to offline navigation.", es: "Ahorro de energía Ultra Max activado. Cambio a navegación sin conexión." },
  "Conformité internationale validée. Bienvenue.": { en: "International compliance confirmed. Welcome.", es: "Conformidad internacional validada. Bienvenido." },
  "Paramètres de confidentialité enregistrés. Bienvenue dans la communauté.": { en: "Privacy settings saved. Welcome to the community.", es: "Ajustes de privacidad guardados. Bienvenido a la comunidad." },
  "À vos ordres, pilote.": { en: "At your command, rider.", es: "A sus órdenes, piloto." },

  // --- Navigation ---
  "Lieu de départ introuvable.": { en: "Starting point not found.", es: "No se encuentra el punto de partida." },
  "Destination introuvable.": { en: "Destination not found.", es: "Destino no encontrado." },
  "Erreur de calcul d'itinéraire.": { en: "Route calculation error.", es: "Error al calcular la ruta." },
  "Impossible de calculer l'itinéraire pour le moment. Vérifiez votre connexion.": { en: "Unable to calculate the route right now. Check your connection.", es: "No se puede calcular la ruta por ahora. Compruebe su conexión." },
  "Info trafic désactivée.": { en: "Traffic info off.", es: "Información de tráfico desactivada." },
  "Info trafic activée.": { en: "Traffic info on.", es: "Información de tráfico activada." },
  "Mode nuit activé.": { en: "Night mode on.", es: "Modo nocturno activado." },
  "Retiré des favoris.": { en: "Removed from favourites.", es: "Eliminado de favoritos." },
  "Ajouté aux favoris !": { en: "Added to favourites!", es: "¡Añadido a favoritos!" },
  "Itinéraire partagé avec la communauté. Merci pour votre contribution !": { en: "Route shared with the community. Thanks for your contribution!", es: "Ruta compartida con la comunidad. ¡Gracias por su aportación!" },
  "Calcul d'une boucle d'exploration tactique aléatoire.": { en: "Calculating a random exploration loop.", es: "Calculando un circuito de exploración aleatorio." },
  "Mode Sensation activé. Je vais chercher les routes les plus sinueuses pour un maximum de plaisir de conduite.": { en: "Thrill mode on. I will look for the twistiest roads for maximum riding fun.", es: "Modo sensación activado. Buscaré las carreteras más sinuosas para disfrutar al máximo." },
  "Mode Sensation désactivé. Retour à la navigation la plus rapide.": { en: "Thrill mode off. Back to the fastest route.", es: "Modo sensación desactivado. Vuelta a la ruta más rápida." },
  "Navigation autonome engagée. Connexion aux infrastructures de la ville.": { en: "Autonomous navigation engaged. Connecting to city infrastructure.", es: "Navegación autónoma activada. Conectando con las infraestructuras de la ciudad." },
  "Prédiction annulée. Mode manuel activé.": { en: "Prediction cancelled. Manual mode on.", es: "Predicción cancelada. Modo manual activado." },
  "Vitesse excessive pour un 50cc. Ralentissez à 42 km heure pour attraper la vague verte.": { en: "Too fast for a 50cc. Slow down to 42 km per hour to catch the green wave.", es: "Velocidad excesiva para un 50cc. Reduzca a 42 km por hora para coger la onda verde." },
  "Système optique enclenché. Affichage tête haute opérationnel. Attention, ce mode consomme beaucoup d'énergie, veuillez brancher le téléphone si possible.": { en: "Optical system engaged. Head-up display ready. This mode uses a lot of battery, please plug in your phone if you can.", es: "Sistema óptico activado. Pantalla de visualización frontal lista. Este modo consume mucha batería, conecte el teléfono si puede." },
  "Affichage tête haute désactivé. Retour à la navigation standard.": { en: "Head-up display off. Back to standard navigation.", es: "Pantalla frontal desactivada. Vuelta a la navegación estándar." },
  "Mode Projection Pare-brise activé.": { en: "Windscreen projection mode on.", es: "Modo de proyección en el parabrisas activado." },
  "Mode HUD Standard activé.": { en: "Standard HUD mode on.", es: "Modo HUD estándar activado." },
  "Réalité Augmentée activée. Superposition de navigation HUD en ligne.": { en: "Augmented reality on. Navigation overlay ready.", es: "Realidad aumentada activada. Superposición de navegación lista." },
  "Réalité Augmentée activée.": { en: "Augmented reality on.", es: "Realidad aumentada activada." },
  "Réalité Augmentée désactivée.": { en: "Augmented reality off.", es: "Realidad aumentada desactivada." },
  "Erreur d'accès à la caméra pour la réalité augmentée.": { en: "Camera access error for augmented reality.", es: "Error de acceso a la cámara para la realidad aumentada." },
  "Vision nocturne activée. Optimisation des contrastes route.": { en: "Night vision on. Optimising road contrast.", es: "Visión nocturna activada. Optimizando el contraste de la carretera." },
  "Vision nocturne désactivée.": { en: "Night vision off.", es: "Visión nocturna desactivada." },

  // --- Profils véhicule ---
  "Profil Trottinette Électrique configuré. Vitesse légale 25 km/h. Pistes cyclables prioritaires.": { en: "E-scooter profile set. Legal speed 25 km/h. Cycle lanes preferred.", es: "Perfil de patinete eléctrico configurado. Velocidad legal 25 km/h. Carriles bici preferentes." },
  "Profil Vélo et VAE configuré. Pistes cyclables prioritaires. Bonne route !": { en: "Bike and e-bike profile set. Cycle lanes preferred. Ride safe!", es: "Perfil de bicicleta y bici eléctrica configurado. Carriles bici preferentes. ¡Buen viaje!" },
  "Profil Voiture Sans Permis configuré. Voies rapides interdites.": { en: "Microcar profile set. Expressways excluded.", es: "Perfil de coche sin carné configurado. Vías rápidas excluidas." },
  "Profil véhicule sauvegardé. Prêt pour le départ.": { en: "Vehicle profile saved. Ready to go.", es: "Perfil del vehículo guardado. Listo para salir." },
  "Mode Trottinette Électrique. Empruntez les pistes cyclables. Vitesse maximale 25 km/h.": { en: "E-scooter mode. Use the cycle lanes. Maximum speed 25 km/h.", es: "Modo patinete eléctrico. Use los carriles bici. Velocidad máxima 25 km/h." },
  "Mode Vélo activé. Privilégiez les aménagements cyclables.": { en: "Bike mode on. Prefer cycle facilities.", es: "Modo bicicleta activado. Priorice las vías ciclistas." },
  "Mode Voiturette détecté. Temps de trajet ajusté car vous ne pouvez pas remonter les files de trafic.": { en: "Microcar mode detected. Travel time adjusted because you cannot filter through traffic.", es: "Modo coche sin carné detectado. Tiempo de trayecto ajustado porque no puede adelantar entre las filas." },
  "Mode Duo détecté. Le temps de trajet a été augmenté pour anticiper la perte de puissance en montée.": { en: "Two-up mode detected. Travel time increased to allow for lost power uphill.", es: "Modo con pasajero detectado. Se ha aumentado el tiempo de trayecto por la pérdida de potencia en las subidas." },
  "Mode rodage activé. Ménagez votre moteur.": { en: "Break-in mode on. Go easy on your engine.", es: "Modo rodaje activado. Cuide su motor." },
  "Mode Rodage activé.": { en: "Break-in mode on.", es: "Modo rodaje activado." },
  "Alerte Verglas et adhérence réduite détectée. Grip en dessous de 50 pour cent.": { en: "Black ice and reduced grip detected. Grip below 50 percent.", es: "Hielo y adherencia reducida detectados. Agarre por debajo del 50 por ciento." },
  "Mode Rodage désactivé.": { en: "Break-in mode off.", es: "Modo rodaje desactivado." },
  "Mode Éco activé pour des performances optimales.": { en: "Eco mode on for optimal performance.", es: "Modo eco activado para un rendimiento óptimo." },
  "Mode Éco Performances activé.": { en: "Eco performance mode on.", es: "Modo eco rendimiento activado." },
  "Mode Performances Maximales activé.": { en: "Maximum performance mode on.", es: "Modo de máximo rendimiento activado." },

  // --- Sécurité, Ange Gardien, SOS ---
  "Guardian Mode activé.": { en: "Guardian mode on.", es: "Modo guardián activado." },
  "Guardian Mode désactivé.": { en: "Guardian mode off.", es: "Modo guardián desactivado." },
  "Guardian Mode : Alerte d'immobilité. Êtes-vous toujours là ?": { en: "Guardian mode: no movement detected. Are you still there?", es: "Modo guardián: alerta de inmovilidad. ¿Sigue ahí?" },
  "Alerte Ange Gardien. Vous êtes à l'arrêt depuis longtemps. Tout va bien ?": { en: "Guardian Angel alert. You have been stopped for a long time. Are you OK?", es: "Alerta del Ángel Guardián. Lleva mucho tiempo parado. ¿Va todo bien?" },
  "Ravi de l'entendre. Bonne route.": { en: "Glad to hear it. Ride safe.", es: "Me alegra oírlo. Buen viaje." },
  "Trajet habituel détecté. Ange Gardien activé automatiquement.": { en: "Usual trip detected. Guardian Angel switched on automatically.", es: "Trayecto habitual detectado. Ángel Guardián activado automáticamente." },
  "Contact d'urgence enregistré.": { en: "Emergency contact saved.", es: "Contacto de emergencia guardado." },
  "Alerte de collision majeure détectée. Appel des secours dans 15 secondes.": { en: "Major collision detected. Calling emergency services in 15 seconds.", es: "Colisión grave detectada. Llamada a emergencias en 15 segundos." },
  "Alerte de collision annulée. Restez prudent.": { en: "Collision alert cancelled. Stay careful.", es: "Alerta de colisión cancelada. Tenga cuidado." },
  "ALERTE SOS LANÇÉE. Transfert des données aux secours.": { en: "SOS ALERT SENT. Sharing data with emergency services.", es: "ALERTA SOS ENVIADA. Transmitiendo los datos a emergencias." },
  "SOS Manuel activé. Alerte de la meute et de l'Ange Gardien.": { en: "Manual SOS on. Alerting the pack and the Guardian Angel.", es: "SOS manual activado. Alertando a la manada y al Ángel Guardián." },
  "Chute détectée. Annulez si vous allez bien, sinon les secours seront prévenus.": { en: "Fall detected. Cancel if you are OK, otherwise help will be called.", es: "Caída detectada. Cancele si está bien; si no, se avisará a emergencias." },
  "Alerte critique. Chute détectée. Vous avez 10 secondes pour annuler avant l'envoi des secours.": { en: "Critical alert. Fall detected. You have 10 seconds to cancel before help is sent.", es: "Alerta crítica. Caída detectada. Tiene 10 segundos para cancelar antes de avisar a emergencias." },
  "Délai expiré. Protocole SOS engagé. Alerte envoyée à la communauté.": { en: "Time is up. SOS protocol started. Alert sent to the community.", es: "Tiempo agotado. Protocolo SOS iniciado. Alerta enviada a la comunidad." },
  "Alerte annulée. Reprise de la navigation.": { en: "Alert cancelled. Resuming navigation.", es: "Alerta cancelada. Reanudando la navegación." },
  "Alerte annulée.": { en: "Alert cancelled.", es: "Alerta cancelada." },
  "Alerte de détresse envoyée à la communauté.": { en: "Distress alert sent to the community.", es: "Alerta de socorro enviada a la comunidad." },
  "Rythme cardiaque élevé détecté. Respirez calmement pour votre sécurité.": { en: "High heart rate detected. Breathe calmly for your safety.", es: "Frecuencia cardíaca alta detectada. Respire con calma por su seguridad." },
  "Mode furtif activé. Concentration maximale.": { en: "Stealth mode on. Full focus.", es: "Modo sigiloso activado. Máxima concentración." },
  "Vigilance rouge détectée. Vous roulez depuis 45 minutes supplémentaires. Nexus Atlas vous demande d'effectuer une pause immédiate et de vous hydrater abondamment !": { en: "Red alert. You have been riding for another 45 minutes. Nexus Atlas asks you to take a break now and drink plenty of water!", es: "Alerta roja. Lleva 45 minutos más conduciendo. ¡Nexus Atlas le pide que haga una pausa ahora mismo y beba mucha agua!" },
  "Vous roulez depuis 45 minutes. Température moteur optimale atteinte, mais attention à la fatigue. Envisagez une pause bientôt.": { en: "You have been riding for 45 minutes. The engine is at optimal temperature, but watch out for fatigue. Consider a break soon.", es: "Lleva 45 minutos conduciendo. El motor está a temperatura óptima, pero cuidado con el cansancio. Piense en hacer una pausa pronto." },

  // --- Antivol, parking, sentinelle ---
  "Mode Sentinelle activé. Périmètre sécurisé. Je surveille l'accéléromètre.": { en: "Sentinel mode on. Perimeter secured. I am monitoring the accelerometer.", es: "Modo centinela activado. Perímetro asegurado. Vigilo el acelerómetro." },
  "Mode Sentinelle désactivé.": { en: "Sentinel mode off.", es: "Modo centinela desactivado." },
  "ALERTE : Mouvement suspect détecté. Enregistrement Sentinel activé.": { en: "ALERT: suspicious movement detected. Sentinel recording started.", es: "ALERTA: movimiento sospechoso detectado. Grabación centinela activada." },
  "Mode parking activé. Votre scooter est sous surveillance.": { en: "Parking mode on. Your scooter is being watched.", es: "Modo aparcamiento activado. Su scooter está vigilado." },
  "Mode parking désactivé.": { en: "Parking mode off.", es: "Modo aparcamiento desactivado." },
  "ALERTE ! Mouvement suspect détecté !": { en: "ALERT! Suspicious movement detected!", es: "¡ALERTA! ¡Movimiento sospechoso detectado!" },

  // --- Dangers et météo ---
  "Merci, signalement mis à jour.": { en: "Thank you, report updated.", es: "Gracias, aviso actualizado." },
  "Merci de votre vigilance.": { en: "Thank you for staying alert.", es: "Gracias por su atención." },
  "Signalement validé. Vous gagnez de l'expérience.": { en: "Report confirmed. You gain experience.", es: "Aviso validado. Gana experiencia." },
  "Alerte choc violent détecté. Signalement automatique de route dégradée envoyé à la communauté.": { en: "Violent impact detected. A damaged-road report has been sent to the community automatically.", es: "Impacto violento detectado. Se ha enviado automáticamente un aviso de carretera en mal estado a la comunidad." },
  "Attention, zone rouge détectée. Risque d'accident élevé, ralentissez.": { en: "Caution, red zone detected. High accident risk, slow down.", es: "Atención, zona roja detectada. Riesgo alto de accidente, reduzca la velocidad." },
  "Attention, nid-de-poule signalé devant vous.": { en: "Caution, pothole reported ahead.", es: "Atención, bache señalado delante." },
  "Prudence, route avec gravillons à proximité.": { en: "Careful, loose gravel nearby.", es: "Precaución, gravilla en la carretera cerca." },
  "Attention, chaussée glissante signalée.": { en: "Caution, slippery road reported.", es: "Atención, calzada resbaladiza señalada." },
  "Zone de travaux signalée sur votre itinéraire.": { en: "Roadworks reported on your route.", es: "Obras señaladas en su ruta." },
  "Accident signalé devant vous. Réduisez votre vitesse.": { en: "Accident reported ahead. Slow down.", es: "Accidente señalado delante. Reduzca la velocidad." },
  "Contrôle de police signalé à proximité.": { en: "Police check reported nearby.", es: "Control policial señalado cerca." },
  "Animal signalé sur la chaussée, ralentissez.": { en: "Animal reported on the road, slow down.", es: "Animal señalado en la calzada, reduzca la velocidad." },
  "Route inondée signalée. Évitez cette zone.": { en: "Flooded road reported. Avoid this area.", es: "Carretera inundada señalada. Evite esta zona." },
  "Alerte de sécurité absolue. Vigilance Rouge Météo France en cours.": { en: "Maximum safety alert. Météo-France red warning in force.", es: "Alerta de seguridad máxima. Alerta roja de Météo-France en curso." },
  "VIGILANCE ROUGE DÉTECTÉE : Conditions météorologiques extrêmes.": { en: "RED ALERT: extreme weather conditions.", es: "ALERTA ROJA: condiciones meteorológicas extremas." },
  "Alerte météo. Pluie détectée sur votre itinéraire. Adhérence réduite, ralentissez.": { en: "Weather alert. Rain on your route. Reduced grip, slow down.", es: "Alerta meteorológica. Lluvia en su ruta. Menos adherencia, reduzca la velocidad." },
  "Alerte météo. Fortes rafales de vent. Maintenez fermement votre guidon.": { en: "Weather alert. Strong gusts of wind. Hold your handlebars firmly.", es: "Alerta meteorológica. Fuertes ráfagas de viento. Sujete bien el manillar." },
  "Alerte critique. Température proche de zéro. Risque extrême de verglas.": { en: "Critical alert. Temperature close to zero. Extreme risk of black ice.", es: "Alerta crítica. Temperatura cercana a cero. Riesgo extremo de hielo." },
  "Orage en cours sur votre secteur. Évitez de rouler si possible.": { en: "Thunderstorm in your area. Avoid riding if you can.", es: "Tormenta en su zona. Evite circular si es posible." },
  "Neige ou pluie verglaçante en cours. Route glissante : roulez très doucement.": { en: "Snow or freezing rain. Slippery road: ride very slowly.", es: "Nieve o lluvia helada. Carretera resbaladiza: circule muy despacio." },
  "Pluie en cours. Chaussée glissante : augmentez vos distances de sécurité.": { en: "It is raining. Slippery road: increase your following distance.", es: "Está lloviendo. Calzada resbaladiza: aumente la distancia de seguridad." },
  "Brouillard en cours. Allumez vos feux et réduisez votre vitesse.": { en: "Fog. Turn on your lights and slow down.", es: "Niebla. Encienda las luces y reduzca la velocidad." },
  "Trajet de nuit : vérifiez vos feux et portez un équipement visible.": { en: "Riding at night: check your lights and wear visible gear.", es: "Trayecto nocturno: compruebe las luces y lleve ropa visible." },
  "Pas de pluie actuellement sur votre secteur. Bonne route !": { en: "No rain in your area right now. Ride safe!", es: "Ahora mismo no llueve en su zona. ¡Buen viaje!" },

  // --- Communauté, radar, convoi ---
  "Pilote allié détecté dans le secteur.": { en: "Friendly rider detected nearby.", es: "Piloto aliado detectado en la zona." },
  "Nouvel allié détecté sur le radar.": { en: "New ally detected on the radar.", es: "Nuevo aliado detectado en el radar." },
  "Radar Social activé. Connexion au réseau des pilotes en cours.": { en: "Social radar on. Connecting to the riders' network.", es: "Radar social activado. Conectando con la red de pilotos." },
  "Radar Social désactivé.": { en: "Social radar off.", es: "Radar social desactivado." },
  "Radar social activé. Recherche des pilotes à proximité.": { en: "Social radar on. Looking for riders nearby.", es: "Radar social activado. Buscando pilotos cercanos." },
  "Radar social désactivé.": { en: "Social radar off.", es: "Radar social desactivado." },
  "Mode fantôme désactivé. Radar social actif.": { en: "Ghost mode off. Social radar on.", es: "Modo fantasma desactivado. Radar social activo." },
  "Mode fantôme activé. Vous êtes invisible.": { en: "Ghost mode on. You are invisible.", es: "Modo fantasma activado. Es invisible." },
  "Mode fantôme désactivé. Vous êtes visible.": { en: "Ghost mode off. You are visible.", es: "Modo fantasma desactivado. Es visible." },
  "Vous avez quitté le convoi.": { en: "You have left the convoy.", es: "Ha salido del convoy." },
  "Vous avez rejoint le groupe ! Vos amis apparaissent sur la carte.": { en: "You joined the group! Your friends appear on the map.", es: "¡Se ha unido al grupo! Sus amigos aparecen en el mapa." },
  "Pilote Xavier Le Chanu détecté. Salut motard transmis.": { en: "Rider Xavier Le Chanu detected. Biker wave sent.", es: "Piloto Xavier Le Chanu detectado. Saludo motero enviado." },
  "Merci pour votre note !": { en: "Thanks for your rating!", es: "¡Gracias por su valoración!" },
  "Félicitations, vous avez sécurisé un butin secret !": { en: "Congratulations, you secured a secret loot!", es: "¡Enhorabuena, ha conseguido un botín secreto!" },
  "Lien de parrainage détecté. Roulez pour débloquer vos premières récompenses !": { en: "Referral link detected. Ride to unlock your first rewards!", es: "Enlace de recomendación detectado. ¡Conduzca para desbloquear sus primeras recompensas!" },
  "Trajet parfait. Votre conduite prudente a rapporté un bonus à votre parrain !": { en: "Perfect trip. Your careful riding earned your sponsor a bonus!", es: "Trayecto perfecto. ¡Su conducción prudente ha dado un bono a su padrino!" },
  "Accès à votre espace fidélité.": { en: "Opening your loyalty area.", es: "Accediendo a su espacio de fidelidad." },
  "Vous avez gagné 12 points mon50cc pour ce trajet sécurisé.": { en: "You earned 12 mon50cc points for this safe trip.", es: "Ha ganado 12 puntos mon50cc por este trayecto seguro." },
  "Enregistrement du Roadbook démarré.": { en: "Roadbook recording started.", es: "Grabación del roadbook iniciada." },
  "Roadbook sauvegardé avec succès.": { en: "Roadbook saved.", es: "Roadbook guardado." },

  // --- Conduite, mécanique, garage ---
  "Trajet trop court pour analyser votre pilotage.": { en: "Trip too short to analyse your riding.", es: "Trayecto demasiado corto para analizar su conducción." },
  "Score de pilotage : Excellent. Conduite fluide et économe.": { en: "Riding score: excellent. Smooth and economical riding.", es: "Puntuación de conducción: excelente. Conducción fluida y económica." },
  "Score de pilotage : Bon. Attention aux accélérations brusques.": { en: "Riding score: good. Watch out for harsh acceleration.", es: "Puntuación de conducción: buena. Cuidado con las aceleraciones bruscas." },
  "Score de pilotage : Médiocre. Conduite trop agressive pour la mécanique.": { en: "Riding score: poor. Riding too aggressive for the engine.", es: "Puntuación de conducción: mediocre. Conducción demasiado agresiva para la mecánica." },
  "Génération de votre carte de score personnalisée.": { en: "Generating your personalised score card.", es: "Generando su tarjeta de puntuación personalizada." },
  "Données de télémétrie réinitialisées.": { en: "Telemetry data reset.", es: "Datos de telemetría restablecidos." },
  "Liaison télémétrique moteur établie.": { en: "Engine telemetry link established.", es: "Enlace de telemetría del motor establecido." },
  "Alerte : Connexion moteur perdue.": { en: "Alert: engine connection lost.", es: "Alerta: conexión con el motor perdida." },
  "Alerte ! Régime moteur critique. Ralentissez pour préserver le cylindre.": { en: "Alert! Critical engine speed. Slow down to protect the cylinder.", es: "¡Alerta! Régimen del motor crítico. Reduzca para proteger el cilindro." },
  "Alerte, surchauffe moteur détectée. Coupez le contact immédiatement.": { en: "Alert, engine overheating detected. Switch off the ignition now.", es: "Alerta, sobrecalentamiento del motor. Apague el contacto inmediatamente." },
  "Alerte O B D. Niveau de carburant critique, inférieur à 15 pourcents. Voulez-vous que je vous guide vers la station la plus proche ?": { en: "O B D alert. Fuel level critical, below 15 percent. Shall I guide you to the nearest station?", es: "Alerta O B D. Nivel de combustible crítico, por debajo del 15 por ciento. ¿Quiere que le guíe a la gasolinera más cercana?" },
  "Boîte noire matérielle connectée et synchronisée.": { en: "Hardware black box connected and synced.", es: "Caja negra conectada y sincronizada." },
  "Alerte: Perte de connexion avec la boîte noire.": { en: "Alert: connection to the black box lost.", es: "Alerta: conexión con la caja negra perdida." },
  "Rapport de boîte noire exporté avec succès.": { en: "Black box report exported.", es: "Informe de la caja negra exportado." },
  "Accès au microphone autorisé. Démarrez le moteur et donnez un coup de gaz franc.": { en: "Microphone access granted. Start the engine and give it a firm rev.", es: "Acceso al micrófono autorizado. Arranque el motor y dé un acelerón firme." },
  "Erreur. L'accès au microphone a été refusé.": { en: "Error. Microphone access was denied.", es: "Error. Se ha denegado el acceso al micrófono." },
  "Décibelmètre activé. Faites tourner le moteur au ralenti.": { en: "Sound meter on. Let the engine idle.", es: "Sonómetro activado. Deje el motor al ralentí." },
  "Erreur d'accès au microphone pour le décibelmètre.": { en: "Microphone access error for the sound meter.", es: "Error de acceso al micrófono para el sonómetro." },
  "Analyse terminée. Compte Premium détecté. Rapport expert offert.": { en: "Analysis complete. Premium account detected. Expert report included.", es: "Análisis terminado. Cuenta Premium detectada. Informe experto incluido." },
  "Analyse terminée. Rapport basique disponible.": { en: "Analysis complete. Basic report available.", es: "Análisis terminado. Informe básico disponible." },
  "Paiement validé. Rapport expert déverrouillé. Voici mon diagnostic.": { en: "Payment confirmed. Expert report unlocked. Here is my diagnosis.", es: "Pago validado. Informe experto desbloqueado. Este es mi diagnóstico." },
  "Date du contrôle technique enregistrée.": { en: "Roadworthiness test date saved.", es: "Fecha de la inspección técnica guardada." },
  "Disponibilité de l'atelier mise à jour.": { en: "Workshop availability updated.", es: "Disponibilidad del taller actualizada." },
  "Votre garage est maintenant visible des pilotes.": { en: "Your garage is now visible to riders.", es: "Su taller ahora es visible para los pilotos." },
  "Visibilité désactivée.": { en: "Visibility off.", es: "Visibilidad desactivada." },
  "Offre Flash publiée.": { en: "Flash offer published.", es: "Oferta flash publicada." },
  "Demande enregistrée.": { en: "Request saved.", es: "Solicitud registrada." },
  "Entretien certifié enregistré avec succès dans le cahier numérique du client.": { en: "Certified service saved to the customer's digital logbook.", es: "Mantenimiento certificado guardado en el libro digital del cliente." },
  "Votre fiche technique a été publiée avec succès ! Elle est maintenant visible par tous les pilotes.": { en: "Your technical sheet has been published! All riders can now see it.", es: "¡Su ficha técnica se ha publicado! Ahora la pueden ver todos los pilotos." },
  "Je ne trouve aucune station service répertoriée dans un rayon de 3 kilomètres.": { en: "I cannot find any listed fuel station within 3 kilometres.", es: "No encuentro ninguna gasolinera registrada en un radio de 3 kilómetros." },
  "Connexion au flux Open Data du gouvernement et récupération des prix en temps réel.": { en: "Connecting to the government open data feed and fetching live prices.", es: "Conectando con los datos abiertos del Gobierno y obteniendo los precios en tiempo real." },
  "Impossible de contacter le serveur gouvernemental. Veuillez réessayer plus tard.": { en: "Unable to reach the government server. Please try again later.", es: "No se puede contactar con el servidor del Gobierno. Inténtelo más tarde." },

  // --- Paiements, rapports, certificats ---
  "Alerte abonnement : Votre période d'essai gratuite est terminée.": { en: "Subscription alert: your free trial has ended.", es: "Aviso de suscripción: su período de prueba gratuito ha terminado." },
  "Vérification des tarifs en cours...": { en: "Checking prices...", es: "Comprobando las tarifas..." },
  "Initialisation du paiement sécurisé.": { en: "Starting secure payment.", es: "Iniciando el pago seguro." },
  "Initialisation du paiement sécurisé Revolut.": { en: "Starting secure Revolut payment.", es: "Iniciando el pago seguro con Revolut." },
  "Validation du paiement par le serveur, veuillez patienter...": { en: "The server is validating your payment, please wait...", es: "El servidor está validando el pago, espere por favor..." },
  "Paiement validé ! Vous êtes maintenant un Garage Certifié.": { en: "Payment confirmed! You are now a Certified Garage.", es: "¡Pago confirmado! Ahora es un Taller Certificado." },
  "Paiement Revolut validé. Génération de votre document.": { en: "Revolut payment confirmed. Generating your document.", es: "Pago con Revolut confirmado. Generando su documento." },
  "Paiement Revolut confirmé. Vérification en cours.": { en: "Revolut payment confirmed. Verifying.", es: "Pago con Revolut confirmado. Verificando." },
  "Le paiement a échoué.": { en: "The payment failed.", es: "El pago ha fallado." },
  "Paiement annulé.": { en: "Payment cancelled.", es: "Pago cancelado." },
  "Rapport débloqué avec succès.": { en: "Report unlocked.", es: "Informe desbloqueado." },
  "Rapport débloqué avec succès. Bonne route.": { en: "Report unlocked. Ride safe.", es: "Informe desbloqueado. Buen viaje." },
  "Génération du rapport PDF en cours. Il sera envoyé automatiquement à votre assurance.": { en: "Generating the PDF report. It will be sent to your insurer automatically.", es: "Generando el informe PDF. Se enviará automáticamente a su aseguradora." },
  "Coffre-fort créé. Transmettez ce code litige à votre assureur.": { en: "Vault created. Give this claim code to your insurer.", es: "Caja fuerte creada. Facilite este código de expediente a su aseguradora." },
  "Code dossier copié.": { en: "Case code copied.", es: "Código de expediente copiado." },
  "Génération de votre Certificat de Conformité Digital. Analyse des données de bord en cours.": { en: "Generating your Digital Compliance Certificate. Analysing on-board data.", es: "Generando su Certificado de Conformidad Digital. Analizando los datos de a bordo." },
  "Génération du certificat de batterie pour la revente.": { en: "Generating the battery certificate for resale.", es: "Generando el certificado de batería para la reventa." },
  "Connexion bancaire sécurisée pour l'achat du certificat.": { en: "Secure bank connection for the certificate purchase.", es: "Conexión bancaria segura para la compra del certificado." },
  "Caméra certifiée activée. Ciblez le dommage.": { en: "Certified camera on. Aim at the damage.", es: "Cámara certificada activada. Apunte al daño." },
  "Preuve horodatée certifiée et enregistrée dans votre galerie.": { en: "Time-stamped proof certified and saved to your gallery.", es: "Prueba con fecha y hora certificada y guardada en su galería." },
  "Document chiffré et enregistré dans votre coffre-fort numérique.": { en: "Document encrypted and saved in your digital vault.", es: "Documento cifrado y guardado en su caja fuerte digital." },
  "Vérification biométrique pour accès au coffre-fort.": { en: "Biometric check to open the vault.", es: "Verificación biométrica para acceder a la caja fuerte." },
  "Trajet terminé. Score écologique excellent. Certificat d'économie d'énergie généré avec succès.": { en: "Trip finished. Excellent eco score. Energy saving certificate generated.", es: "Trayecto terminado. Puntuación ecológica excelente. Certificado de ahorro de energía generado." },
  "Trajet terminé. Conduite trop agressive, aucun certificat carbone délivré.": { en: "Trip finished. Riding too aggressive, no carbon certificate issued.", es: "Trayecto terminado. Conducción demasiado agresiva, no se emite certificado de carbono." },
  "Accès à la salle de marché du carbone. Des mégacorporations attendent d'acheter vos certificats.": { en: "Entering the carbon trading room. Megacorporations are waiting to buy your certificates.", es: "Entrando en la sala de mercado del carbono. Megacorporaciones esperan para comprar sus certificados." },
  "Transaction validée. Certificats vendus aux industries polluantes. Fonds transférés sur votre portefeuille.": { en: "Transaction confirmed. Certificates sold to polluting industries. Funds transferred to your wallet.", es: "Transacción validada. Certificados vendidos a industrias contaminantes. Fondos transferidos a su cartera." },
  "Le marché des certificats carbone n'est pas encore ouvert.": { en: "The carbon certificate market is not open yet.", es: "El mercado de certificados de carbono aún no está abierto." },
  "La revente de certificats n'est pas encore disponible. Vos certificats sont conservés.": { en: "Selling certificates is not available yet. Your certificates are kept.", es: "La venta de certificados aún no está disponible. Sus certificados se conservan." },
  "Vous ne possédez aucun certificat à vendre.": { en: "You have no certificates to sell.", es: "No tiene ningún certificado para vender." },
  "Publication Facebook réussie.": { en: "Facebook post published.", es: "Publicación en Facebook realizada." },

  // --- Assistant, juridique, calendrier ---
  "Mode Défense Juridique activé. Règle numéro 1 : Ne reconnaissez aucun tort à l'oral. Règle numéro 2 : Prenez des photos de la situation et de la plaque adverse. Règle numéro 3 : Remplissez le constat factuellement. En cas de délit de fuite, relevez la plaque et contactez la police.": { en: "Legal defence mode on. Rule number 1: do not admit any fault out loud. Rule number 2: take photos of the scene and of the other vehicle's number plate. Rule number 3: fill in the accident report factually. In a hit-and-run, note the number plate and call the police.", es: "Modo de defensa jurídica activado. Regla número 1: no reconozca ninguna culpa de palabra. Regla número 2: haga fotos del lugar y de la matrícula del otro vehículo. Regla número 3: rellene el parte de forma objetiva. En caso de fuga, anote la matrícula y llame a la policía." },
  "Plaidoirie copiée dans le presse-papiers.": { en: "Statement copied to the clipboard.", es: "Alegato copiado en el portapapeles." },
  "Synchronisation Nexus Calendar en cours. Analyse de votre emploi du temps.": { en: "Syncing Nexus Calendar. Analysing your schedule.", es: "Sincronizando Nexus Calendar. Analizando su agenda." },
  "Permission micro refusée. Activez le micro dans les paramètres de l'application.": { en: "Microphone permission denied. Enable the microphone in the app settings.", es: "Permiso de micrófono denegado. Active el micrófono en los ajustes de la aplicación." },
  "Accès au micro refusé. Activez le micro dans les paramètres.": { en: "Microphone access denied. Enable the microphone in the settings.", es: "Acceso al micrófono denegado. Active el micrófono en los ajustes." },
  "Reconnaissance vocale désactivée.": { en: "Voice recognition off.", es: "Reconocimiento de voz desactivado." },
  "Reconnaissance vocale activée.": { en: "Voice recognition on.", es: "Reconocimiento de voz activado." },
  "Impossible de lancer la reconnaissance vocale. Désactivez le Mode Éco dans les paramètres pour utiliser Oracle.": { en: "Unable to start voice recognition. Turn off Eco mode in the settings to use Oracle.", es: "No se puede iniciar el reconocimiento de voz. Desactive el modo eco en los ajustes para usar Oracle." },

  // --- Modules « système » (HUD, SecBot…) ---
  "Signature neurale confirmée.": { en: "Neural signature confirmed.", es: "Firma neural confirmada." },
  "Impulsion tactique envoyée. Analyse de zone en cours.": { en: "Tactical pulse sent. Scanning the area.", es: "Pulso táctico enviado. Analizando la zona." },
  "Initialisation des diagnostics système Aegis.": { en: "Starting Aegis system diagnostics.", es: "Iniciando el diagnóstico del sistema Aegis." },
  "Diagnostic terminé. Tous les systèmes sont optimaux.": { en: "Diagnostics complete. All systems optimal.", es: "Diagnóstico terminado. Todos los sistemas son óptimos." },
  "Bouclier Neural activé. Incident enregistré dans la Blackbox.": { en: "Neural shield on. Incident logged in the black box.", es: "Escudo neural activado. Incidente registrado en la caja negra." },
  "SecBot activé. Périmètre de sécurité sous surveillance.": { en: "SecBot on. Security perimeter under watch.", es: "SecBot activado. Perímetro de seguridad vigilado." },
  "Lancement de l'audit de sécurité.": { en: "Starting the security audit.", es: "Iniciando la auditoría de seguridad." },
  "Audit terminé. Tous les systèmes sont étanches.": { en: "Audit complete. All systems are secure.", es: "Auditoría terminada. Todos los sistemas son seguros." },
  "Analyse réseau en cours.": { en: "Scanning the network.", es: "Analizando la red." },
  "Analyse réseau réussie. Connexion sécurisée.": { en: "Network scan complete. Connection secure.", es: "Análisis de red completado. Conexión segura." },
  "Vérification du bouclier anti-intrusion.": { en: "Checking the intrusion shield.", es: "Comprobando el escudo anti intrusión." },
  "Bouclier opérationnel.": { en: "Shield operational.", es: "Escudo operativo." },
  "Attention. Moteur d'évolution neuronale activé. L'application se réécrit elle-même.": { en: "Caution. Neural evolution engine on. The app is rewriting itself.", es: "Atención. Motor de evolución neuronal activado. La aplicación se reescribe a sí misma." },
  "Mutation terminée. Mon code source a évolué avec succès.": { en: "Mutation complete. My source code has evolved.", es: "Mutación terminada. Mi código fuente ha evolucionado." },

  // --- Lexique « standard » d'OracleEngine (clés ferry_ahead, start_guardian…) ---
  "Core Universel stabilisé. Liaison totale établie.": { en: "Universal core stabilised. Full link established.", es: "Núcleo universal estabilizado. Conexión total establecida." },
  "Alerte : Vitesse excessive. Ralentissez immédiatement.": { en: "Alert: excessive speed. Slow down now.", es: "Alerta: velocidad excesiva. Reduzca inmediatamente." },
  "ANALYSE : Menace identifiée. Prudence conseillée.": { en: "ANALYSIS: threat identified. Caution advised.", es: "ANÁLISIS: amenaza identificada. Se aconseja prudencia." },
  "Félicitations Pilote. Votre expérience a augmenté.": { en: "Congratulations, rider. Your experience has increased.", es: "Enhorabuena, piloto. Su experiencia ha aumentado." },
  "Ange Gardien activé. Surveillance périmétrique en cours.": { en: "Guardian Angel on. Watching over you.", es: "Ángel Guardián activado. Vigilancia en curso." },
  "Ange Gardien désactivé. Fin de la surveillance.": { en: "Guardian Angel off. Monitoring stopped.", es: "Ángel Guardián desactivado. Fin de la vigilancia." },
  "ATTENTION : DÉPASSEMENT DANGEREUX DÉTECTÉ.": { en: "CAUTION: DANGEROUS OVERTAKING DETECTED.", es: "ATENCIÓN: ADELANTAMIENTO PELIGROSO DETECTADO." },
  "Attention, cet itinéraire inclut une traversée en ferry.": { en: "Caution, this route includes a ferry crossing.", es: "Atención, esta ruta incluye un trayecto en ferri." },
  "Traversée en ferry à 1 kilomètre. Préparez-vous à l'embarquement.": { en: "Ferry crossing in 1 kilometre. Get ready to board.", es: "Ferri a 1 kilómetro. Prepárese para embarcar." },
};

/** Phrases avec une partie variable : $1, $2… reprennent la partie variable telle quelle. */
export const PATTERNS = [
  { re: /^Content de vous revoir, (.+)\. Systèmes opérationnels\.$/, en: "Welcome back, $1. Systems operational.", es: "Bienvenido de nuevo, $1. Sistemas operativos." },
  { re: /^Attention, (.+) signalé à environ 500 mètres\. Restez vigilant\.$/, en: "Caution, $1 reported about 500 metres ahead. Stay alert.", es: "Atención, $1 señalado a unos 500 metros. Manténgase alerta." },
  { re: /^Attention : (.+) signalé à proximité\.$/, en: "Caution: $1 reported nearby.", es: "Atención: $1 señalado cerca." },
  { re: /^Entretien (.+) sauvegardé dans le cloud\.$/, en: "Service $1 saved to the cloud.", es: "Mantenimiento $1 guardado en la nube." },
  { re: /^Escouade (.+) rejointe\. Activation du radar partagé\.$/, en: "Squad $1 joined. Shared radar on.", es: "Escuadra $1 unida. Radar compartido activado." },
  { re: /^Alerte Safe Ride : (.+) sur votre itinéraire\. Équipez-vous et soyez très prudent avant de prendre la route\.$/, en: "Safe Ride alert: $1 on your route. Gear up and be very careful before setting off.", es: "Alerta Safe Ride: $1 en su ruta. Equípese y tenga mucho cuidado antes de salir." },
  { re: /^Connexion au groupe (.+) en cours\.\.\.$/, en: "Joining group $1...", es: "Conectando con el grupo $1..." },
  { re: /^Performance réalisée : (.+) secondes\.$/, en: "Performance: $1 seconds.", es: "Marca conseguida: $1 segundos." },
  { re: /^Événement détecté : (.+) à (.+)\. Destination pré-chargée\.$/, en: "Event detected: $1 at $2. Destination preloaded.", es: "Evento detectado: $1 a las $2. Destino precargado." },
  { re: /^Objectif d'arrivée fixé à (.+)\. Chronos Guard surveille désormais votre fenêtre de départ\.$/, en: "Arrival target set for $1. Chronos Guard is now watching your departure window.", es: "Hora de llegada fijada a las $1. Chronos Guard vigila ahora su hora de salida." },
  { re: /^Alerte Ponctualité : Il est temps de vous équiper\. Départ dans (.+) minutes\.$/, en: "Punctuality alert: time to gear up. Leaving in $1 minutes.", es: "Alerta de puntualidad: es hora de equiparse. Salida en $1 minutos." },
  { re: /^Convoi créé ! Le code est : (.+)\.$/, en: "Convoy created! The code is: $1.", es: "¡Convoy creado! El código es: $1." },
  { re: /^Vous avez rejoint le convoi (.+)\.$/, en: "You joined convoy $1.", es: "Se ha unido al convoy $1." },
  { re: /^Attention, (.+) est décroché à plus de 500 mètres derrière vous\.$/, en: "Caution, $1 has fallen more than 500 metres behind you.", es: "Atención, $1 se ha quedado a más de 500 metros detrás de usted." },
  { re: /^Cortège\. (.+) signale : (.+)$/, en: "Group ride. $1 reports: $2", es: "Cortejo. $1 informa: $2" },
  { re: /^Alerte Crew ! Le gang (.+) vient de s'emparer du secteur (.+)\.$/, en: "Crew alert! The gang $1 has just taken sector $2.", es: "¡Alerta crew! La banda $1 acaba de hacerse con el sector $2." },
  { re: /^(.+) signalé\. Merci de protéger la communauté\.$/, en: "$1 reported. Thank you for protecting the community.", es: "$1 señalado. Gracias por proteger a la comunidad." },
  { re: /^Attention\. (.+)\. Votre score de conduite baisse\.$/, en: "Caution. $1. Your riding score is dropping.", es: "Atención. $1. Su puntuación de conducción baja." },
  { re: /^Entretien enregistré pour : (.+)\.$/, en: "Service saved for: $1.", es: "Mantenimiento registrado para: $1." },
  { re: /^Analyse terminée\. Pic à (.+) décibels\. Échappement homologué\.$/, en: "Analysis complete. Peak at $1 decibels. Exhaust is road-legal.", es: "Análisis terminado. Pico de $1 decibelios. Escape homologado." },
  { re: /^Alerte\. Pic sonore à (.+) décibels\. Votre pot d'échappement dépasse la limite légale\.$/, en: "Alert. Noise peak at $1 decibels. Your exhaust exceeds the legal limit.", es: "Alerta. Pico de ruido de $1 decibelios. Su escape supera el límite legal." },
  { re: /^Alerte SOS : Pilote en détresse à (.+) kilomètres\.$/, en: "SOS alert: rider in distress $1 kilometres away.", es: "Alerta SOS: piloto en apuros a $1 kilómetros." },
  { re: /^Bonne nouvelle\. (.+) est en route pour vous aider\.$/, en: "Good news. $1 is on the way to help you.", es: "Buenas noticias. $1 va de camino para ayudarle." },
  // Conseils météo à valeur variable (weather-advice.js)
  { re: /^Vent fort \((.+) km\/h\)\. Attention aux rafales sur deux-roues\.$/, en: "Strong wind ($1 km/h). Watch out for gusts on two wheels.", es: "Viento fuerte ($1 km/h). Cuidado con las ráfagas en dos ruedas." },
  { re: /^Il fait (.+) °C : risque de verglas par endroits\. Gants recommandés\.$/, en: "It is $1 °C: risk of black ice in places. Gloves recommended.", es: "Hace $1 °C: riesgo de hielo en algunos tramos. Se recomiendan guantes." },
];

/** Débuts de phrase suivis d'une valeur (speak("Client trouvé : " + nom)). */
export const PREFIXES = {
  "Client trouvé : ": { en: "Customer found: ", es: "Cliente encontrado: " },
  "Guidage interne démarré. Dans ": { en: "Guidance started. In ", es: "Guiado iniciado. En " },
  "Itinéraire calculé. Dans ": { en: "Route calculated. In ", es: "Ruta calculada. En " },
  "Chargement de l'itinéraire ": { en: "Loading route ", es: "Cargando la ruta " },
  "Données enregistrées. État de santé estimé à ": { en: "Data saved. Estimated health: ", es: "Datos guardados. Estado de salud estimado: " },
  "Échec de la publication : ": { en: "Publishing failed: ", es: "Error de publicación: " },
  "Alerte IA Prédictive : Composants critiques détectés : ": { en: "Predictive AI alert: critical components detected: ", es: "Alerta de IA predictiva: componentes críticos detectados: " },
  "Maintenance du composant ": { en: "Maintenance of component ", es: "Mantenimiento del componente " },
  "Trajet terminé. Félicitations, vous avez économisé ": { en: "Trip finished. Congratulations, you saved ", es: "Trayecto terminado. Enhorabuena, ha ahorrado " },
  "Intelligence prédictive activée. Itinéraire vers ": { en: "Predictive intelligence on. Route to ", es: "Inteligencia predictiva activada. Ruta hacia " },
};

/** Langue de la voix : celle choisie dans l'app (i18n.js), sinon celle du téléphone. */
export function voiceLanguage(appLang, browserLang) {
  const lang = String(appLang || browserLang || "fr").split("-")[0].toLowerCase();
  return VOICE_LANGUAGES.includes(lang) ? lang : "fr";
}

/**
 * Texte à prononcer dans la langue demandée.
 * @returns {{ text: string, lang: string, translated: boolean }} lang = langue réelle du texte
 */
export function translateForVoice(text, lang) {
  const original = String(text ?? "");
  if (lang === "fr" || !VOICE_LANGUAGES.includes(lang)) {
    return { text: original, lang: "fr", translated: lang === "fr" };
  }
  const exact = PHRASES[original]?.[lang];
  if (exact) return { text: exact, lang, translated: true };

  for (const pattern of PATTERNS) {
    const match = original.match(pattern.re);
    if (match && pattern[lang]) {
      return { text: pattern[lang].replace(/\$(\d)/g, (_, i) => match[Number(i)] ?? ""), lang, translated: true };
    }
  }
  for (const [prefix, translations] of Object.entries(PREFIXES)) {
    if (original.startsWith(prefix) && translations[lang]) {
      return { text: translations[lang] + original.slice(prefix.length), lang, translated: true };
    }
  }
  // Pas encore traduite : dite en français (rien n'est envoyé à un service externe)
  return { text: original, lang: "fr", translated: false };
}
