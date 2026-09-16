# AVERTISSEMENT CRITIQUE - FICHIERS GERBER NON ROUTÉS

## NE PAS ENVOYER EN PRODUCTION

Les fichiers `.gbr` et `.drl` présents dans cette archive, ainsi que le schéma `.kicad_sch` actuel, sont au stade de **PROTOTYPE NON ROUTÉ**.

1. **Aucune Piste Cuivre :** Il n'y a pas de routage électrique réel (ni plans de masse, ni signaux, ni alimentation).
2. **Empreintes (Footprints) :** Les composants placés sur le PCB sont des placeholders génériques. Ils doivent être remplacés par les véritables empreintes des modules finaux (ex: LMR16006, Quectel L76-LB, MPU6050, SMAJ18A).

### ACTION REQUISE
Avant toute commande de PCBA :
Un ingénieur matériel doit ouvrir le projet KiCad, associer les bonnes empreintes selon la nomenclature officielle (`BOM.csv`), réaliser le routage électrique complet (notamment l'adaptation d'impédance pour l'antenne BLE et le GPS), et générer de nouveaux fichiers Gerber finaux.
