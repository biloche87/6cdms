import { Router, type Response } from 'express';
import bcrypt from 'bcryptjs';
import { db, triggerMasterBackup } from '../db.ts';
import { requireAuth, type AuthRequest, logActivity } from '../auth.ts';

const router = Router();

// Helper to generate publicId according to section 6
function generateUserPublicId(role: string, dropPointCode: string): string {
  if (role === 'SALES_ADMIN_NATIONAL') {
    const existingExact = db.prepare('SELECT public_id FROM users WHERE public_id = ?').get('6CDISTSAN');
    if (!existingExact) {
      return '6CDISTSAN';
    }
    const existingWithSuffix = db.prepare(`
      SELECT public_id FROM users WHERE public_id LIKE '6CDISTSAN-%' ORDER BY public_id DESC
    `).all() as { public_id: string }[];
    let maxNum = 1;
    for (const row of existingWithSuffix) {
      const parts = row.public_id.split('-');
      const numPart = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(numPart) && numPart > maxNum) {
        maxNum = numPart;
      }
    }
    return `6CDISTSAN-${String(maxNum + 1).padStart(3, '0')}`;
  }

  let roleCode = '';
  if (role === 'SALES_ADMIN') roleCode = 'SA';
  else if (role === 'FSS') roleCode = 'FSS';
  else if (role === 'VRS') roleCode = 'VRS';
  else roleCode = 'USR';

  const basePrefix = `6CDIST${roleCode}-${dropPointCode}`;

  if (role === 'VRS') {
    // VRS uses sequential suffix -001, -002, etc.
    const existing = db.prepare(`
      SELECT public_id FROM users WHERE public_id LIKE ? ORDER BY public_id DESC
    `).all(`${basePrefix}-%`) as { public_id: string }[];

    let maxNum = 0;
    for (const row of existing) {
      const parts = row.public_id.split('-');
      const numPart = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(numPart) && numPart > maxNum) {
        maxNum = numPart;
      }
    }
    const nextNum = String(maxNum + 1).padStart(3, '0');
    return `${basePrefix}-${nextNum}`;
  } else {
    // For SA and FSS, check if base exists; if so, append -002
    const existingExact = db.prepare('SELECT public_id FROM users WHERE public_id = ?').get(basePrefix);
    if (!existingExact) {
      return basePrefix;
    }
    const existingWithSuffix = db.prepare(`
      SELECT public_id FROM users WHERE public_id LIKE ? ORDER BY public_id DESC
    `).all(`${basePrefix}-%`) as { public_id: string }[];

    let maxNum = 1;
    for (const row of existingWithSuffix) {
      const parts = row.public_id.split('-');
      const numPart = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(numPart) && numPart > maxNum) {
        maxNum = numPart;
      }
    }
    return `${basePrefix}-${String(maxNum + 1).padStart(3, '0')}`;
  }
}

// GET users with role filtering & isolation
router.get('/', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const { role, dropPointId, fssId } = req.query;

  let query = `
    SELECT u.id, u.public_id as publicId, u.role, u.first_name as firstName, u.last_name as lastName,
           u.email, u.phone, u.photo, u.drop_point_id as dropPointId, u.sales_admin_id as salesAdminId,
           u.fss_id as fssId, u.sector_id as sectorId, u.status, u.created_at as createdAt,
           dp.name as dropPointName, dp.code as dropPointCode,
           s.name as sectorName,
           fss.first_name || ' ' || fss.last_name as fssName,
           sa.first_name || ' ' || sa.last_name as salesAdminName
    FROM users u
    LEFT JOIN drop_points dp ON u.drop_point_id = dp.id
    LEFT JOIN sectors s ON u.sector_id = s.id
    LEFT JOIN users fss ON u.fss_id = fss.id
    LEFT JOIN users sa ON u.sales_admin_id = sa.id
    WHERE 1=1
  `;
  const params: any[] = [];

  // Enforce Drop Point Scope
  if (user.role === 'SALES_ADMIN_NATIONAL') {
    if (dropPointId) {
      query += ' AND u.drop_point_id = ?';
      params.push(dropPointId);
    }
  } else if (user.role === 'SALES_ADMIN') {
    query += ' AND u.drop_point_id = ?';
    params.push(user.dropPointId);
  } else if (user.role === 'FSS') {
    query += ' AND u.drop_point_id = ? AND (u.fss_id = ? OR u.id = ?)';
    params.push(user.dropPointId, user.id, user.id);
  } else {
    // VRS only sees themselves
    query += ' AND u.id = ?';
    params.push(user.id);
  }

  if (role) {
    query += ' AND u.role = ?';
    params.push(role);
  }

  if (fssId && user.role === 'SALES_ADMIN_NATIONAL') {
    query += ' AND u.fss_id = ?';
    params.push(fssId);
  }

  query += ' ORDER BY u.role, u.first_name ASC';

  const users = db.prepare(query).all(...params);
  res.json({ users });
});

// Update current user's live GPS location (continuous tracking & anti-fraud)
router.post('/current-location', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const { latitude, longitude, accuracy, speed, actionContext } = req.body;

  const lat = typeof latitude === 'number' ? latitude : parseFloat(latitude);
  const lng = typeof longitude === 'number' ? longitude : parseFloat(longitude);
  const acc = accuracy ? (typeof accuracy === 'number' ? accuracy : parseFloat(accuracy)) : null;
  const spd = speed ? (typeof speed === 'number' ? speed : parseFloat(speed)) : null;

  if (isNaN(lat) || isNaN(lng)) {
    return res.status(400).json({ error: 'Coordonnées GPS invalides (latitude et longitude numériques requises).' });
  }

  // Validate bounds
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return res.status(400).json({ error: 'Coordonnées GPS hors limites terrestres.' });
  }

  // Check against fake / null coordinates (0,0 is Gulf of Guinea, invalid for Mali terrain)
  if (Math.abs(lat) < 0.001 && Math.abs(lng) < 0.001) {
    return res.status(400).json({ error: 'Position GPS invalide (0,0 détecté). Activez le capteur GPS réel de votre appareil.' });
  }

  try {
    db.prepare(`
      UPDATE users
      SET last_latitude = ?,
          last_longitude = ?,
          last_location_accuracy = ?,
          last_location_speed = ?,
          last_location_updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(lat, lng, acc, spd, user.id);

    // Also record in history audit trail
    try {
      db.prepare(`
        INSERT INTO vrs_location_history (vrs_id, latitude, longitude, accuracy, speed, action_context)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(user.id, lat, lng, acc, spd, actionContext || 'HEARTBEAT');
    } catch (histErr) {
      console.warn('Location history insertion notice:', histErr);
    }

    res.json({
      success: true,
      message: 'Position GPS mise à jour avec succès.',
      location: {
        latitude: lat,
        longitude: lng,
        accuracy: acc,
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    console.error('Error updating user location:', err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour de la position GPS.' });
  }
});

// Retrieve all VRS locations for live map tracking (restricted by drop point for non-SAN)
router.get('/vrs-locations', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;

  let query = `
    SELECT u.id,
           u.public_id as publicId,
           u.first_name as firstName,
           u.last_name as lastName,
           u.phone,
           u.photo,
           u.role,
           u.status,
           u.last_latitude as lastLatitude,
           u.last_longitude as lastLongitude,
           u.last_location_accuracy as lastLocationAccuracy,
           u.last_location_speed as lastLocationSpeed,
           u.last_location_updated_at as lastLocationUpdatedAt,
           dp.id as dropPointId,
           dp.name as dropPointName,
           dp.code as dropPointCode,
           s.name as sectorName,
           (SELECT COUNT(*) FROM sales WHERE vrs_id = u.id AND status = 'COMPLETED') as completedSalesCount,
           (SELECT COALESCE(SUM(total_amount), 0) FROM sales WHERE vrs_id = u.id AND status = 'COMPLETED') as totalSalesAmount
    FROM users u
    LEFT JOIN drop_points dp ON u.drop_point_id = dp.id
    LEFT JOIN sectors s ON u.sector_id = s.id
    WHERE u.role = 'VRS' AND (u.status != 'INACTIF' AND u.status != 'SUSPENDU')
  `;

  const params: any[] = [];
  if (user.role === 'SALES_ADMIN' || user.role === 'FSS') {
    if (user.dropPointId) {
      query += ' AND u.drop_point_id = ?';
      params.push(user.dropPointId);
    }
  } else if (user.role === 'VRS') {
    // A VRS can view their own position and teammates in same drop point
    if (user.dropPointId) {
      query += ' AND u.drop_point_id = ?';
      params.push(user.dropPointId);
    } else {
      query += ' AND u.id = ?';
      params.push(user.id);
    }
  }

  query += ' ORDER BY u.last_location_updated_at DESC NULLS LAST, u.first_name ASC';

  const rows = db.prepare(query).all(...params) as any[];

  // Calculate freshness and live status
  const now = Date.now();
  const vrsWithStatus = rows.map((r) => {
    let liveStatus: 'LIVE' | 'RECENT' | 'OFFLINE' | 'NO_GPS' = 'NO_GPS';
    let minutesAgo: number | null = null;

    if (r.lastLatitude && r.lastLongitude && r.lastLocationUpdatedAt) {
      const updatedTime = new Date(r.lastLocationUpdatedAt).getTime();
      minutesAgo = Math.max(0, Math.floor((now - updatedTime) / (1000 * 60)));
      if (minutesAgo <= 15) {
        liveStatus = 'LIVE'; // Updated within 15 min
      } else if (minutesAgo <= 120) {
        liveStatus = 'RECENT'; // Updated within 2 hours
      } else {
        liveStatus = 'OFFLINE'; // Older than 2 hours
      }
    }

    return {
      ...r,
      liveStatus,
      minutesAgo,
    };
  });

  res.json({ vrs: vrsWithStatus });
});

// Haversine distance calculator in meters
function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

// GET complete GPS trajectory and stop history for a VRS on a specific date (SAN, SA, FSS, self)
router.get('/vrs-trajectory/:id', requireAuth, (req: AuthRequest, res: Response) => {
  const currentUser = req.user!;
  const targetVrsId = parseInt(req.params.id, 10);
  const targetDate = (req.query.date as string) || new Date().toISOString().split('T')[0];

  if (isNaN(targetVrsId)) {
    return res.status(400).json({ error: 'Identifiant VRS invalide.' });
  }

  // Retrieve VRS user profile
  const vrsUser = db.prepare(`
    SELECT u.id, u.public_id as publicId, u.role, u.first_name as firstName, u.last_name as lastName,
           u.phone, u.photo, u.drop_point_id as dropPointId,
           dp.name as dropPointName, dp.code as dropPointCode,
           s.name as sectorName
    FROM users u
    LEFT JOIN drop_points dp ON u.drop_point_id = dp.id
    LEFT JOIN sectors s ON u.sector_id = s.id
    WHERE u.id = ?
  `).get(targetVrsId) as any;

  if (!vrsUser) {
    return res.status(404).json({ error: 'VRS introuvable.' });
  }

  // Authorization check
  if (currentUser.role === 'SALES_ADMIN_NATIONAL') {
    // National admin has full access
  } else if (currentUser.role === 'SALES_ADMIN' || currentUser.role === 'FSS') {
    if (vrsUser.dropPointId !== currentUser.dropPointId) {
      return res.status(403).json({ error: 'Accès refusé. Ce VRS dépend d’un autre Drop Point.' });
    }
  } else if (currentUser.role === 'VRS') {
    if (currentUser.id !== targetVrsId) {
      return res.status(403).json({ error: 'Accès refusé. Vous ne pouvez consulter que vos propres trajets.' });
    }
  }

  // 1. Fetch all raw GPS breadcrumb points for that date
  const rawPoints = db.prepare(`
    SELECT id, vrs_id as vrsId, latitude, longitude, accuracy, speed,
           action_context as actionContext, recorded_at as recordedAt
    FROM vrs_location_history
    WHERE vrs_id = ? AND date(recorded_at) = date(?)
    ORDER BY recorded_at ASC
  `).all(targetVrsId, targetDate) as any[];

  // 2. Fetch sales made by this VRS on that date
  const sales = db.prepare(`
    SELECT s.id, s.sale_number as saleNumber, s.latitude, s.longitude,
           s.total_amount as totalAmount, s.created_at as createdAt,
           pos.name as posName
    FROM sales s
    LEFT JOIN points_of_sale pos ON s.point_of_sale_id = pos.id
    WHERE s.vrs_id = ? AND date(s.created_at) = date(?) AND s.status = 'COMPLETED'
    ORDER BY s.created_at ASC
  `).all(targetVrsId, targetDate) as any[];

  // 3. Fetch visits made by this VRS on that date
  const visits = db.prepare(`
    SELECT v.id, v.latitude, v.longitude, v.started_at as startedAt,
           pos.name as posName, pos.address as posAddress
    FROM visits v
    LEFT JOIN points_of_sale pos ON v.point_of_sale_id = pos.id
    WHERE v.vrs_id = ? AND date(v.started_at) = date(?)
    ORDER BY v.started_at ASC
  `).all(targetVrsId, targetDate) as any[];

  // 4. Fetch distinct dates available in history for this VRS
  const availableDatesRows = db.prepare(`
    SELECT DISTINCT date(recorded_at) as logDate
    FROM vrs_location_history
    WHERE vrs_id = ?
    ORDER BY logDate DESC
    LIMIT 30
  `).all(targetVrsId) as { logDate: string }[];

  const availableDates = availableDatesRows.map(r => r.logDate);
  if (!availableDates.includes(targetDate)) {
    availableDates.unshift(targetDate);
  }

  // 5. Process trajectory points & compute distances
  let totalDistanceMeters = 0;
  let maxSpeedKmh = 0;
  let stopsCount = 0;
  let speedSum = 0;
  let speedCount = 0;

  const trajectory = rawPoints.map((pt, index) => {
    let distFromPrev = 0;
    if (index > 0) {
      const prev = rawPoints[index - 1];
      distFromPrev = haversineMeters(prev.latitude, prev.longitude, pt.latitude, pt.longitude);
      totalDistanceMeters += distFromPrev;
    }

    const currentSpeed = pt.speed != null ? Number(pt.speed) : 0;
    if (currentSpeed > maxSpeedKmh) maxSpeedKmh = currentSpeed;
    if (currentSpeed > 0) {
      speedSum += currentSpeed;
      speedCount++;
    } else {
      stopsCount++;
    }

    const dateObj = new Date(pt.recordedAt);
    const formattedTime = dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    return {
      id: pt.id,
      vrsId: pt.vrsId,
      latitude: Number(pt.latitude),
      longitude: Number(pt.longitude),
      accuracy: pt.accuracy != null ? Number(pt.accuracy) : null,
      speed: pt.speed != null ? Number(pt.speed) : null,
      actionContext: pt.actionContext || 'TRAJET',
      recordedAt: pt.recordedAt,
      formattedTime,
      distanceFromPrevMeters: distFromPrev,
    };
  });

  const startTime = trajectory.length > 0 ? trajectory[0].formattedTime : null;
  const endTime = trajectory.length > 0 ? trajectory[trajectory.length - 1].formattedTime : null;
  let totalDurationMinutes = 0;
  if (trajectory.length > 1) {
    const t0 = new Date(trajectory[0].recordedAt).getTime();
    const tEnd = new Date(trajectory[trajectory.length - 1].recordedAt).getTime();
    totalDurationMinutes = Math.max(0, Math.round((tEnd - t0) / 60000));
  }

  const averageSpeedKmh = speedCount > 0 ? Math.round((speedSum / speedCount) * 10) / 10 : 0;

  res.json({
    user: {
      id: vrsUser.id,
      publicId: vrsUser.publicId,
      firstName: vrsUser.firstName,
      lastName: vrsUser.lastName,
      phone: vrsUser.phone,
      photo: vrsUser.photo,
      dropPointName: vrsUser.dropPointName,
      sectorName: vrsUser.sectorName,
    },
    date: targetDate,
    trajectory,
    summary: {
      totalPoints: trajectory.length,
      totalDistanceKm: Math.round((totalDistanceMeters / 1000) * 100) / 100,
      startTime,
      endTime,
      totalDurationMinutes,
      averageSpeedKmh,
      maxSpeedKmh: Math.round(maxSpeedKmh * 10) / 10,
      stopsCount,
    },
    associatedEvents: {
      sales: sales.map(s => ({
        ...s,
        formattedTime: new Date(s.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      })),
      visits: visits.map(v => ({
        ...v,
        formattedTime: new Date(v.startedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      })),
    },
    availableDates,
  });
});

// Corridor paths for real-time simulation across Bamako
const SIMULATION_CORRIDORS: Record<string, { lat: number; lng: number; name: string }[]> = {
  '6CDISTVRS-DKN-001': [
    { lat: 12.6398, lng: -8.0022, name: 'Dépôt DAKAN (Départ)' },
    { lat: 12.6420, lng: -8.0035, name: 'Rue 314 Hamdallaye' },
    { lat: 12.6450, lng: -8.0050, name: 'Carrefour Hamdallaye Marché' },
    { lat: 12.6480, lng: -8.0090, name: 'Boulevard du 22 Octobre' },
    { lat: 12.6510, lng: -8.0120, name: 'ACI 2000 - Place CAN' },
    { lat: 12.6475, lng: -8.0175, name: 'Rond-Point de l’Éléphant' },
    { lat: 12.6425, lng: -8.0150, name: 'Avenue Cheick Zayed' },
    { lat: 12.6380, lng: -8.0095, name: 'Zone Industrielle Ouest' },
    { lat: 12.6360, lng: -8.0040, name: 'Superette Dakan Centre' },
  ],
  '6CDISTVRS-DKN-002': [
    { lat: 12.6435, lng: -7.9985, name: 'Badalabougou SEMA' },
    { lat: 12.6460, lng: -7.9960, name: 'Avenue de l’OUA' },
    { lat: 12.6490, lng: -7.9930, name: 'Pont des Martyrs Nord' },
    { lat: 12.6520, lng: -7.9910, name: 'Avenue Al Quds' },
    { lat: 12.6560, lng: -7.9890, name: 'Grand Marché Central' },
    { lat: 12.6510, lng: -7.9940, name: 'Quartier du Fleuve' },
    { lat: 12.6470, lng: -7.9970, name: 'Alimentation Générale Badala' },
  ],
  '6CDISTVRS-DKN-003': [
    { lat: 12.6360, lng: -8.0060, name: 'Sabalibougou Sud' },
    { lat: 12.6320, lng: -8.0035, name: 'Rue 218 Daoudabougou' },
    { lat: 12.6280, lng: -8.0010, name: 'Marché Daoudabougou' },
    { lat: 12.6240, lng: -7.9975, name: 'Route de l’Aéroport' },
    { lat: 12.6210, lng: -7.9940, name: 'Faladié Rond-Point' },
    { lat: 12.6250, lng: -7.9890, name: 'Sogoniko Gare Routière' },
    { lat: 12.6310, lng: -7.9970, name: 'Kalaban Coura Carrefour' },
  ],
};

const simulationStepIndexes: Record<string, number> = {};

// POST simulation step: Moves all VRS along realistic trade corridors in real-time
router.post('/simulate-vrs-step', requireAuth, (req: AuthRequest, res: Response) => {
  const vrsList = db.prepare(`
    SELECT id, public_id as publicId, first_name as firstName, last_name as lastName
    FROM users
    WHERE role = 'VRS' AND (status != 'INACTIF' AND status != 'SUSPENDU')
  `).all() as { id: number; publicId: string; firstName: string; lastName: string }[];

  const nowIso = new Date().toISOString();

  for (const vrs of vrsList) {
    const corridor = SIMULATION_CORRIDORS[vrs.publicId] || SIMULATION_CORRIDORS['6CDISTVRS-DKN-001'];
    const currentIndex = simulationStepIndexes[vrs.publicId] ?? 0;
    const nextIndex = (currentIndex + 1) % corridor.length;
    simulationStepIndexes[vrs.publicId] = nextIndex;

    const targetWayPoint = corridor[nextIndex];
    // Add minor realistic micro-jitter (±10m) so it behaves like real hardware GPS
    const jitterLat = (Math.random() - 0.5) * 0.0003;
    const jitterLng = (Math.random() - 0.5) * 0.0003;
    const nextLat = Math.round((targetWayPoint.lat + jitterLat) * 100000) / 100000;
    const nextLng = Math.round((targetWayPoint.lng + jitterLng) * 100000) / 100000;
    const speed = Math.round((18 + Math.random() * 16) * 10) / 10; // 18 - 34 km/h
    const accuracy = Math.round((4 + Math.random() * 4) * 10) / 10; // 4 - 8m

    // Update current location
    db.prepare(`
      UPDATE users
      SET last_latitude = ?,
          last_longitude = ?,
          last_location_accuracy = ?,
          last_location_speed = ?,
          last_location_updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(nextLat, nextLng, accuracy, speed, vrs.id);

    // Save to historical audit trail
    try {
      db.prepare(`
        INSERT INTO vrs_location_history (vrs_id, latitude, longitude, accuracy, speed, action_context)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(vrs.id, nextLat, nextLng, accuracy, speed, `SIMULATION: ${targetWayPoint.name}`);
    } catch {}
  }

  // Retrieve full updated VRS locations list
  const updatedRows = db.prepare(`
    SELECT u.id,
           u.public_id as publicId,
           u.first_name as firstName,
           u.last_name as lastName,
           u.phone,
           u.photo,
           u.role,
           u.status,
           u.last_latitude as lastLatitude,
           u.last_longitude as lastLongitude,
           u.last_location_accuracy as lastLocationAccuracy,
           u.last_location_speed as lastLocationSpeed,
           u.last_location_updated_at as lastLocationUpdatedAt,
           dp.id as dropPointId,
           dp.name as dropPointName,
           dp.code as dropPointCode,
           s.name as sectorName,
           (SELECT COUNT(*) FROM sales WHERE vrs_id = u.id AND status = 'COMPLETED') as completedSalesCount,
           (SELECT COALESCE(SUM(total_amount), 0) FROM sales WHERE vrs_id = u.id AND status = 'COMPLETED') as totalSalesAmount
    FROM users u
    LEFT JOIN drop_points dp ON u.drop_point_id = dp.id
    LEFT JOIN sectors s ON u.sector_id = s.id
    WHERE u.role = 'VRS' AND (u.status != 'INACTIF' AND u.status != 'SUSPENDU')
    ORDER BY u.last_location_updated_at DESC
  `).all() as any[];

  const vrsWithStatus = updatedRows.map(r => ({
    ...r,
    liveStatus: 'LIVE' as const,
    minutesAgo: 0,
  }));

  res.json({
    success: true,
    message: 'Simulation de déplacement des VRS effectuée en temps réel.',
    vrs: vrsWithStatus,
  });
});

// GET single user
router.get('/:id', requireAuth, (req: AuthRequest, res: Response) => {
  const currentUser = req.user!;
  const targetId = parseInt(req.params.id, 10);

  const target = db.prepare(`
    SELECT u.id, u.public_id as publicId, u.role, u.first_name as firstName, u.last_name as lastName,
           u.email, u.phone, u.photo, u.drop_point_id as dropPointId, u.sales_admin_id as salesAdminId,
           u.fss_id as fssId, u.sector_id as sectorId, u.status, u.created_at as createdAt,
           dp.name as dropPointName, dp.code as dropPointCode,
           s.name as sectorName
    FROM users u
    LEFT JOIN drop_points dp ON u.drop_point_id = dp.id
    LEFT JOIN sectors s ON u.sector_id = s.id
    WHERE u.id = ?
  `).get(targetId) as any;

  if (!target) {
    return res.status(404).json({ error: 'Utilisateur non trouvé.' });
  }

  // Scope check
  if (currentUser.role !== 'SALES_ADMIN_NATIONAL') {
    if (currentUser.role === 'VRS' && currentUser.id !== target.id) {
      return res.status(403).json({ error: 'Accès non autorisé.' });
    }
    if (currentUser.dropPointId !== target.dropPointId) {
      return res.status(403).json({ error: 'Cet utilisateur n\'appartient pas à votre Drop Point.' });
    }
    if (currentUser.role === 'FSS' && target.role === 'VRS' && target.fssId !== currentUser.id && target.id !== currentUser.id) {
      return res.status(403).json({ error: 'Ce vendeur n\'est pas sous votre supervision directe.' });
    }
  }

  res.json({ user: target });
});

// GET performance & rating on 10 for a vendor / user
router.get('/:id/performance', requireAuth, (req: AuthRequest, res: Response) => {
  const currentUser = req.user!;
  const targetId = req.params.id === 'me' ? currentUser.id : parseInt(req.params.id, 10);
  if (isNaN(targetId)) {
    return res.status(400).json({ error: 'Identifiant utilisateur invalide' });
  }

  const user = db.prepare(`
    SELECT u.id, u.public_id as publicId, u.role, u.first_name as firstName, u.last_name as lastName,
           u.email, u.phone, u.photo, u.drop_point_id as dropPointId, u.status, u.created_at as createdAt,
           dp.name as dropPointName, dp.code as dropPointCode,
           s.name as sectorName
    FROM users u
    LEFT JOIN drop_points dp ON u.drop_point_id = dp.id
    LEFT JOIN sectors s ON u.sector_id = s.id
    WHERE u.id = ?
  `).get(targetId) as any;

  if (!user) {
    return res.status(404).json({ error: 'Utilisateur introuvable' });
  }

  // Permission check
  if (currentUser.role !== 'SALES_ADMIN_NATIONAL') {
    if (currentUser.role === 'VRS' && currentUser.id !== targetId) {
      return res.status(403).json({ error: 'Accès non autorisé.' });
    }
    if (currentUser.dropPointId && user.dropPointId && currentUser.dropPointId !== user.dropPointId) {
      return res.status(403).json({ error: 'Cet utilisateur n\'appartient pas à votre Drop Point.' });
    }
  }

  // 1. Sales metrics
  const salesStats = db.prepare(`
    SELECT
      COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completedSalesCount,
      COUNT(CASE WHEN status = 'CANCELLED' THEN 1 END) as cancelledSalesCount,
      COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN total_amount ELSE 0 END), 0) as totalRevenue,
      COUNT(DISTINCT CASE WHEN status = 'COMPLETED' THEN point_of_sale_id END) as distinctPosServed
    FROM sales
    WHERE vrs_id = ?
  `).get(targetId) as any;

  // Cartons sold
  const cartonsRow = db.prepare(`
    SELECT COALESCE(SUM(si.quantity_cartons), 0) as totalCartons
    FROM sale_items si
    JOIN sales s ON si.sale_id = s.id
    WHERE s.vrs_id = ? AND s.status = 'COMPLETED'
  `).get(targetId) as any;

  const totalSalesCount = salesStats?.completedSalesCount || 0;
  const cancelledSalesCount = salesStats?.cancelledSalesCount || 0;
  const totalRevenue = salesStats?.totalRevenue || 0;
  const totalCartons = cartonsRow?.totalCartons || 0;
  const distinctPosServed = salesStats?.distinctPosServed || 0;
  const averageBasket = totalSalesCount > 0 ? Math.round(totalRevenue / totalSalesCount) : 0;

  // 2. Assigned POS / Potential in sector
  const posStats = db.prepare(`
    SELECT COUNT(*) as totalAssignedPos
    FROM points_of_sale
    WHERE (assigned_vrs_id = ? OR (drop_point_id = ? AND status IN ('ACTIF', 'VALIDE')))
  `).get(targetId, user.dropPointId || 0) as any;

  const totalAssignedPos = posStats?.totalAssignedPos || 10;
  const posCoverageRatio = totalAssignedPos > 0 ? Math.min(1, distinctPosServed / totalAssignedPos) : 0;

  // 3. Completed visits
  const visitsStats = db.prepare(`
    SELECT COUNT(*) as visitCount FROM visits WHERE vrs_id = ?
  `).get(targetId) as any;
  const completedVisits = visitsStats?.visitCount || 0;

  // 4. Rating Calculation on 10
  // Pilier 1: Volume & Chiffre d'Affaires (/10)
  let volumeScore = 6.0;
  if (totalCartons >= 100 || totalRevenue >= 2500000) volumeScore = 10.0;
  else if (totalCartons >= 60 || totalRevenue >= 1500000) volumeScore = 9.2;
  else if (totalCartons >= 30 || totalRevenue >= 750000) volumeScore = 8.5;
  else if (totalCartons >= 15 || totalRevenue >= 300000) volumeScore = 7.8;
  else if (totalCartons > 0) volumeScore = 7.0;

  // Pilier 2: Couverture & Pénétration PDV (/10)
  let coverageScore = 6.0;
  if (distinctPosServed >= 10) coverageScore = 9.8;
  else if (distinctPosServed >= 6) coverageScore = 9.0;
  else if (distinctPosServed >= 3) coverageScore = 8.2;
  else if (distinctPosServed >= 1) coverageScore = 7.4;

  // Pilier 3: Régularité Commerciale & Panier Moyen (/10)
  let regularityScore = 6.5;
  if (averageBasket >= 150000 && totalSalesCount >= 5) regularityScore = 9.6;
  else if (averageBasket >= 80000) regularityScore = 8.8;
  else if (averageBasket >= 40000) regularityScore = 8.0;
  else if (totalSalesCount > 0) regularityScore = 7.5;

  // Pilier 4: Rigueur Opérationnelle & Zéro Litige (/10)
  let reliabilityScore = 10.0;
  if (cancelledSalesCount > 0) {
    const errorRate = cancelledSalesCount / (totalSalesCount + cancelledSalesCount);
    reliabilityScore = Math.max(5.0, Number((10 - errorRate * 15).toFixed(1)));
  }

  // Note Globale Pondérée sur 10:
  // Volume (35%) + Couverture (25%) + Régularité (20%) + Fiabilité (20%)
  const rawGlobal = (volumeScore * 0.35) + (coverageScore * 0.25) + (regularityScore * 0.20) + (reliabilityScore * 0.20);
  const ratingScore = Number(rawGlobal.toFixed(1));

  let ratingAppreciation = 'Performance Standard (En progression)';
  let ratingColor = 'text-amber-400';
  let badgeLabel = 'AGENT CONFIRMÉ';

  if (ratingScore >= 9.0) {
    ratingAppreciation = 'Performance Exceptionnelle (Élite Réseau)';
    ratingColor = 'text-emerald-400';
    badgeLabel = 'TOP VENDEUR ÉLITE';
  } else if (ratingScore >= 8.0) {
    ratingAppreciation = 'Très Bon Rendement Commercial';
    ratingColor = 'text-blue-400';
    badgeLabel = 'PERFORMER CLASSE A';
  } else if (ratingScore >= 7.0) {
    ratingAppreciation = 'Bonne Activité Régulière';
    ratingColor = 'text-teal-400';
    badgeLabel = 'VENDEUR ACTIF';
  }

  const strengths: string[] = [];
  if (reliabilityScore >= 9.5) strengths.push('Excellente fiabilité d’exécution : taux de conformité et validation proche de 100%');
  if (volumeScore >= 8.5) strengths.push('Fort dynamisme commercial avec un volume de rotation élevé');
  if (coverageScore >= 8.5) strengths.push('Excellente diversification du portefeuille de points de vente livrés');
  if (regularityScore >= 8.5) strengths.push('Panier moyen par commande supérieur aux standards du secteur');
  if (strengths.length === 0) strengths.push('Bonne prise en main des outils terrain et assiduité commerciale');

  const recommendations: string[] = [];
  if (coverageScore < 9.0) recommendations.push('Visiter et réapprovisionner au moins 2 nouveaux points de vente cette semaine');
  if (volumeScore < 9.0) recommendations.push('Proposer des assortiments multi-produits pour stimuler le volume par commande');
  if (recommendations.length === 0) recommendations.push('Maintenir le cap d’excellence et partager les bonnes pratiques avec l’équipe');

  res.json({
    performance: {
      userId: user.id,
      vrsName: `${user.firstName} ${user.lastName}`,
      publicId: user.publicId,
      role: user.role,
      dropPointName: user.dropPointName,
      dropPointCode: user.dropPointCode,
      sectorName: user.sectorName,
      ratingScore,
      ratingAppreciation,
      ratingColor,
      badgeLabel,
      totalSalesCount,
      cancelledSalesCount,
      totalRevenue,
      totalCartons,
      distinctPosServed,
      averageBasket,
      completedVisits,
      posCoveragePercent: Math.round(posCoverageRatio * 100),
      criteria: {
        volumeScore: Number(volumeScore.toFixed(1)),
        coverageScore: Number(coverageScore.toFixed(1)),
        regularityScore: Number(regularityScore.toFixed(1)),
        reliabilityScore: Number(reliabilityScore.toFixed(1)),
      },
      strengths,
      recommendations,
    }
  });
});

// CREATE user
router.post('/', requireAuth, (req: AuthRequest, res: Response) => {
  const creator = req.user!;
  const { role, firstName, lastName, email, phone, dropPointId, salesAdminId, fssId, sectorId, photo, password } = req.body;

  if (!role || !firstName || !lastName || !phone) {
    return res.status(400).json({ error: 'Champs obligatoires manquants (rôle, prénom, nom, téléphone).' });
  }

  // Role permissions for creation: Seul le SAN peut créer des utilisateurs (SA, FSS, VRS)
  if (creator.role !== 'SALES_ADMIN_NATIONAL') {
    return res.status(403).json({ error: 'Accès refusé. Seul le Sales Admin National (SAN) peut créer des utilisateurs.' });
  }

  // Drop Point assignment
  let targetDpId = creator.role === 'SALES_ADMIN_NATIONAL'
    ? (dropPointId ? parseInt(dropPointId, 10) : null)
    : (creator.dropPointId || (dropPointId ? parseInt(dropPointId, 10) : null));

  if (role !== 'SALES_ADMIN_NATIONAL' && !targetDpId) {
    const firstDp = db.prepare('SELECT id FROM drop_points LIMIT 1').get() as { id: number } | undefined;
    targetDpId = firstDp?.id || null;
  }

  if (role !== 'SALES_ADMIN_NATIONAL' && !targetDpId) {
    return res.status(400).json({ error: 'Un Drop Point est requis pour ce rôle.' });
  }

  let dpCode = 'NAT';
  if (targetDpId) {
    const dp = db.prepare('SELECT code FROM drop_points WHERE id = ?').get(targetDpId) as { code: string } | undefined;
    if (!dp) {
      return res.status(400).json({ error: 'Drop Point inexistant.' });
    }
    dpCode = dp.code;
  }

  const publicId = generateUserPublicId(role, dpCode);

  // Safe unique email generation if not provided or already taken
  let cleanEmail = (email && typeof email === 'string' && email.trim().length > 0)
    ? email.trim().toLowerCase()
    : `${publicId.toLowerCase().replace(/[^a-z0-9]/g, '')}@6cdist.com`;

  let finalEmail = cleanEmail;
  let emailCounter = 1;
  while (db.prepare('SELECT id FROM users WHERE email = ?').get(finalEmail)) {
    const namePart = cleanEmail.includes('@') ? cleanEmail.split('@')[0] : cleanEmail;
    finalEmail = `${namePart}${emailCounter}@6cdist.com`;
    emailCounter++;
  }

  const passwordToHash = password || '6CDist@2026';
  const passwordHash = bcrypt.hashSync(passwordToHash, 10);

  try {
    const insertStmt = db.prepare(`
      INSERT INTO users (
        public_id, role, first_name, last_name, email, phone,
        password_hash, photo, drop_point_id, sales_admin_id, fss_id, sector_id, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIF')
    `);

    const photoValue = photo && typeof photo === 'string' && photo.trim().length > 0 ? photo.trim() : null;
    const finalFssId = fssId ? parseInt(fssId, 10) : null;

    const result = insertStmt.run(
      publicId,
      role,
      firstName.trim(),
      lastName.trim(),
      finalEmail,
      phone.trim(),
      passwordHash,
      photoValue,
      targetDpId,
      salesAdminId ? parseInt(salesAdminId, 10) : null,
      finalFssId,
      sectorId ? parseInt(sectorId, 10) : null
    );

    const newUserId = result.lastInsertRowid as number;

    // If new user is VRS, initialize their personal stock table with 0 for all products (strictly 0, no automatic allocation)
    if (role === 'VRS' && targetDpId) {
      const prods = db.prepare('SELECT id FROM products').all() as { id: number }[];
      const vrsStockStmt = db.prepare(`
        INSERT OR IGNORE INTO vrs_stocks (vrs_id, drop_point_id, product_id, available_quantity, reserved_quantity, alert_threshold)
        VALUES (?, ?, ?, 0, 0, 5)
      `);
      for (const p of prods) {
        vrsStockStmt.run(newUserId, targetDpId, p.id);
      }
    }

    logActivity(creator, 'CREATE_USER', publicId, `Création utilisateur ${publicId} (${role} - ${firstName} ${lastName})`, req);
    triggerMasterBackup(false);

    const createdUser = db.prepare(`
      SELECT id, public_id as publicId, role, first_name as firstName, last_name as lastName, email, phone, photo, status
      FROM users WHERE id = ?
    `).get(newUserId);

    res.status(201).json({
      user: createdUser,
      publicId,
      temporaryPassword: passwordToHash,
      message: `Utilisateur ${firstName} ${lastName} créé avec succès. Identifiant généré: ${publicId}`
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erreur lors de la création de l\'utilisateur.' });
  }
});

// POST send credentials to user via WhatsApp & Email
router.post('/:id/send-credentials', requireAuth, (req: AuthRequest, res: Response) => {
  const requester = req.user!;
  const targetId = parseInt(req.params.id, 10);
  const { temporaryPassword } = req.body;

  const target = db.prepare(`
    SELECT u.*, dp.name as drop_point_name, dp.code as drop_point_code
    FROM users u
    LEFT JOIN drop_points dp ON u.drop_point_id = dp.id
    WHERE u.id = ?
  `).get(targetId) as any;

  if (!target) {
    return res.status(404).json({ error: 'Utilisateur introuvable.' });
  }

  // Permission check: SAN can send to anyone; SA can send to their drop point users; FSS to their VRS; or user to themselves
  if (requester.id !== target.id && requester.role !== 'SALES_ADMIN_NATIONAL') {
    if (requester.role === 'SALES_ADMIN' && requester.dropPointId !== target.drop_point_id) {
      return res.status(403).json({ error: 'Action non autorisée.' });
    }
    if (requester.role === 'FSS' && (target.fss_id !== requester.id || target.role !== 'VRS')) {
      return res.status(403).json({ error: 'Action non autorisée.' });
    }
  }

  const tempPass = temporaryPassword || '6CDist@2026';
  const roleLabels: Record<string, string> = {
    'SALES_ADMIN_NATIONAL': 'Sales Admin National',
    'SALES_ADMIN': 'Sales Admin (Dépôt)',
    'FSS': 'Field Sales Supervisor (FSS)',
    'VRS': 'Vendeur Terrain (VRS)'
  };
  const roleName = roleLabels[target.role] || target.role;
  const dpName = target.drop_point_name ? `${target.drop_point_name} (${target.drop_point_code})` : 'Direction Nationale';

  // Construct official WhatsApp text message
  const waMessage = 
`*6C DISTRIBUTION - VOS IDENTIFIANTS DE CONNEXION* 📦
Bonjour *${target.first_name} ${target.last_name}*,

Voici vos informations d'accès officielles à l'application 6C Distribution :
👤 *Rôle :* ${roleName}
📍 *Dépôt :* ${dpName}
🆔 *Identifiant :* *${target.public_id}*
🔑 *Mot de passe provisoire :* *${tempPass}*

🔒 *Sécurité :* Une fois connecté, vous pourrez modifier votre mot de passe depuis votre Profil.
Bonne mission au sein de l'équipe 6C Distribution !`;

  // Clean phone number for WhatsApp wa.me link
  let cleanPhone = (target.phone || '').replace(/[^0-9]/g, '');
  if (cleanPhone.length === 8) {
    cleanPhone = '223' + cleanPhone;
  }
  const whatsappUrl = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(waMessage)}` : null;

  // Email subject and body
  const emailSubject = `6C Distribution - Vos identifiants de connexion (${target.public_id})`;
  const emailBody = 
`Bonjour ${target.first_name} ${target.last_name},

Bienvenue sur la plateforme 6C Distribution. Voici vos identifiants d'accès professionnels :

- Rôle : ${roleName}
- Dépôt / Drop Point : ${dpName}
- Identifiant de connexion : ${target.public_id}
- Mot de passe provisoire : ${tempPass}

Consigne importante :
Une fois connecté, rendez-vous dans la section "Profil" pour personnaliser et modifier votre mot de passe.

Cordialement,
La Direction Commerciale - 6C Distribution`;

  const mailtoUrl = target.email ? `mailto:${encodeURIComponent(target.email)}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}` : null;

  // Log in notifications
  try {
    db.prepare(`
      INSERT INTO notifications (user_id, role, drop_point_id, title, message, type, link)
      VALUES (?, ?, ?, 'Accès & Identifiants générés', ?, 'SYSTEM', '/profile')
    `).run(
      target.id,
      target.role,
      target.drop_point_id || null,
      `Identifiants transmis pour ${target.first_name} ${target.last_name} (${target.public_id}).`
    );
  } catch (_e) {}

  // Log in activity logs
  logActivity(
    requester,
    'SEND_CREDENTIALS',
    target.public_id,
    `Transmission des accès pour ${target.public_id} (WhatsApp: ${target.phone || 'Non renseigné'}, Email: ${target.email || 'Non renseigné'})`,
    req
  );

  res.json({
    success: true,
    message: 'Informations de connexion prêtes pour transmission',
    publicId: target.public_id,
    phone: target.phone,
    email: target.email,
    temporaryPassword: tempPass,
    whatsappUrl,
    whatsappMessage: waMessage,
    mailtoUrl,
    emailSubject,
    emailBody
  });
});

// UPDATE user
router.patch('/:id', requireAuth, (req: AuthRequest, res: Response) => {
  const creator = req.user!;
  const targetId = parseInt(req.params.id, 10);

  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(targetId) as any;
  if (!target) {
    return res.status(404).json({ error: 'Utilisateur introuvable.' });
  }

  // Seul le SAN peut modifier ou suspendre des utilisateurs (SA, FSS, VRS)
  if (creator.role !== 'SALES_ADMIN_NATIONAL') {
    return res.status(403).json({ error: 'Accès refusé. Seul le Sales Admin National (SAN) peut modifier ou suspendre un utilisateur.' });
  }

  const { firstName, lastName, phone, email, status, sectorId, fssId, salesAdminId, photo, dropPointId } = req.body;

  // Reassignment of Drop Point is exclusively allowed for SALES_ADMIN_NATIONAL
  let newDropPointId = target.drop_point_id;
  let newSectorId = sectorId !== undefined ? (sectorId ? parseInt(sectorId, 10) : null) : target.sector_id;
  let newFssId = fssId !== undefined ? (fssId ? parseInt(fssId, 10) : null) : target.fss_id;
  let newSalesAdminId = salesAdminId !== undefined ? (salesAdminId ? parseInt(salesAdminId, 10) : null) : target.sales_admin_id;

  if (creator.role === 'SALES_ADMIN_NATIONAL' && dropPointId !== undefined && dropPointId !== null) {
    const parsedDpId = parseInt(dropPointId, 10);
    if (!isNaN(parsedDpId) && parsedDpId !== target.drop_point_id) {
      newDropPointId = parsedDpId;
      const newDp = db.prepare('SELECT id, name, code FROM drop_points WHERE id = ?').get(newDropPointId) as any;
      if (newDp) {
        // Automatically link to the Sales Admin of the new drop point if not specified
        if (salesAdminId === undefined) {
          const newSa = db.prepare('SELECT id FROM users WHERE role = "SALES_ADMIN" AND drop_point_id = ?').get(newDropPointId) as any;
          newSalesAdminId = newSa ? newSa.id : null;
        }

        // If sector was not explicitly passed, check if the old sector belongs to the new drop point
        if (sectorId === undefined && target.sector_id) {
          const secBelongs = db.prepare('SELECT id FROM sectors WHERE id = ? AND drop_point_id = ?').get(target.sector_id, newDropPointId);
          if (!secBelongs) {
            newSectorId = null;
          }
        }

        // If FSS was not explicitly passed, check if the old FSS belongs to the new drop point
        if (fssId === undefined && target.fss_id) {
          const fssBelongs = db.prepare('SELECT id FROM users WHERE id = ? AND drop_point_id = ?').get(target.fss_id, newDropPointId);
          if (!fssBelongs) {
            newFssId = null;
          }
        }

        // Reassign the VRS stocks tracking to the new drop point
        db.prepare(`
          UPDATE vrs_stocks
          SET drop_point_id = ?, updated_at = CURRENT_TIMESTAMP
          WHERE vrs_id = ?
        `).run(newDropPointId, target.id);

        // Notification to the vendor (VRS)
        db.prepare(`
          INSERT INTO notifications (user_id, role, drop_point_id, title, message, type, link)
          VALUES (?, 'VRS', ?, 'Nouvelle Affectation Dépôt', ?, 'SYSTEM', '/users')
        `).run(
          target.id,
          newDropPointId,
          `Vous avez été réaffecté au Dépôt ${newDp.name} (${newDp.code}) par le Sales Admin National.`
        );

        // Notification to the Sales Admin of the destination Drop Point
        db.prepare(`
          INSERT INTO notifications (role, drop_point_id, title, message, type, link)
          VALUES ('SALES_ADMIN', ?, 'Nouveau Vendeur Rattaché', ?, 'SYSTEM', '/users')
        `).run(
          newDropPointId,
          `Le vendeur ${target.first_name} ${target.last_name} (${target.public_id}) a été rattaché à votre dépôt.`
        );

        logActivity(
          creator,
          'REASSIGN_SELLER_DROP_POINT',
          target.public_id,
          `Réaffectation du vendeur ${target.first_name} ${target.last_name} au Dépôt ${newDp.name} (${newDp.code})`,
          req
        );
      }
    }
  }

  db.prepare(`
    UPDATE users
    SET first_name = COALESCE(?, first_name),
        last_name = COALESCE(?, last_name),
        phone = COALESCE(?, phone),
        email = COALESCE(?, email),
        status = COALESCE(?, status),
        sector_id = ?,
        fss_id = ?,
        sales_admin_id = ?,
        photo = COALESCE(?, photo),
        drop_point_id = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    firstName || null,
    lastName || null,
    phone || null,
    email || null,
    status || null,
    newSectorId,
    newFssId,
    newSalesAdminId,
    photo || null,
    newDropPointId,
    targetId
  );

  logActivity(creator, 'UPDATE_USER', target.public_id, `Modification du profil utilisateur #${targetId}`, req);

  const updated = db.prepare(`
    SELECT u.id, u.public_id as publicId, u.role, u.first_name as firstName, u.last_name as lastName,
           u.status, u.drop_point_id as dropPointId, dp.name as dropPointName, dp.code as dropPointCode
    FROM users u
    LEFT JOIN drop_points dp ON u.drop_point_id = dp.id
    WHERE u.id = ?
  `).get(targetId);
  res.json({ user: updated, message: 'Utilisateur et affectation mis à jour avec succès.' });
});

// POST synchronize GPS trajectory breadcrumbs collected offline
router.post('/sync-offline-trajectory', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const { points } = req.body;

  if (!Array.isArray(points) || points.length === 0) {
    return res.json({ success: true, count: 0, message: 'Aucun point GPS à synchroniser.' });
  }

  const vrsId = user.id;
  let insertedCount = 0;
  let latestLat: number | null = null;
  let latestLng: number | null = null;
  let latestAcc: number | null = null;

  const insertStmt = db.prepare(`
    INSERT INTO vrs_location_history (vrs_id, user_id, latitude, longitude, accuracy, speed, action_context, recorded_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const tx = db.transaction(() => {
    for (const pt of points) {
      const lat = typeof pt.latitude === 'number' ? pt.latitude : parseFloat(pt.latitude);
      const lng = typeof pt.longitude === 'number' ? pt.longitude : parseFloat(pt.longitude);
      const acc = pt.accuracy ? parseFloat(pt.accuracy) : null;
      const spd = pt.speed ? parseFloat(pt.speed) : null;
      const ctx = pt.actionContext || pt.action_context || 'PARCOURS_TERRAIN_SYNC';
      const time = pt.recordedAt || pt.recorded_at || pt.timestamp || new Date().toISOString();

      if (isNaN(lat) || isNaN(lng) || (Math.abs(lat) < 0.001 && Math.abs(lng) < 0.001)) {
        continue;
      }

      insertStmt.run(vrsId, vrsId, lat, lng, acc, spd, ctx, time);
      insertedCount++;

      latestLat = lat;
      latestLng = lng;
      latestAcc = acc;
    }

    if (latestLat !== null && latestLng !== null) {
      db.prepare(`
        UPDATE users
        SET last_latitude = ?, last_longitude = ?, last_location_accuracy = ?, last_location_updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(latestLat, latestLng, latestAcc, vrsId);
    }
  });

  try {
    tx();
    res.json({
      success: true,
      count: insertedCount,
      message: `${insertedCount} point(s) GPS de trajet synchronisé(s) avec succès. Trajet complet consultable par le SA et le SAN sur la carte.`,
    });
  } catch (err: any) {
    console.error('Error syncing offline trajectory:', err);
    res.status(500).json({ error: err.message || 'Erreur lors de la synchronisation du parcours GPS.' });
  }
});

export default router;
