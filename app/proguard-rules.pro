# Règles de sécurisation R8 (Obfuscation maximale)
# Recommandé pour protéger l'application contre le reverse-engineering (Play Integrity)

# 1. Optimisation agressive et suppression des informations inutiles
-repackageclasses ''
-allowaccessmodification
-dontusemixedcaseclassnames
-dontskipnonpubliclibraryclasses
-verbose

# 2. R8 conservera automatiquement les composants déclarés dans le Manifest (Activities, Services).
# La suppression des -keep stricts permet de dépasser les 80% de réduction (Haut de gamme).

# 3. Suppression des logs verbeux en production pour éviter les fuites de données
# NOTE : Log.e est délibérément préservé pour permettre la remontée de stack traces critiques vers Play Vitals
-assumenosideeffects class android.util.Log {
    public static boolean isLoggable(java.lang.String, int);
    public static int v(...);
    public static int i(...);
    public static int d(...);
}
