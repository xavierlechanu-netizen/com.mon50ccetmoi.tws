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

# 3. Suppression des logs en production pour éviter les fuites de données
-assumenosideeffects class android.util.Log {
    public static boolean isLoggable(java.lang.String, int);
    public static int v(...);
    public static int i(...);
    public static int w(...);
    public static int d(...);
    public static int e(...);
}
