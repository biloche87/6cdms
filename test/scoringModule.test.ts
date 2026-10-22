import { initDatabase, db } from '../server/db.ts';
import {
  seedScoringDefaultData,
  seedDemoScoresIfEmpty,
  roundToHalf,
  determineTier,
  closeSemesterInternal,
} from '../server/routes/scoringAndGifts.ts';

console.log('================================================================');
console.log('  TEST DU MODULE NOTATION VRS & CARTES CADEAUX À GRATTER');
console.log('================================================================\n');

initDatabase();
seedScoringDefaultData();

let testPassed = true;

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ÉCHEC : ${message}`);
    testPassed = false;
    throw new Error(message);
  } else {
    console.log(`✅ SUCCÈS : ${message}`);
  }
}

try {
  // 1. Initialiser / Réinitialiser le semestre de démo S1-2026
  console.log('--- ÉTAPE 1 : Préparation du semestre de démo S1-2026 ---');
  let s1 = db.prepare("SELECT * FROM semesters WHERE code = 'S1-2026'").get() as any;
  if (!s1) {
    db.prepare(`
      INSERT INTO semesters (code, name, start_date, end_date, closing_date, status)
      VALUES ('S1-2026', '1er Semestre 2026', '2026-01-01', '2026-06-30', '2026-07-01', 'EN_COURS')
    `).run();
    s1 = db.prepare("SELECT * FROM semesters WHERE code = 'S1-2026'").get() as any;
  } else {
    db.prepare("UPDATE semesters SET status = 'EN_COURS', closed_at = NULL, closed_by_user_id = NULL WHERE id = ?").run(s1.id);
  }

  // Clear existing cards and scores for clean test
  db.prepare('DELETE FROM scratch_cards WHERE semester_id = ?').run(s1.id);
  db.prepare('DELETE FROM vrs_semester_scores WHERE semester_id = ?').run(s1.id);

  // Seed demo scores
  seedDemoScoresIfEmpty();

  const vrsList = db.prepare("SELECT id, public_id, first_name, last_name, drop_point_id FROM users WHERE role = 'VRS' ORDER BY id ASC").all() as any[];
  assert(vrsList.length >= 3, `Au moins 3 VRS présents en base (trouvé: ${vrsList.length})`);

  const vrs1 = vrsList[0]; // Ibrahim (16/20)
  const vrs2 = vrsList[1]; // Bakary (12/20)
  const vrs3 = vrsList[2]; // Oumar (8/20)

  const score1 = db.prepare('SELECT * FROM vrs_semester_scores WHERE semester_id = ? AND vrs_id = ?').get(s1.id, vrs1.id) as any;
  const score2 = db.prepare('SELECT * FROM vrs_semester_scores WHERE semester_id = ? AND vrs_id = ?').get(s1.id, vrs2.id) as any;
  const score3 = db.prepare('SELECT * FROM vrs_semester_scores WHERE semester_id = ? AND vrs_id = ?').get(s1.id, vrs3.id) as any;

  assert(score1.total_score === 16.0, `VRS 1 (${vrs1.first_name} ${vrs1.last_name}) a une note de 16/20`);
  assert(score2.total_score === 12.0, `VRS 2 (${vrs2.first_name} ${vrs2.last_name}) a une note de 12/20`);
  assert(score3.total_score === 8.0, `VRS 3 (${vrs3.first_name} ${vrs3.last_name}) a une note de 8/20`);

  // 2. Clôturer le semestre de démo
  console.log('\n--- ÉTAPE 2 : Clôture du semestre côté serveur ---');
  const bronzeGifts = db.prepare("SELECT * FROM gift_catalog WHERE tier = 'BRONZE' AND status = 'ACTIF'").all() as any[];
  const orGifts = db.prepare("SELECT * FROM gift_catalog WHERE tier = 'OR' AND status = 'ACTIF'").all() as any[];
  assert(bronzeGifts.length >= 4, `Catalogue Bronze contient 4 cadeaux (TV, frigo, mixeur, café)`);
  assert(orGifts.length >= 3, `Catalogue Or contient 3 cadeaux (smartphone, moto, ordinateur)`);

  // Perform closing using server internal closing function
  closeSemesterInternal(s1.id, 1, '6CDISTSAN');

  // 3. Vérifications des cartes et des paliers
  console.log('\n--- ÉTAPE 3 : Vérification des cartes générées ---');
  const cardVrs1 = db.prepare(`
    SELECT c.*, g.name as gift_name, g.tier as gift_tier
    FROM scratch_cards c
    JOIN gift_catalog g ON c.gift_id = g.id
    WHERE c.semester_id = ? AND c.vrs_id = ?
  `).get(s1.id, vrs1.id) as any;

  assert(!!cardVrs1, 'VRS à 16/20 a bien reçu une carte');
  assert(cardVrs1.tier === 'OR', 'VRS à 16/20 a bien reçu une carte Palier Or');
  assert(cardVrs1.gift_tier === 'OR', `Le cadeau tiré au sort ("${cardVrs1.gift_name}") appartient bien au palier Or`);

  const cardVrs2 = db.prepare(`
    SELECT c.*, g.name as gift_name, g.tier as gift_tier
    FROM scratch_cards c
    JOIN gift_catalog g ON c.gift_id = g.id
    WHERE c.semester_id = ? AND c.vrs_id = ?
  `).get(s1.id, vrs2.id) as any;

  assert(!!cardVrs2, 'VRS à 12/20 a bien reçu une carte');
  assert(cardVrs2.tier === 'BRONZE', 'VRS à 12/20 a bien reçu une carte Palier Bronze');
  assert(cardVrs2.gift_tier === 'BRONZE', `Le cadeau tiré au sort ("${cardVrs2.gift_name}") appartient bien au palier Bronze`);

  const cardVrs3 = db.prepare('SELECT * FROM scratch_cards WHERE semester_id = ? AND vrs_id = ?').get(s1.id, vrs3.id) as any;
  assert(!cardVrs3, 'VRS à 8/20 n\'a reçu AUCUNE carte (note < 10/20)');

  // 4. Test du grattage et de la persistance au rechargement
  console.log('\n--- ÉTAPE 4 : Test de grattage et persistance du cadeau tiré ---');
  const initialGiftId = cardVrs1.gift_id;
  const initialGiftName = cardVrs1.gift_name;

  // Simulate reveal via scratch
  db.prepare(`
    UPDATE scratch_cards
    SET is_revealed = 1, revealed_at = CURRENT_TIMESTAMP, revealed_method = 'SCRATCH'
    WHERE id = ?
  `).run(cardVrs1.id);

  // Inscribe in activity_logs
  db.prepare(`
    INSERT INTO activity_logs (user_id, user_public_id, action, resource, details)
    VALUES (?, ?, 'GRATTAGE_CARTE_REVELEE', 'SCORING_GIFTS', ?)
  `).run(vrs1.id, vrs1.public_id, `Carte ${cardVrs1.code} révélée. Cadeau: ${initialGiftName}`);

  // Simulate page reload: re-read card from database
  const reloadedCard = db.prepare(`
    SELECT c.*, g.name as gift_name
    FROM scratch_cards c
    JOIN gift_catalog g ON c.gift_id = g.id
    WHERE c.id = ?
  `).get(cardVrs1.id) as any;

  assert(reloadedCard.is_revealed === 1, 'La carte reste marquée comme révélée');
  assert(reloadedCard.gift_id === initialGiftId, `Le rechargement conserve rigoureusement le même cadeau (ID: ${initialGiftId}, Nom: ${reloadedCard.gift_name})`);
  assert(reloadedCard.gift_name === initialGiftName, 'Le nom du cadeau est parfaitement identique');

  // 5. Test programmation et confirmation de remise par le SA
  console.log('\n--- ÉTAPE 5 : Test programmation et suivi de la remise par le Sales Admin ---');
  // SA schedules delivery
  db.prepare(`
    UPDATE scratch_cards
    SET delivery_status = 'PROGRAMMEE',
        delivery_date = '2026-10-25',
        delivery_location = 'Entrepôt Dakan, Hamdallaye',
        delivered_by = 'Fatoumata Diarra (SA)',
        delivery_comment = 'Présenter la pièce d''identité'
    WHERE id = ?
  `).run(cardVrs1.id);

  // Inscribe in activity_logs
  db.prepare(`
    INSERT INTO activity_logs (user_id, user_public_id, action, resource, details)
    VALUES (2, '6CDISTSA-DKN', 'PROGRAMMATION_REMISE_CADEAU', 'SCORING_GIFTS', ?)
  `).run(`Remise de ${initialGiftName} programmée pour VRS ${vrs1.public_id}`);

  // Create notification for VRS
  db.prepare(`
    INSERT INTO notifications (user_id, role, title, message, type, is_read, link)
    VALUES (?, 'VRS', 'Remise de votre cadeau programmée 🎁', 'Remise le 2026-10-25 à Entrepôt Dakan par Fatoumata Diarra', 'SYSTEM', 0, 'gifts')
  `).run(vrs1.id);

  let scheduledCard = db.prepare('SELECT * FROM scratch_cards WHERE id = ?').get(cardVrs1.id) as any;
  assert(scheduledCard.delivery_status === 'PROGRAMMEE', 'Statut de remise est passé à "PROGRAMMEE"');
  assert(scheduledCard.delivery_location === 'Entrepôt Dakan, Hamdallaye', 'Lieu de remise enregistré');

  // SA confirms delivery done
  db.prepare(`
    UPDATE scratch_cards
    SET delivery_status = 'REMISE_EFFECTUEE', delivered_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(cardVrs1.id);

  let deliveredCard = db.prepare('SELECT * FROM scratch_cards WHERE id = ?').get(cardVrs1.id) as any;
  assert(deliveredCard.delivery_status === 'REMISE_EFFECTUEE', 'Statut est passé à "REMISE_EFFECTUEE"');

  // VRS confirms receipt
  db.prepare(`
    UPDATE scratch_cards
    SET delivery_status = 'RECU', vrs_confirmed_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(cardVrs1.id);

  // Inscribe in activity_logs
  db.prepare(`
    INSERT INTO activity_logs (user_id, user_public_id, action, resource, details)
    VALUES (?, ?, 'RECEPTION_CADEAU_CONFIRMEE', 'SCORING_GIFTS', 'Cadeau reçu en main propre')
  `).run(vrs1.id, vrs1.public_id);

  let receivedCard = db.prepare('SELECT * FROM scratch_cards WHERE id = ?').get(cardVrs1.id) as any;
  assert(receivedCard.delivery_status === 'RECU', 'Statut final est "RECU" avec horodatage vrs_confirmed_at');

  console.log('\n================================================================');
  console.log('  RÉSULTAT GLOBAL DU TEST : TOUS LES CONTRÔLES SONT VALIDÉS !');
  console.log('================================================================');
} catch (err: any) {
  console.error('Erreur test scoring:', err);
  process.exit(1);
}
