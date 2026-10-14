import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';
import { IUser, ICampaign, ISubmission, IMilestone, IViewUpdateHistory } from '../types.js';

/* ==========================================================
   MONGOOSE SCHEMAS
   ========================================================== */

export interface IUserDoc extends Document, Omit<IUser, '_id'> {}
export interface ICampaignDoc extends Document, Omit<ICampaign, '_id'> {}
export interface ISubmissionDoc extends Document, Omit<ISubmission, '_id'> {}

const MilestoneSchema = new Schema<IMilestone>(
  {
    viewThreshold: { type: Number, required: true },
    payout: { type: Number, required: true },
  },
  { _id: false }
);

const ViewHistorySchema = new Schema<IViewUpdateHistory>(
  {
    views: { type: Number, required: true },
    deltaViews: { type: Number, default: 0 },
    payoutDisbursed: { type: Number, default: 0 },
    cumulativePayout: { type: Number, default: 0 },
    withheldAmount: { type: Number, default: 0 },
    milestoneReached: { type: Number, default: 0 },
    timestamp: { type: Date, default: Date.now },
    note: { type: String },
  },
  { _id: false }
);

const UserSchema = new Schema<IUserDoc>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['brand', 'creator'], required: true },
  },
  { timestamps: true }
);

const CampaignSchema = new Schema<ICampaignDoc>(
  {
    brandId: { type: String, required: true, index: true },
    brandName: { type: String, default: 'Brand' },
    name: { type: String, required: true, trim: true },
    platform: { type: String, enum: ['Instagram', 'YouTube'], required: true },
    totalBudget: { type: Number, required: true, min: 0 },
    spentBudget: { type: Number, default: 0, min: 0 },
    withheldBudget: { type: Number, default: 0, min: 0 },
    milestones: { type: [MilestoneSchema], default: [] },
    status: { type: String, enum: ['active', 'completed', 'paused'], default: 'active' },
  },
  { timestamps: true }
);

const SubmissionSchema = new Schema<ISubmissionDoc>(
  {
    campaignId: { type: String, required: true, index: true },
    creatorId: { type: String, required: true, index: true },
    creatorName: { type: String, default: 'Creator' },
    postUrl: { type: String, required: true, trim: true },
    currentViews: { type: Number, default: 0, min: 0 },
    previousViews: { type: Number, default: 0, min: 0 },
    lastViewUpdatedAt: { type: Date, default: Date.now },
    highestMilestoneThreshold: { type: Number, default: 0 },
    totalPayoutReceived: { type: Number, default: 0 },
    withheldPayout: { type: Number, default: 0 },
    payoutStatus: {
      type: String,
      enum: ['none', 'paid', 'withheld_budget_capped', 'flagged'],
      default: 'none',
    },
    flaggedForSpike: { type: Boolean, default: false },
    spikeReason: { type: String },
    history: { type: [ViewHistorySchema], default: [] },
  },
  { timestamps: true }
);

export const UserModel = mongoose.models.User || mongoose.model<IUserDoc>('User', UserSchema);
export const CampaignModel = mongoose.models.Campaign || mongoose.model<ICampaignDoc>('Campaign', CampaignSchema);
export const SubmissionModel = mongoose.models.Submission || mongoose.model<ISubmissionDoc>('Submission', SubmissionSchema);

/* ==========================================================
   PERSISTENCE LAYER (MongoDB Atlas + Resilient Memory Fallback)
   ========================================================== */

let isMongoConnected = false;
let dbMode: 'mongodb' | 'memory' = 'memory';

// In-Memory store for preview reliability when MONGODB_URI is not set
class MemoryStore {
  users: IUser[] = [];
  campaigns: ICampaign[] = [];
  submissions: ISubmission[] = [];

  constructor() {
    this.seedDefaultData();
  }

  seedDefaultData() {
    const salt = bcrypt.genSaltSync(10);
    const demoPasswordHash = bcrypt.hashSync('demo1234', salt);

    // Seed Brands
    const brandNike: IUser = {
      _id: 'brand_nike_01',
      name: 'Nike India',
      email: 'brand@nike.com',
      passwordHash: demoPasswordHash,
      role: 'brand',
      createdAt: new Date(),
    };

    const brandPuma: IUser = {
      _id: 'brand_puma_02',
      name: 'Puma Hype',
      email: 'collab@puma.com',
      passwordHash: demoPasswordHash,
      role: 'brand',
      createdAt: new Date(),
    };

    // Seed Creators
    const creatorDank: IUser = {
      _id: 'creator_dank_01',
      name: 'Dank Indian Memes',
      email: 'creator@dankmemes.com',
      passwordHash: demoPasswordHash,
      role: 'creator',
      createdAt: new Date(),
    };

    const creatorClips: IUser = {
      _id: 'creator_clips_02',
      name: 'Daily Viral Clips',
      email: 'clips@dailyviral.com',
      passwordHash: demoPasswordHash,
      role: 'creator',
      createdAt: new Date(),
    };

    this.users = [brandNike, brandPuma, creatorDank, creatorClips];

    // Seed Campaigns
    const campaign1: ICampaign = {
      _id: 'camp_001',
      brandId: 'brand_nike_01',
      brandName: 'Nike India',
      name: 'Air Max Monsoon Viral Reels',
      platform: 'Instagram',
      totalBudget: 15000,
      spentBudget: 2500,
      withheldBudget: 0,
      milestones: [
        { viewThreshold: 10000, payout: 500 },
        { viewThreshold: 50000, payout: 2000 },
        { viewThreshold: 100000, payout: 5000 },
      ],
      status: 'active',
      createdAt: new Date(Date.now() - 86400000 * 2),
      updatedAt: new Date(),
    };

    const campaign2: ICampaign = {
      _id: 'camp_002',
      brandId: 'brand_puma_02',
      brandName: 'Puma Hype',
      name: 'SpeedCat Street Clips 2026',
      platform: 'YouTube',
      totalBudget: 6000,
      spentBudget: 5000,
      withheldBudget: 0,
      milestones: [
        { viewThreshold: 20000, payout: 1000 },
        { viewThreshold: 75000, payout: 3000 },
        { viewThreshold: 150000, payout: 6000 },
      ],
      status: 'active',
      createdAt: new Date(Date.now() - 86400000),
      updatedAt: new Date(),
    };

    this.campaigns = [campaign1, campaign2];

    // Seed Submissions
    const sub1: ISubmission = {
      _id: 'sub_001',
      campaignId: 'camp_001',
      creatorId: 'creator_dank_01',
      creatorName: 'Dank Indian Memes',
      postUrl: 'https://instagram.com/reel/C7x9_AirMaxMeme',
      currentViews: 52400,
      previousViews: 12000,
      lastViewUpdatedAt: new Date(Date.now() - 3600000 * 4),
      highestMilestoneThreshold: 50000,
      totalPayoutReceived: 2000,
      withheldPayout: 0,
      payoutStatus: 'paid',
      flaggedForSpike: false,
      history: [
        {
          views: 12000,
          deltaViews: 12000,
          payoutDisbursed: 500,
          cumulativePayout: 500,
          withheldAmount: 0,
          milestoneReached: 10000,
          timestamp: new Date(Date.now() - 86400000),
          note: 'Crossed 10K milestone',
        },
        {
          views: 52400,
          deltaViews: 40400,
          payoutDisbursed: 1500,
          cumulativePayout: 2000,
          withheldAmount: 0,
          milestoneReached: 50000,
          timestamp: new Date(Date.now() - 3600000 * 4),
          note: 'Crossed 50K milestone (Earned incremental ₹1,500)',
        },
      ],
      createdAt: new Date(Date.now() - 86400000 * 1.5),
      updatedAt: new Date(),
    };

    const sub2: ISubmission = {
      _id: 'sub_002',
      campaignId: 'camp_001',
      creatorId: 'creator_clips_02',
      creatorName: 'Daily Viral Clips',
      postUrl: 'https://instagram.com/reel/C8y0_SolesOnFire',
      currentViews: 14500,
      previousViews: 0,
      lastViewUpdatedAt: new Date(Date.now() - 3600000 * 2),
      highestMilestoneThreshold: 10000,
      totalPayoutReceived: 500,
      withheldPayout: 0,
      payoutStatus: 'paid',
      flaggedForSpike: false,
      history: [
        {
          views: 14500,
          deltaViews: 14500,
          payoutDisbursed: 500,
          cumulativePayout: 500,
          withheldAmount: 0,
          milestoneReached: 10000,
          timestamp: new Date(Date.now() - 3600000 * 2),
          note: 'Crossed 10K milestone',
        },
      ],
      createdAt: new Date(Date.now() - 3600000 * 12),
      updatedAt: new Date(),
    };

    this.submissions = [sub1, sub2];
  }
}

export const memoryStore = new MemoryStore();

let lastDbMessage = '';

export function sanitizeMongoUri(rawUri?: string): string {
  if (!rawUri) return '';
  let uri = rawUri.trim();
  // Strip quotes if the user entered them with quotes in environment / secrets UI
  uri = uri.replace(/^["']+|["']+$/g, '').trim();
  return uri;
}

/**
 * Initializes database connection.
 * Attempts Mongoose connection if MONGODB_URI is provided in environment.
 */
export async function initDatabase(): Promise<{ mode: 'mongodb' | 'memory'; connected: boolean; message: string }> {
  const rawUri = process.env.MONGODB_URI;
  const uri = sanitizeMongoUri(rawUri);

  if (uri && (uri.startsWith('mongodb://') || uri.startsWith('mongodb+srv://'))) {
    try {
      console.log('[DB] Connecting to MongoDB Atlas...');
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 5000,
        dbName: 'memed',
      });
      isMongoConnected = true;
      dbMode = 'mongodb';
      lastDbMessage = 'Connected to MongoDB Atlas';
      console.log('[DB] Successfully connected to MongoDB Atlas.');

      // Seed initial data if MongoDB Atlas database is empty
      try {
        const campaignCount = await CampaignModel.countDocuments();
        if (campaignCount === 0) {
          console.log('[DB] Seeding default campaigns & demo accounts into MongoDB Atlas...');
          for (const user of memoryStore.users) {
            await UserModel.updateOne({ email: user.email }, { $setOnInsert: user }, { upsert: true });
          }
          for (const camp of memoryStore.campaigns) {
            await CampaignModel.updateOne({ _id: camp._id }, { $setOnInsert: camp }, { upsert: true });
          }
          for (const sub of memoryStore.submissions) {
            await SubmissionModel.updateOne({ _id: sub._id }, { $setOnInsert: sub }, { upsert: true });
          }
          console.log('[DB] Seeding complete.');
        }
      } catch (seedErr: any) {
        console.warn('[DB] Seeding notice:', seedErr.message);
      }

      return { mode: 'mongodb', connected: true, message: lastDbMessage };
    } catch (err: any) {
      console.warn('[DB] MongoDB Atlas connection notice:', err.message);
      console.warn('[DB] Operating in resilient MemoryStore mode.');
      isMongoConnected = false;
      dbMode = 'memory';
      lastDbMessage = `Atlas connection notice: ${err.message}. Using resilient memory store.`;
      return {
        mode: 'memory',
        connected: false,
        message: lastDbMessage,
      };
    }
  }

  if (rawUri && rawUri.trim() !== '') {
    console.log('[DB] MONGODB_URI does not start with mongodb:// or mongodb+srv://. Operating in resilient MemoryStore mode.');
  } else {
    console.log('[DB] No MONGODB_URI provided in environment. Operating in resilient MemoryStore mode.');
  }

  dbMode = 'memory';
  isMongoConnected = false;
  lastDbMessage = 'Operating in MemoryStore mode (set MONGODB_URI in .env to connect MongoDB Atlas).';
  return {
    mode: 'memory',
    connected: false,
    message: lastDbMessage,
  };
}

export function getDatabaseStatus() {
  return {
    mode: dbMode,
    isMongoConnected,
    hasMongoUriEnv: Boolean(process.env.MONGODB_URI),
    message: lastDbMessage,
  };
}

/* ==========================================================
   UNIFIED REPOSITORY INTERFACE
   Allows routes to execute against MongoDB or Memory seamlessly.
   ========================================================== */

export const db = {
  users: {
    async findById(id: string): Promise<IUser | null> {
      if (isMongoConnected) {
        const u = await UserModel.findById(id).lean();
        return u ? ({ ...u, _id: String((u as any)._id) } as any) : null;
      }
      return memoryStore.users.find((u) => u._id === id) || null;
    },
    async findByEmail(email: string): Promise<IUser | null> {
      const lower = email.toLowerCase().trim();
      if (isMongoConnected) {
        const u = await UserModel.findOne({ email: lower }).lean();
        return u ? ({ ...u, _id: String((u as any)._id) } as any) : null;
      }
      return memoryStore.users.find((u) => u.email.toLowerCase() === lower) || null;
    },
    async create(userData: Omit<IUser, '_id' | 'createdAt'>): Promise<IUser> {
      if (isMongoConnected) {
        const doc = await UserModel.create(userData);
        return { ...(doc.toObject() as any), _id: String(doc._id) };
      }
      const newUser: IUser = {
        _id: 'usr_' + Math.random().toString(36).substring(2, 9),
        ...userData,
        createdAt: new Date(),
      };
      memoryStore.users.push(newUser);
      return newUser;
    },
    async getAll(): Promise<IUser[]> {
      if (isMongoConnected) {
        const list = await UserModel.find().lean();
        return list.map((u: any) => ({ ...u, _id: String(u._id) }));
      }
      return memoryStore.users;
    },
  },

  campaigns: {
    async getAll(): Promise<ICampaign[]> {
      if (isMongoConnected) {
        const list = await CampaignModel.find().sort({ createdAt: -1 }).lean();
        return list.map((c: any) => ({ ...c, _id: String(c._id) }));
      }
      return [...memoryStore.campaigns].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    },
    async findById(id: string): Promise<ICampaign | null> {
      if (isMongoConnected) {
        const c = await CampaignModel.findById(id).lean();
        return c ? ({ ...c, _id: String((c as any)._id) } as any) : null;
      }
      return memoryStore.campaigns.find((c) => c._id === id) || null;
    },
    async create(campaignData: Omit<ICampaign, '_id' | 'createdAt' | 'updatedAt' | 'spentBudget' | 'withheldBudget'>): Promise<ICampaign> {
      if (isMongoConnected) {
        const doc = await CampaignModel.create({
          ...campaignData,
          spentBudget: 0,
          withheldBudget: 0,
        });
        return { ...(doc.toObject() as any), _id: String(doc._id) };
      }
      const newCamp: ICampaign = {
        _id: 'camp_' + Math.random().toString(36).substring(2, 9),
        ...campaignData,
        spentBudget: 0,
        withheldBudget: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      memoryStore.campaigns.push(newCamp);
      return newCamp;
    },
    async update(id: string, updates: Partial<ICampaign>): Promise<ICampaign | null> {
      if (isMongoConnected) {
        const doc = await CampaignModel.findByIdAndUpdate(id, { ...updates, updatedAt: new Date() }, { new: true }).lean();
        return doc ? ({ ...doc, _id: String((doc as any)._id) } as any) : null;
      }
      const idx = memoryStore.campaigns.findIndex((c) => c._id === id);
      if (idx === -1) return null;
      memoryStore.campaigns[idx] = {
        ...memoryStore.campaigns[idx],
        ...updates,
        updatedAt: new Date(),
      };
      return memoryStore.campaigns[idx];
    },
  },

  submissions: {
    async getAll(): Promise<ISubmission[]> {
      if (isMongoConnected) {
        const list = await SubmissionModel.find().sort({ createdAt: -1 }).lean();
        return list.map((s: any) => ({ ...s, _id: String(s._id) }));
      }
      return [...memoryStore.submissions].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    },
    async findById(id: string): Promise<ISubmission | null> {
      if (isMongoConnected) {
        const s = await SubmissionModel.findById(id).lean();
        return s ? ({ ...s, _id: String((s as any)._id) } as any) : null;
      }
      return memoryStore.submissions.find((s) => s._id === id) || null;
    },
    async findByCampaignId(campaignId: string): Promise<ISubmission[]> {
      if (isMongoConnected) {
        const list = await SubmissionModel.find({ campaignId }).sort({ createdAt: -1 }).lean();
        return list.map((s: any) => ({ ...s, _id: String(s._id) }));
      }
      return memoryStore.submissions.filter((s) => s.campaignId === campaignId);
    },
    async findByCreatorId(creatorId: string): Promise<ISubmission[]> {
      if (isMongoConnected) {
        const list = await SubmissionModel.find({ creatorId }).sort({ createdAt: -1 }).lean();
        return list.map((s: any) => ({ ...s, _id: String(s._id) }));
      }
      return memoryStore.submissions.filter((s) => s.creatorId === creatorId);
    },
    async create(data: Omit<ISubmission, '_id' | 'createdAt' | 'updatedAt' | 'history' | 'currentViews' | 'previousViews' | 'lastViewUpdatedAt' | 'highestMilestoneThreshold' | 'totalPayoutReceived' | 'withheldPayout' | 'payoutStatus' | 'flaggedForSpike'>): Promise<ISubmission> {
      if (isMongoConnected) {
        const doc = await SubmissionModel.create({
          ...data,
          currentViews: 0,
          previousViews: 0,
          lastViewUpdatedAt: new Date(),
          highestMilestoneThreshold: 0,
          totalPayoutReceived: 0,
          withheldPayout: 0,
          payoutStatus: 'none',
          flaggedForSpike: false,
          history: [],
        });
        return { ...(doc.toObject() as any), _id: String(doc._id) };
      }
      const newSub: ISubmission = {
        _id: 'sub_' + Math.random().toString(36).substring(2, 9),
        ...data,
        currentViews: 0,
        previousViews: 0,
        lastViewUpdatedAt: new Date(),
        highestMilestoneThreshold: 0,
        totalPayoutReceived: 0,
        withheldPayout: 0,
        payoutStatus: 'none',
        flaggedForSpike: false,
        history: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      memoryStore.submissions.push(newSub);
      return newSub;
    },
    async update(id: string, updates: Partial<ISubmission>): Promise<ISubmission | null> {
      if (isMongoConnected) {
        const doc = await SubmissionModel.findByIdAndUpdate(id, { ...updates, updatedAt: new Date() }, { new: true }).lean();
        return doc ? ({ ...doc, _id: String((doc as any)._id) } as any) : null;
      }
      const idx = memoryStore.submissions.findIndex((s) => s._id === id);
      if (idx === -1) return null;
      memoryStore.submissions[idx] = {
        ...memoryStore.submissions[idx],
        ...updates,
        updatedAt: new Date(),
      };
      return memoryStore.submissions[idx];
    },
  },
};
