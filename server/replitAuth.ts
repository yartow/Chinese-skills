// Replit Auth integration - blueprint:javascript_log_in_with_replit
import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const secret = process.env.SESSION_SECRET ?? "dev-secret-change-me";

  // Without Replit Auth (local dev), use the default in-memory store and
  // allow non-HTTPS cookies so the app works on plain http://localhost.
  if (!process.env.REPL_ID) {
    return session({
      secret,
      resave: false,
      saveUninitialized: false,
      cookie: { httpOnly: true, secure: false, maxAge: sessionTtl },
    });
  }

  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,
      maxAge: sessionTtl,
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(
  claims: any,
) {
  await storage.upsertUser({
    id: claims["sub"],
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  if (!process.env.REPL_ID) {
    // Replit Auth is not configured — login/callback/logout routes are no-ops.
    // All isAuthenticated-guarded endpoints will return 401.
    app.get("/api/login", (_req, res) => res.status(501).json({ message: "Auth not configured" }));
    app.get("/api/callback", (_req, res) => res.redirect("/"));
    app.get("/api/logout", (_req, res) => res.redirect("/"));
    return;
  }

  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const user = {};
    updateUserSession(user, tokens);
    await upsertUser(tokens.claims());
    verified(null, user);
  };

  const registeredStrategies = new Set<string>();

  const ensureStrategy = (domain: string) => {
    const strategyName = `replitauth:${domain}`;
    if (!registeredStrategies.has(strategyName)) {
      const strategy = new Strategy(
        {
          name: strategyName,
          config,
          scope: "openid email profile offline_access",
          callbackURL: `https://${domain}/api/callback`,
        },
        verify,
      );
      passport.use(strategy);
      registeredStrategies.add(strategyName);
    }
  };

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", (req, res, next) => {
    ensureStrategy(req.hostname);
    passport.authenticate(`replitauth:${req.hostname}`, {
      scope: ["openid", "email", "profile", "offline_access"],
      prompt: "login",
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    ensureStrategy(req.hostname);
    passport.authenticate(`replitauth:${req.hostname}`, {
      successReturnToOrRedirect: "/",
      failureRedirect: "/api/login",
    })(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
    const endSessionUrl = client.buildEndSessionUrl(config, {
      client_id: process.env.REPL_ID!,
      post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
    }).href;
    req.logout(() => {
      req.session.destroy(() => {
        res.clearCookie("connect.sid");
        res.redirect(endSessionUrl);
      });
    });
  });
}

const DEV_USER_ID = "local-dev-user";

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  // When Replit Auth is not configured (local dev), auto-authenticate as a
  // local dev user so the app is fully usable without credentials.
  if (!process.env.REPL_ID) {
    if (!req.user) {
      await storage.upsertUser({
        id: DEV_USER_ID,
        email: "dev@localhost",
        firstName: "Dev",
        lastName: "User",
        profileImageUrl: null,
      });
      (req as any).user = { id: DEV_USER_ID, claims: { sub: DEV_USER_ID } };
    }
    return next();
  }

  const user = req.user as any;

  if (!req.isAuthenticated() || !user.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    // Explicitly save the session so the refreshed tokens are persisted to the
    // PostgreSQL store. Without this, resave:false means the store entry keeps
    // the old expired token and the refresh cycle breaks on the next request.
    await new Promise<void>((resolve, reject) =>
      req.session.save((err) => (err ? reject(err) : resolve()))
    );
    return next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};
