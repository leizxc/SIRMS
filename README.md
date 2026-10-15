# SafeSite

## Local XAMPP setup

1. Start Apache and MySQL.
2. Import `backend/config/schema.sql` for a new database. If the older `users` table is already present, run `backend/config/migrations/20261010_add_user_names.sql` once.
3. Open `http://localhost/SIRMS/frontend/pages/login.html` to sign in, or register at `register.html`.

Login routes users according to the `users.role` value:

- `ADMIN` → `frontend/pages/admin.html`
- `USERS` → `frontend/pages/user.html` (new registrations receive this role)
- `OFFICER` → `frontend/pages/officer.html`

Set an account's role in phpMyAdmin by username, for example:

```sql
UPDATE users SET role = 'ADMIN' WHERE username = 'your-username';
UPDATE users SET role = 'OFFICER' WHERE username = 'your-username';
UPDATE users SET role = 'USERS' WHERE username = 'your-username';
```

The default database connection is `sirms` with MySQL user `root` and an empty password. Override it with `SIRMS_DB_HOST`, `SIRMS_DB_NAME`, `SIRMS_DB_USER`, and `SIRMS_DB_PASSWORD` when needed.
