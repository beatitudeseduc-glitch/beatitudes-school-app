# Beatitudes International School secure portal

This portal uses Netlify Identity, Netlify Functions and Netlify Database to provide authenticated management and teacher access. Authorization is enforced in the API as well as reflected in the interface.

Management users need the `management` Identity role. Teachers need the `teacher` Identity role and an explicit class assignment. The first management role is assigned through the Netlify Identity user settings; subsequent staff accounts can be created inside the portal.

The historical `supabase_schema.sql` remains as a hardened migration reference for existing Supabase installations. The deployed portal stores structured records in managed Netlify Postgres through Drizzle migrations. Database migrations are applied automatically by Netlify during deployment.

Never expose operator tokens or database credentials to the browser.

## First accounts

No default email address or password is included in this repository. Before production use:

1. In the Netlify project, open **Identity > Settings and usage > Registration preferences** and select **Invite only**. This prevents public self-registration.
2. Open **Identity > Users**, invite the first authorised administrator, and have that person accept the emailed invitation and choose their own password. Do not send a password in source code, tickets, or chat.
3. Edit that Identity user and assign the role `management` (lowercase). The role must be stored in protected Identity application metadata/roles, not editable user metadata.
4. Sign in to the portal with that account. The protected API validates the signed Identity token and creates the matching active management profile in Netlify Database on first access.
5. Open **Staff & Teachers > Add staff account**. Enter the teacher's email, select **Teacher**, select only their assigned classes, and supply a unique temporary password of at least eight characters through a secure channel. The server creates the Identity user with the protected `teacher` role and writes the matching database profile and class assignments. Ask the teacher to replace the temporary password immediately.

For pre-merge testing, use dedicated addresses controlled by the school and generate unique passwords in a password manager. Test one `management` account and one `teacher` account; never reuse production credentials. Remove or deactivate test users after verification.

## Authorization boundary

Netlify Identity is the selected authentication authority for this deployment; Supabase is not used by the running portal. Identity roles are read only from signed, server-managed token claims. Netlify Database is never queried directly by the browser. Every request passes through the protected portal function, which independently enforces management-only operations and checks a teacher's persisted class assignments before returning pupil data or accepting attendance and academic-result changes.

Changing navigation or request payloads cannot grant additional access. Accounts without an exact `management` or `teacher` role receive HTTP 403, inactive profiles receive HTTP 403, and teachers receive HTTP 403 when attempting to write records for pupils outside their assigned classes.
