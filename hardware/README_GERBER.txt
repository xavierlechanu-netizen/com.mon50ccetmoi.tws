BLACKBOX mon50ccetmoi V1.0 - GERBER PROTOTYPE
================================================

Contenu:
- F_Cu : cuivre top
- B_Cu : cuivre bottom (vide dans ce prototype)
- F_Mask / B_Mask : ouvertures de masque
- F_Silkscreen / B_Silkscreen : géométrie de repérage simplifiée
- Edge_Cuts : contour 60 x 40 mm
- PTH.drl : perçages 3.2 mm des 4 fixations
- NPTH.drl : vide
- component_positions.csv : positions indicatives

ATTENTION
----------
Ce package a été généré à partir du PCB PROTOTYPE précédent, pas d'un routage
électrique final. Les pistes présentes sont indicatives et les empreintes sont
des placeholders. NE PAS commander une série de production avec ces Gerbers.

Avant fabrication réelle:
1. Valider le schéma électrique et les vrais pinouts.
2. Remplacer toutes les empreintes par celles des fabricants.
3. Router les nets réels et les plans GND/POWER.
4. Valider l'antenne ESP32 et le GNSS.
5. Ajouter les règles DRC, impédances, largeurs d'alimentation et dissipation.
6. Générer les Gerbers avec KiCad Pcbnew depuis le PCB final.
