import 'express-session';
declare module 'express-session' {
  interface SessionData {
    userId?: string;
    googleState?: string;
    slackState?: string;
  }
}
