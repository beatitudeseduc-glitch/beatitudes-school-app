BEATITUDES INTERNATIONAL SCHOOL — STAGE 4
SECURE WEB APP BUILD

This package replaces the local-storage login prototype with a production architecture based on:
- Supabase Auth
- PostgreSQL
- Row Level Security (RLS)
- Management / Teacher / Parent roles

Included:
1. index.html — secure portal UI and live enrolment statistics connection
2. supabase_schema.sql — database tables, roles and RLS policies
3. .env.example — configuration template
4. This README

IMPORTANT:
The HTML login is intentionally a UI shell until Supabase project credentials are configured.
Do not enter real pupil information into this build until Supabase Auth + RLS have been configured and tested.

DEPLOYMENT:
1. Create a Supabase project.
2. Open SQL Editor.
3. Run supabase_schema.sql.
4. Enable Email/Password authentication.
5. Create management, teacher and parent accounts.
6. Add corresponding rows to public.profiles with the Auth UUID and correct role.
7. Connect the frontend to Supabase using the project's URL and publishable/anon key.
8. Never expose the service-role key in frontend code.
9. Test each role: management must not be limited to own pupil; parent must see only linked child; teacher must not see fee/payment administration unless explicitly granted.
