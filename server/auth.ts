import bcrypt from 'bcryptjs';
import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import session from 'express-session';
import connectPg from 'connect-pg-simple';
import type { Express, RequestHandler } from 'express';
import { storage } from './storage';

// Rolling sessions renew on every request and never expire on their own for an
// active user. This absolute cap forces re-authentication after this much time
// has passed since login, regardless of activity — independent of the cookie's
// rolling maxAge.
const ABSOLUTE_SESSION_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;

export function getSession() {
  const PgSession = connectPg(session);
  return session({
    secret: process.env.SESSION_SECRET!,
    store: new PgSession({
      conString: process.env.DATABASE_URL,
      createTableIfMissing: true,
      tableName: 'sessions',
    }),
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === 'true',
      maxAge: 90 * 24 * 60 * 60 * 1000,
    },
  });
}

export async function setupAuth(app: Express) {
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
      try {
        const user = await storage.getUserByEmail(email);
        if (!user?.passwordHash) {
          return done(null, false, { message: 'Invalid email or password' });
        }
        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
          return done(null, false, { message: 'Invalid email or password' });
        }
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }),
  );

  passport.serializeUser((user: any, done) => done(null, user.id));
  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user ?? false);
    } catch (err) {
      done(err);
    }
  });
}

export const isAuthenticated: RequestHandler = (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const loginTime: number | undefined = (req.session as any).loginTime;
  if (loginTime && Date.now() - loginTime > ABSOLUTE_SESSION_MAX_AGE_MS) {
    return req.session.destroy(() => {
      res.status(401).json({ message: 'Session expired, please log in again' });
    });
  }

  next();
};

export { bcrypt };
