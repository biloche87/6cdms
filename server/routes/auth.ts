import { Router, type Response } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db.ts';
import { generateToken, requireAuth, type AuthRequest, logActivity } from '../auth.ts';

const router = Router();

// List demo accounts
router.get('/demo-accounts', (_req, res) => {
  const accounts = [
    {
      role: 'SALES_ADMIN_NATIONAL',
      roleLabel: 'Sales Admin National',
      publicId: '6CDISTSAN',
      name: 'Amadou Touré',
      description: 'Supervision nationale de tous les Drop Points, stocks, ventes et utilisateurs.',
      scope: 'Global (Tous les Drop Points)',
      defaultPassword: '6CDist@2026'
    },
    {
      role: 'SALES_ADMIN',
      roleLabel: 'Sales Admin Drop Point',
      publicId: '6CDISTSA-DKN',
      name: 'Fatoumata Diarra',
      description: 'Responsable du Drop Point DAKAN (Stocks, Réceptions BL, Approvisionnements, Équipes).',
      scope: 'Drop Point DAKAN uniquement',
      defaultPassword: '6CDist@2026'
    },
    {
      role: 'FSS',
      roleLabel: 'Field Sales Supervisor',
      publicId: '6CDISTFSS-DKN',
      name: 'Oumar Coulibaly',
      description: 'Superviseur terrain : suivi des vendeurs VRS, tournées et performances secteur.',
      scope: 'Drop Point DAKAN & équipe VRS',
      defaultPassword: '6CDist@2026'
    },
    {
      role: 'VRS',
      roleLabel: 'Vendeur Terrain (VRS)',
      publicId: '6CDISTVRS-DKN-001',
      name: 'Ibrahim Sangaré',
      description: 'Vendeur terrain : prise de commande, vente directe déstockée, création PDV, visites.',
      scope: 'DAKAN - Secteur 01 - Stock personnel',
      defaultPassword: '6CDist@2026'
    }
  ];
  res.json({ accounts });
});

// Login
router.post('/login', (req, res) => {
  const { identifier, password } = req.body;

  if (!identifier || !password) {
    return res.status(400).json({ error: 'Identifiant et mot de passe requis.' });
  }

  const cleanIdentifier = String(identifier).trim().toUpperCase();

  const user = db.prepare(`
    SELECT u.id, u.public_id as publicId, u.role, u.first_name as firstName, u.last_name as lastName,
           u.email, u.phone, u.photo, u.drop_point_id as dropPointId, u.sales_admin_id as salesAdminId,
           u.fss_id as fssId, u.sector_id as sectorId, u.status, u.password_hash as passwordHash,
           dp.name as dropPointName, dp.code as dropPointCode,
           s.name as sectorName
    FROM users u
    LEFT JOIN drop_points dp ON u.drop_point_id = dp.id
    LEFT JOIN sectors s ON u.sector_id = s.id
    WHERE UPPER(u.public_id) = ? OR UPPER(u.email) = ?
  `).get(cleanIdentifier, cleanIdentifier) as any;

  if (!user) {
    return res.status(401).json({ error: 'Identifiant ou mot de passe incorrect.' });
  }

  const isValid = bcrypt.compareSync(password, user.passwordHash);
  if (!isValid) {
    return res.status(401).json({ error: 'Identifiant ou mot de passe incorrect.' });
  }

  if (user.status === 'SUSPENDU' || user.status === 'INACTIF') {
    return res.status(403).json({ error: 'Votre compte est suspendu ou inactif. Contactez la direction.' });
  }

  const safeUser = {
    id: user.id,
    publicId: user.publicId,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone,
    photo: user.photo,
    dropPointId: user.dropPointId,
    dropPointName: user.dropPointName,
    dropPointCode: user.dropPointCode,
    salesAdminId: user.salesAdminId,
    fssId: user.fssId,
    sectorId: user.sectorId,
    sectorName: user.sectorName,
    status: user.status
  };

  const token = generateToken(safeUser as any);

  logActivity(safeUser, 'LOGIN', 'AUTHENTICATION', `Connexion réussie sous le rôle ${user.role}`, req);

  res.json({
    token,
    user: safeUser,
    message: `Bienvenue ${user.firstName} ${user.lastName} (${user.role})`
  });
});

// Current user
router.get('/me', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const extra = db.prepare(`
    SELECT dp.name as dropPointName, dp.code as dropPointCode,
           s.name as sectorName
    FROM users u
    LEFT JOIN drop_points dp ON u.drop_point_id = dp.id
    LEFT JOIN sectors s ON u.sector_id = s.id
    WHERE u.id = ?
  `).get(user.id) as any;

  res.json({
    user: {
      ...user,
      dropPointName: extra?.dropPointName,
      dropPointCode: extra?.dropPointCode,
      sectorName: extra?.sectorName
    }
  });
});

// Logout
router.post('/logout', requireAuth, (req: AuthRequest, res: Response) => {
  logActivity(req.user!, 'LOGOUT', 'AUTHENTICATION', 'Déconnexion volontaire', req);
  res.json({ message: 'Déconnexion effectuée avec succès.' });
});

// Profile update
router.patch('/profile', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const { phone, email, photo, currentPassword, newPassword, password } = req.body;
  const effectiveNewPassword = newPassword || password;

  if (effectiveNewPassword) {
    const currentHash = (db.prepare('SELECT password_hash FROM users WHERE id = ?').get(user.id) as any)?.password_hash;
    
    if (currentPassword) {
      if (!currentHash || !bcrypt.compareSync(currentPassword, currentHash)) {
        return res.status(400).json({ error: 'Le mot de passe actuel est incorrect. (Rappel : le mot de passe initial par défaut est 6CDist@2026).' });
      }
    } else {
      // If currentPassword is not explicitly passed, check if the user is still on the default temporary password
      const isDefault = currentHash && bcrypt.compareSync('6CDist@2026', currentHash);
      if (!isDefault) {
        return res.status(400).json({ error: 'Veuillez saisir votre mot de passe actuel pour des raisons de sécurité.' });
      }
    }

    if (effectiveNewPassword.length < 6) {
      return res.status(400).json({ error: 'Le nouveau mot de passe doit comporter au moins 6 caractères.' });
    }
    const newHash = bcrypt.hashSync(effectiveNewPassword, 10);
    db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newHash, user.id);
  }

  // Handle phone and email updates
  if (phone !== undefined || email !== undefined) {
    db.prepare(`
      UPDATE users
      SET phone = COALESCE(?, phone),
          email = COALESCE(?, email),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(phone || null, email || null, user.id);
  }

  // Handle photo update (support explicit null or empty string to clear photo)
  if (photo !== undefined) {
    const photoVal = photo && typeof photo === 'string' && photo.trim().length > 0 ? photo.trim() : null;
    db.prepare(`
      UPDATE users
      SET photo = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(photoVal, user.id);
  }

  logActivity(user, 'UPDATE_PROFILE', 'USERS', 'Mise à jour des informations du profil et/ou du mot de passe', req);

  const updated = db.prepare(`
    SELECT id, public_id as publicId, role, first_name as firstName, last_name as lastName,
           email, phone, photo, drop_point_id as dropPointId, status
    FROM users WHERE id = ?
  `).get(user.id);

  res.json({ user: updated, message: 'Profil mis à jour avec succès.' });
});

// POST to request my credentials via WhatsApp / Email
router.post('/send-my-credentials', requireAuth, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const target = db.prepare(`
    SELECT u.*, dp.name as drop_point_name, dp.code as drop_point_code
    FROM users u
    LEFT JOIN drop_points dp ON u.drop_point_id = dp.id
    WHERE u.id = ?
  `).get(user.id) as any;

  if (!target) {
    return res.status(404).json({ error: 'Utilisateur introuvable.' });
  }

  const roleLabels: Record<string, string> = {
    'SALES_ADMIN_NATIONAL': 'Sales Admin National',
    'SALES_ADMIN': 'Sales Admin (Dépôt)',
    'FSS': 'Field Sales Supervisor (FSS)',
    'VRS': 'Vendeur Terrain (VRS)'
  };
  const roleName = roleLabels[target.role] || target.role;
  const dpName = target.drop_point_name ? `${target.drop_point_name} (${target.drop_point_code})` : 'Direction Nationale';

  const waMessage = 
`*6C DISTRIBUTION - MES INFORMATIONS D'ACCÈS* 📦
Bonjour *${target.first_name} ${target.last_name}*,

Voici vos accès à la plateforme 6C Distribution :
👤 *Rôle :* ${roleName}
📍 *Dépôt :* ${dpName}
🆔 *Identifiant :* *${target.public_id}*
📱 *Téléphone :* ${target.phone || 'Non renseigné'}
✉️ *Email :* ${target.email || 'Non renseigné'}

🔒 *Rappel sécurité :* Vous pouvez changer votre mot de passe à tout moment dans votre Profil.`;

  let cleanPhone = (target.phone || '').replace(/[^0-9]/g, '');
  if (cleanPhone.length === 8) {
    cleanPhone = '223' + cleanPhone;
  }
  const whatsappUrl = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(waMessage)}` : null;

  const emailSubject = `6C Distribution - Récapitulatif de mes accès (${target.public_id})`;
  const emailBody = 
`Bonjour ${target.first_name} ${target.last_name},

Voici le récapitulatif officiel de votre compte 6C Distribution :
- Rôle : ${roleName}
- Dépôt / Drop Point : ${dpName}
- Identifiant : ${target.public_id}

Vous pouvez modifier votre mot de passe ou mettre à jour vos coordonnées directement dans l'onglet Profil de l'application.

Direction Commerciale - 6C Distribution`;

  const mailtoUrl = target.email ? `mailto:${encodeURIComponent(target.email)}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}` : null;

  logActivity(user, 'SEND_MY_CREDENTIALS', target.public_id, 'Réception du récapitulatif des identifiants', req);

  res.json({
    success: true,
    message: 'Récapitulatif des accès généré',
    publicId: target.public_id,
    phone: target.phone,
    email: target.email,
    whatsappUrl,
    whatsappMessage: waMessage,
    mailtoUrl,
    emailSubject,
    emailBody
  });
});

export default router;
