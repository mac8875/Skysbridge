# Sky's Bridge Version 19 — Microsoft 365 Graph setup

Use the exact licensed mailbox you own. The examples below use `together@skybridge.org` because that is the address supplied for Version 19. If the real address is `together@skysbridge.org`, enter that spelling instead everywhere.

## 1. Register the application in Microsoft Entra

1. Sign in to the Microsoft Entra admin center with the Microsoft 365 administrator account.
2. Open **Identity → Applications → App registrations → New registration**.
3. Name it `Skysbridge Netlify Mailer`.
4. Select **Accounts in this organizational directory only**.
5. A redirect URI is not required for this server-to-server application.
6. Create the registration.

Record:
- **Directory (tenant) ID** → `M365_TENANT_ID`
- **Application (client) ID** → `M365_CLIENT_ID`

## 2. Create a client secret

1. In the app registration, open **Certificates & secrets**.
2. Select **New client secret**.
3. Copy the secret **Value immediately**. Microsoft shows it only once.
4. Store the value as `M365_CLIENT_SECRET` in Netlify.

## 3. Grant Microsoft Graph mail permission

1. Open **API permissions → Add a permission**.
2. Choose **Microsoft Graph → Application permissions**.
3. Add **Mail.Send**.
4. Select **Grant admin consent** for your Microsoft 365 organization.

Application permission is required because the Netlify function sends mail without an interactive user sign-in.

## 4. Add Netlify environment variables

In Netlify open your Sky's Bridge site, then **Site configuration → Environment variables** and add:

```
M365_TENANT_ID=<Directory tenant ID>
M365_CLIENT_ID=<Application client ID>
M365_CLIENT_SECRET=<client secret VALUE, not its ID>
M365_SENDER_EMAIL=together@skybridge.org
ROOM_MESSAGE_FORWARD_TO=together@skybridge.org
SUPABASE_URL=<your Supabase project URL>
SUPABASE_SERVICE_ROLE_KEY=<your Supabase service-role key>
```

`M365_SENDER_EMAIL` must be an Exchange Online mailbox that exists and is licensed. `ROOM_MESSAGE_FORWARD_TO` may be the same mailbox or another authorized destination.

Do not put the tenant ID, client secret, or service-role key in `config.js`, GitHub, or browser code.

## 5. Redeploy

Environment-variable changes apply to a new deploy. In Netlify open **Deploys → Trigger deploy → Deploy site**, or push Version 19 to GitHub and wait for the automatic deploy.

## 6. Test

1. Sign in to Sky's Bridge.
2. Open a protected room with email forwarding enabled.
3. Post a short test message.
4. Confirm the message appears in the room.
5. Check the Microsoft 365 Inbox and Sent Items of the configured mailbox.

If posting succeeds but email fails, the room message is retained and the website reports that the email copy could not be sent.

## Privacy note

Private-room members must be clearly informed before their messages are copied outside the room. Only enable forwarding in rooms whose notice and consent process accurately describe who receives the messages and why.
