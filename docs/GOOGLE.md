# Google sign-in for OperatorOS

People who use OperatorOS only click Continue with Google or Add Gmail. They never open Google Cloud.

You, the platform owner, enable Google once.

## One-time platform setup

1. Google Cloud → OAuth client, Web application.
2. Authorized JavaScript origins:
   - https://operator-os-rdk1.vercel.app
   - https://crughgiwfhhbnpbzaifm.supabase.co
3. Authorized redirect URIs:
   - https://crughgiwfhhbnpbzaifm.supabase.co/auth/v1/callback
   - https://operator-os-rdk1.vercel.app/auth/callback
   - https://operator-os-rdk1.vercel.app/api/google/callback
4. Supabase dashboard → Authentication → Providers → Google → on.
   Paste the same Client ID and Client secret.
5. Add the Client ID and secret to Vercel env if you also use `/api/google/start`.

After that, every workspace user just signs in with Gmail.
