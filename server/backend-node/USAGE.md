code .env
```

You'll see:
```
PORT=8081
MONGO_URI=mongodb://localhost:27017/eventzen_node
JWT_SECRET=eventzen-super-secret-key-2025
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your.email@gmail.com
SMTP_PASS=xxxx-xxxx-xxxx-xxxx
CLIENT_URL=http://localhost:3000
INTERNAL_SERVICE_SECRET=internal-secret-2025
```

Here's what each one means and what you put in it:

---

### `PORT=8081`
Leave it. This is the port Node.js runs on. Don't change it.

---

### `MONGO_URI`

**If you're using MongoDB Atlas (cloud — recommended):**

1. Go to [mongodb.com/cloud/atlas](https://mongodb.com/cloud/atlas) → sign in
2. Click your cluster → Connect → Connect your application
3. Copy the connection string. It looks like:
```
   mongodb+srv://yourname:yourpassword@cluster0.xxxxx.mongodb.net/
```
4. Add the database name at the end:
```
   MONGO_URI=mongodb+srv://yourname:yourpassword@cluster0.xxxxx.mongodb.net/eventzen_node
```

**If you're using local MongoDB:**
```
MONGO_URI=mongodb://localhost:27017/eventzen_node
```
Make sure MongoDB is running locally first (`mongod` command or MongoDB Compass).

The database `eventzen_node` doesn't need to exist yet — MongoDB creates it automatically on first write.

---

### `JWT_SECRET`

This is the most critical variable. **All three backend services must have the exact same value here.** It's how Spring Boot and ASP.NET can verify tokens created by Node.js.

Change it to something long and random. Never use the example value in production, but for development this is fine:
```
JWT_SECRET=eventzen-super-secret-key-2025
```

When you set up Spring Boot later, you'll add the same value as an environment variable there. When you set up ASP.NET, same thing. If they don't match exactly, authentication breaks across services.

---

### `SMTP_USER` and `SMTP_PASS` — Gmail setup

This is for sending OTP emails. You need a Gmail account and an **App Password** (not your regular Gmail password).

**Step by step:**

1. Go to your Google Account: [myaccount.google.com](https://myaccount.google.com)
2. Click **Security** in the left sidebar
3. Scroll to **"How you sign in to Google"** — make sure **2-Step Verification** is ON (you need this enabled first)
4. Search for **"App Passwords"** in the search bar at the top of the page, or go to: [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
5. Under "Select app" choose **Mail**. Under "Select device" choose **Other** and type `EventZen`
6. Click **Generate**
7. Google shows you a **16-character password** like `abcd efgh ijkl mnop` — copy it **without the spaces**

Now in your `.env`:
```
SMTP_USER=youractualemail@gmail.com
SMTP_PASS=abcdefghijklmnop
```

If you skip this step, the server will still start and register will still work — it just won't send the OTP email. You'll see a warning in the console: `⚠️ Failed to send OTP email`.

---

### `CLIENT_URL`
```
CLIENT_URL=http://localhost:3000
```
Leave it for now. This is used in the password reset email link so it points to your React app. Change it to your real domain when you deploy.

---

### `INTERNAL_SERVICE_SECRET`
```
INTERNAL_SERVICE_SECRET=internal-secret-2025

