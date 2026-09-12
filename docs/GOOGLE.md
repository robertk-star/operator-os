# Google OAuth for OperatorOS

Browser-only setup. Do this in Google Cloud and Vercel.

## Scopes (safe mode)

- gmail.readonly
- gmail.compose
- calendar.readonly
- calendar.events

Do not add gmail.send. OperatorOS prepares drafts. It does not send.

## Google Cloud

1. Create or select a project at https://console.cloud.google.com
2. Enable Gmail API and Google Calendar API
3. APIs and Services → OAuth consent screen → External (or Internal if Workspace)
4. App name: OperatorOS
5. Create OAuth client → Web application
6. Authorized redirect URI:
   `https://operator-os-rdk1.vercel.app/api/google/callback`
7. Copy Client ID and Client secret

## Vercel env

Project Settings → Environment Variables:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`=`https://operator-os-rdk1.vercel.app/api/google/callback`

Redeploy after saving.

## In the app

Gmail → Connect Gmail. That hits `/api/google/start`, then Google, then `/api/google/callback`, which stores tokens on the workspace integration row.
