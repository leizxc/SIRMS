# SIRMS

## local host link of xampp
 
Visit `http://localhost/SIRMS/frontend/pages/index.html` and choose **Portal Login**. The login form sends credentials to `backend/public/auth/login.php`; successful authentication creates a PHP session.

SINCE WE DONT HAVE YET REGISTER THIS IS THE QUERY TO INSERT ACC

   ```sql
   INSERT INTO users (username, email, password_hash)
   VALUES ('your-username', 'you@example.com', 'PASTE_THE_GENERATED_HASH');
   ```

THIS IS HOW TO ALTER role
```sql
UPDATE users SET role = 'admin' WHERE username = 'leizxc'
```


## REMEMBER!
This project does not yet include a dashboard, registration flow, or password reset endpoint. The login form reports successful authentication and keeps the session active; those destinations can be connected when their pages are added.
