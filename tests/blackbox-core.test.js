/**
 * Tests Unitaires — Black Box Core (Logique Métier & Sécurité)
 * ─────────────────────────────────────────────────────────────────────────────
 * Validation OWASP ASVS v5.0.0-2.2.1 (validation allowlist)
 * & conformité aux spécifications Francelog S.A. (Linselles, 59) :
 *  - Prototypes : P01 à P10 réservés (lettre P exclusive)
 *  - Série commerciale : débute à A01 (BB50V1-A01...A99, B01...B99)
 *  - Le 00 est STRICTEMENT EXCLU de la numérotation (A00, B00 interdits)
 *  - Chaque boîtier a un code Bluetooth unique (passkey 6 chiffres)
 * ─────────────────────────────────────────────────────────────────────────────
 */

const core = require('../functions/api/blackbox-core');

describe('Format des Numéros de Série Black Box (BB50V1) & Spécifications Francelog', () => {

  test('Doit formater correctement les 10 prototypes de P01 à P10', () => {
    expect(core.formatSerial('V1', 'PROTOTYPE', 1)).toBe('BB50V1-P01');
    expect(core.formatSerial('V1', 'PROTOTYPE', 7)).toBe('BB50V1-P07');
    expect(core.formatSerial('V1', 'PROTOTYPE', 10)).toBe('BB50V1-P10');
  });

  test('Doit rejeter les numéros de prototypes hors bornes (1..10) et P00', () => {
    expect(() => core.formatSerial('V1', 'PROTOTYPE', 0)).toThrow(); // 00 exclu
    expect(() => core.formatSerial('V1', 'PROTOTYPE', 11)).toThrow(); // Max 10 prototypes
    expect(() => core.formatSerial('V1', 'PROTOTYPE', -1)).toThrow();
    expect(() => core.formatSerial('V1', 'PROTOTYPE', 99)).toThrow();
  });

  test('Doit débuter la production en série à A01 et progresser jusqu\'à A99 puis B01 (00 exclu)', () => {
    // La série débute à A01 (unité 1)
    expect(core.unitNumberToSeriesCode(1)).toBe('A01');
    expect(core.formatSerial('V1', 'SERIES', 1)).toBe('BB50V1-A01');

    // Progression normale
    expect(core.unitNumberToSeriesCode(42)).toBe('A42');
    expect(core.formatSerial('V1', 'SERIES', 42)).toBe('BB50V1-A42');

    // Fin de la première tranche A (99 unités)
    expect(core.unitNumberToSeriesCode(99)).toBe('A99');
    expect(core.formatSerial('V1', 'SERIES', 99)).toBe('BB50V1-A99');

    // Bascule à B01 sans passer par A00 ni B00 (le 00 est exclu)
    expect(core.unitNumberToSeriesCode(100)).toBe('B01');
    expect(core.formatSerial('V1', 'SERIES', 100)).toBe('BB50V1-B01');

    // Fin de la tranche B (198 unités)
    expect(core.unitNumberToSeriesCode(198)).toBe('B99');
    expect(core.formatSerial('V1', 'SERIES', 198)).toBe('BB50V1-B99');

    // Bascule à C01
    expect(core.unitNumberToSeriesCode(199)).toBe('C01');
    expect(core.formatSerial('V1', 'SERIES', 199)).toBe('BB50V1-C01');
  });

  test('La lettre P est réservée aux prototypes et sautée dans la série commerciale', () => {
    // Vérifier que la liste des lettres de série ne contient pas 'P'
    expect(core.SERIES_LETTERS.includes('P')).toBe(false);

    // O99 est suivi de Q01 (et non P01 qui est réservé au prototype)
    const idxO = core.SERIES_LETTERS.indexOf('O');
    const unitO99 = (idxO + 1) * 99;
    expect(core.unitNumberToSeriesCode(unitO99)).toBe('O99');
    expect(core.unitNumberToSeriesCode(unitO99 + 1)).toBe('Q01');
  });

  test('Conversion inverse : code série vers numéro d\'unité', () => {
    expect(core.seriesCodeToUnitNumber('A01')).toBe(1);
    expect(core.seriesCodeToUnitNumber('A99')).toBe(99);
    expect(core.seriesCodeToUnitNumber('B01')).toBe(100);
    expect(core.seriesCodeToUnitNumber('B99')).toBe(198);
    expect(core.seriesCodeToUnitNumber('C01')).toBe(199);

    // Rejets stricts du 00 et de P
    expect(core.seriesCodeToUnitNumber('A00')).toBeNull();
    expect(core.seriesCodeToUnitNumber('B00')).toBeNull();
    expect(core.seriesCodeToUnitNumber('P01')).toBeNull();
  });

  test('Doit parser les numéros de série canoniques et courts', () => {
    // Prototype canonique
    const proto = core.parseSerial('BB50V1-P05');
    expect(proto).not.toBeNull();
    expect(proto.type).toBe('PROTOTYPE');
    expect(proto.unitNumber).toBe(5);
    expect(proto.unitCode).toBe('P05');
    expect(proto.revision).toBe('V1');

    // Série canonique (insensible à la casse)
    const series = core.parseSerial('bb50v1-a01');
    expect(series).not.toBeNull();
    expect(series.type).toBe('SERIES');
    expect(series.unitNumber).toBe(1);
    expect(series.unitCode).toBe('A01');
    expect(series.serial).toBe('BB50V1-A01');

    // Entrées courtes saisies par l'administrateur
    const shortA = core.parseSerial('A01');
    expect(shortA).not.toBeNull();
    expect(shortA.serial).toBe('BB50V1-A01');
    expect(shortA.unitCode).toBe('A01');

    const shortP = core.parseSerial('P03');
    expect(shortP).not.toBeNull();
    expect(shortP.serial).toBe('BB50V1-P03');
    expect(shortP.unitCode).toBe('P03');
  });

  test('Doit rejeter strictement les formats contenant 00 ou invalides', () => {
    expect(core.parseSerial('BB50V1-P00')).toBeNull(); // 00 exclu
    expect(core.parseSerial('BB50V1-A00')).toBeNull(); // 00 exclu
    expect(core.parseSerial('A00')).toBeNull();
    expect(core.parseSerial('B00')).toBeNull();
    expect(core.parseSerial('BB50V1-P11')).toBeNull(); // Prototypes max 10
    expect(core.parseSerial('BB50V2-P01')).toBeNull(); // Prototypes réservés à V1
    expect(core.parseSerial('BB50V1-000001')).toBeNull(); // Ancien format numérique pur exclu
    expect(core.parseSerial('<script>alert(1)</script>')).toBeNull();
    expect(core.parseSerial('BB50V1-A01; DROP TABLE')).toBeNull();
    expect(core.parseSerial('')).toBeNull();
    expect(core.parseSerial(null)).toBeNull();
  });
});

describe('Codes Bluetooth Uniques (BLE Passkey / PIN 6 chiffres)', () => {

  test('Génère un code Bluetooth de 6 chiffres décimaux', () => {
    const code = core.generateBluetoothPasskey();
    expect(typeof code).toBe('string');
    expect(code).toMatch(/^\d{6}$/);
    const num = parseInt(code, 10);
    expect(num).toBeGreaterThanOrEqual(100000);
    expect(num).toBeLessThan(1000000);
  });

  test('Valide la conformité du code Bluetooth', () => {
    expect(core.isValidBluetoothPasskey('123456')).toBe(true);
    expect(core.isValidBluetoothPasskey('503050')).toBe(true);
    expect(core.isValidBluetoothPasskey('999999')).toBe(true);
    expect(core.isValidBluetoothPasskey('12345')).toBe(false); // Trop court
    expect(core.isValidBluetoothPasskey('1234567')).toBe(false); // Trop long
    expect(core.isValidBluetoothPasskey('ABCDEF')).toBe(false); // Pas décimal
    expect(core.isValidBluetoothPasskey('')).toBe(false);
  });
});

describe('Machine à États du Cycle de Vie (State Machine)', () => {

  test('Doit autoriser les transitions normales de fabrication et de vente', () => {
    expect(core.canTransition('MANUFACTURING', 'QA')).toBe(true);
    expect(core.canTransition('QA', 'IN_STOCK')).toBe(true);
    expect(core.canTransition('IN_STOCK', 'SOLD')).toBe(true);
    expect(core.canTransition('SOLD', 'ACTIVE')).toBe(true);
  });

  test('Doit autoriser les flux de SAV (RMA) et de Vol (STOLEN)', () => {
    expect(core.canTransition('ACTIVE', 'RMA')).toBe(true);
    expect(core.canTransition('RMA', 'ACTIVE')).toBe(true);
    expect(core.canTransition('RMA', 'IN_STOCK')).toBe(true);
    expect(core.canTransition('ACTIVE', 'STOLEN')).toBe(true);
    expect(core.canTransition('STOLEN', 'ACTIVE')).toBe(true);
  });

  test('Doit interdire les transitions impossibles ou régressives non prévues', () => {
    expect(core.canTransition('MANUFACTURING', 'ACTIVE')).toBe(false);
    expect(core.canTransition('IN_STOCK', 'ACTIVE')).toBe(false);
    expect(core.canTransition('DECOMMISSIONED', 'IN_STOCK')).toBe(false); // État terminal
    expect(core.canTransition('STOLEN', 'SOLD')).toBe(false);
  });

  test('Doit identifier les transitions réservées à l\'attribution de commande', () => {
    expect(core.isAssignmentOnlyTransition('IN_STOCK', 'SOLD')).toBe(true);
    expect(core.isAssignmentOnlyTransition('SOLD', 'IN_STOCK')).toBe(true);
    expect(core.isAssignmentOnlyTransition('QA', 'IN_STOCK')).toBe(false);
  });

  test('Doit exiger un motif pour les statuts critiques (RMA, STOLEN, DECOMMISSIONED)', () => {
    expect(core.requiresReason('RMA')).toBe(true);
    expect(core.requiresReason('STOLEN')).toBe(true);
    expect(core.requiresReason('DECOMMISSIONED')).toBe(true);
    expect(core.requiresReason('QA')).toBe(false);
    expect(core.requiresReason('IN_STOCK')).toBe(false);
  });
});

describe('Garanties & Tarification Boutique (Revolut)', () => {

  test('Les prototypes bénéficient de la garantie à vie', () => {
    const warranty = core.computeWarranty('PROTOTYPE', true, new Date('2026-10-16'));
    expect(warranty.warrantyType).toBe('LIFETIME');
    expect(warranty.warrantyEndsAt).toBeNull();
  });

  test('Les boîtiers de série bénéficient de la garantie légale de conformité de 2 ans', () => {
    const start = new Date('2026-10-16T12:00:00Z');
    const warranty = core.computeWarranty('SERIES', false, start);
    expect(warranty.warrantyType).toBe('LEGAL_2Y');
    expect(warranty.warrantyEndsAt.toISOString().slice(0, 10)).toBe('2028-10-16');
  });

  test('Boutique : applique 49,99 € si moins de 10 prototypes vendus', () => {
    const order0 = core.computeShopOrder('UNIT', 0);
    expect(order0.amountCents).toBe(4999);
    expect(order0.prototypeOffer).toBe(true);
    expect(order0.lifetimeWarranty).toBe(true);

    const order9 = core.computeShopOrder('UNIT', 9);
    expect(order9.amountCents).toBe(4999);
    expect(order9.prototypeOffer).toBe(true);
  });

  test('Boutique : applique 89,99 € si les 10 prototypes sont épuisés', () => {
    const order10 = core.computeShopOrder('UNIT', 10);
    expect(order10.amountCents).toBe(8999);
    expect(order10.prototypeOffer).toBe(false);
    expect(order10.lifetimeWarranty).toBe(false);

    const order15 = core.computeShopOrder('UNIT', 15);
    expect(order15.amountCents).toBe(8999);
  });

  test('Boutique : Pack Duo à 161,98 € (sans garantie à vie)', () => {
    const duo = core.computeShopOrder('DUO', 0);
    expect(duo.amountCents).toBe(16198);
    expect(duo.quantity).toBe(2);
    expect(duo.lifetimeWarranty).toBe(false);
  });
});

describe('Sécurité & Normalisation des Données', () => {

  test('Normalise les adresses MAC BLE valides', () => {
    expect(core.normalizeMac('aa:bb:cc:dd:ee:ff')).toBe('AA:BB:CC:DD:EE:FF');
    expect(core.normalizeMac('AA-BB-CC-DD-EE-FF')).toBe('AA:BB:CC:DD:EE:FF');
  });

  test('Rejette les adresses MAC BLE invalides ou broadcast', () => {
    expect(core.normalizeMac('00:00:00:00:00:00')).toBeNull();
    expect(core.normalizeMac('FF:FF:FF:FF:FF:FF')).toBeNull();
    expect(core.normalizeMac('INVALID-MAC')).toBeNull();
    expect(core.normalizeMac('AA:BB:CC:DD:EE')).toBeNull();
  });

  test('Valide les versions de firmware', () => {
    expect(core.isValidFirmwareVersion('1.0.0')).toBe(true);
    expect(core.isValidFirmwareVersion('2.1.0-rc1')).toBe(true);
    expect(core.isValidFirmwareVersion('bad_version')).toBe(false);
  });

  test('Normalise les numéros de lots Francelog', () => {
    expect(core.normalizeBatchNumber('lot-linselles-01')).toBe('LOT-LINSELLES-01');
    expect(core.normalizeBatchNumber('BATCH_2026')).toBeNull(); // underscore interdit
    expect(core.normalizeBatchNumber('')).toBeNull();
  });
});
