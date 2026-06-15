# Deployment Guide - CreatorFlow

Since CreatorFlow uses a serverless Firebase backend, there is no need to deploy any backend server code to Render. You only need to deploy the frontend files on **Vercel**.

Here is the complete, step-by-step guide to deploying your site.

---

## Step 1: Push Your Code to GitHub

1. Open your terminal in the root `CC` folder.
2. Initialize git (if not already done):
   ```bash
   git init
   ```
3. Add all files to stage:
   ```bash
   git add .
   ```
4. Commit your changes:
   ```bash
   git commit -m "feat: integrate firebase backend and separate folder structures"
   ```
5. Create a new repository on [GitHub](https://github.com/) named `CreatorFlow`.
6. Run the commands provided by GitHub to link and push your local code:
   ```bash
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/CreatorFlow.git
   git push -u origin main
   ```

---

## Step 2: Deploy to Vercel

1. Log in to [Vercel](https://vercel.com/) (sign in using your GitHub account for easy integration).
2. On your Vercel Dashboard, click **Add New...** and select **Project**.
3. Under *Import Git Repository*, find your `CreatorFlow` repository and click **Import**.
4. In the **Configure Project** settings:
   * **Framework Preset**: Keep it as **Other**.
   * **Root Directory**: Click the **Edit** button next to it. Select the **`frontend`** directory and click **Continue**. *(This is critical so Vercel serves the files inside `frontend/` instead of your root folder).*
5. Click the **Deploy** button.
6. Once Vercel finishes building (usually takes under 30 seconds), click on the preview image to visit your live site. Copy the live URL (e.g. `https://creatorflow-xxx.vercel.app`).

---

## Step 3: Authorize Your Live URL in Firebase

Because Google Sign-in and Firebase security restrict authentication popups to authorized domains, you must authorize your new Vercel URL:

1. Open the [Firebase Console](https://console.firebase.google.com/).
2. Select your project **`CreatorFlow`** (`creatorflow-aba5e`).
3. Click on **Authentication** in the left sidebar.
4. Select the **Settings** tab on the top menu bar.
5. In the left panel of settings, click on **Authorized Domains**.
6. Click **Add domain** on the right side.
7. Paste your Vercel URL (e.g., `creatorflow-xxx.vercel.app` — **without** the `https://` prefix or any trailing slashes) and click **Add**.

---

## Step 4: Ensure Production Database Access

Ensure your database is accessible to your deployed website:

1. Go to **Firestore Database** in your Firebase console.
2. Check the **Rules** tab.
3. If you started in **Test Mode**, your rules should allow reading and writing. For initial testing, this is fine:
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if true;
       }
     }
   }
   ```
4. *Optional (Highly Recommended for Security)*: To secure user data in production so that logged-in users can only read and write their own data, change your rules to the following and click **Publish**:
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{userId} {
         allow read, write: if request.auth != null && request.auth.uid == userId;
       }
     }
   }
   ```
   *(This ensures that only the authenticated user can read or update their own dashboard state).*
