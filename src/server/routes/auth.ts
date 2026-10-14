import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db/models.js';
import { generateToken, requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { UserRole } from '../types.js';

const router = Router();

// Signup
router.post('/signup', async (req: Request, res: Response) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'Name, email, password, and role are required.' });
    }

    if (role !== 'brand' && role !== 'creator') {
      return res.status(400).json({ error: 'Role must be either "brand" or "creator".' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await db.users.findByEmail(normalizedEmail);
    if (existing) {
      return res.status(409).json({ error: 'User with this email already exists.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await db.users.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      role: role as UserRole,
    });

    const token = generateToken({
      userId: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    });

    return res.status(201).json({
      message: 'Signup successful.',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err: any) {
    console.error('Signup error:', err);
    return res.status(500).json({ error: 'Failed to create user: ' + err.message });
  }
});

// Login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = await db.users.findByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = generateToken({
      userId: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    });

    return res.json({
      message: 'Login successful.',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err: any) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Login failed: ' + err.message });
  }
});

// Me (Current authenticated user profile)
router.get('/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await db.users.findById(req.user!.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    return res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch user: ' + err.message });
  }
});

// Demo accounts for instant 1-click testability
router.get('/demo-users', async (_req: Request, res: Response) => {
  try {
    const users = await db.users.getAll();
    const demoList = users.map((u) => ({
      id: u._id,
      name: u.name,
      email: u.email,
      role: u.role,
    }));
    return res.json(demoList);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
