import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signInWithPopup, 
    GoogleAuthProvider, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    setDoc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const isFirebaseConfigured = firebaseConfig && firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_API_KEY";

let app = null;
let auth = null;
let db = null;

if (isFirebaseConfigured) {
    try {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
    } catch (err) {
        console.error("Firebase initialization failed:", err);
    }
}

const tabLogin = document.getElementById('tab-login');
const tabSignup = document.getElementById('tab-signup');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const googleAuthBtn = document.getElementById('btn-google-auth');
const errorEl = document.getElementById('auth-error-msg');

// Redirect if already logged in
if (auth) {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            window.location.href = 'index.html';
        }
    });
}

function switchTab(tab) {
    if (tab === 'login') {
        loginForm.classList.add('active');
        signupForm.classList.remove('active');
        tabLogin.classList.add('active');
        tabSignup.classList.remove('active');
    } else {
        loginForm.classList.remove('active');
        signupForm.classList.add('active');
        tabLogin.classList.remove('active');
        tabSignup.classList.add('active');
    }
    if (isFirebaseConfigured) {
        errorEl.style.display = 'none';
    }
}

tabLogin.addEventListener('click', () => switchTab('login'));
tabSignup.addEventListener('click', () => switchTab('signup'));

function showAuthError(err) {
    console.error("Firebase Auth Error Details:", err);
    const friendlyMessage = getFriendlyAuthError(err.code);
    errorEl.innerHTML = `<strong>Error:</strong> ${friendlyMessage}<br><span style="font-size:11px; opacity:0.85; font-family: monospace; display:block; margin-top:4px;">Code: ${err.code || err.message || err}</span>`;
    errorEl.style.display = 'block';
}

function getFriendlyAuthError(code) {
    switch (code) {
        case 'auth/invalid-email':
            return 'The email address is badly formatted.';
        case 'auth/user-disabled':
            return 'This user account has been disabled.';
        case 'auth/user-not-found':
            return 'No account exists with this email.';
        case 'auth/wrong-password':
            return 'Incorrect password. Please try again.';
        case 'auth/email-already-in-use':
            return 'An account already exists with this email address.';
        case 'auth/weak-password':
            return 'The password is too weak. Choose at least 6 characters.';
        case 'auth/operation-not-allowed':
            return 'Google Sign-In or Email authentication is not enabled in the Firebase Console (Authentication -> Sign-in method).';
        case 'auth/popup-closed-by-user':
            return 'The sign-in popup was closed before completing authentication.';
        case 'auth/popup-blocked':
            return 'The sign-in popup was blocked by your browser. Please allow popups for this site.';
        case 'auth/unauthorized-domain':
            return 'This domain is not authorized in the Firebase Console (Authentication -> Settings -> Authorized Domains).';
        default:
            return 'An error occurred during authentication. Please check your setup.';
    }
}

if (!isFirebaseConfigured) {
    errorEl.innerHTML = `<strong>Firebase config required!</strong><br>Please open <code style="background: rgba(0,0,0,0.1); padding: 2px 4px; border-radius: 4px;">firebase-config.js</code> and replace the placeholders with your actual Firebase API keys.`;
    errorEl.style.display = 'block';
    errorEl.style.backgroundColor = 'var(--warning-light)';
    errorEl.style.color = 'var(--warning)';
    errorEl.style.borderColor = '#fcd34d';

    // Disable forms and buttons
    loginForm.addEventListener('submit', (e) => e.preventDefault());
    signupForm.addEventListener('submit', (e) => e.preventDefault());
    googleAuthBtn.addEventListener('click', (e) => e.preventDefault());
} else {
    // Attach form actions
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;
        const submitBtn = document.getElementById('btn-login-submit');

        submitBtn.querySelector('.btn-text').style.display = 'none';
        submitBtn.querySelector('.spinner').style.display = 'inline-block';
        errorEl.style.display = 'none';

        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (err) {
            showAuthError(err);
            submitBtn.querySelector('.btn-text').style.display = 'inline';
            submitBtn.querySelector('.spinner').style.display = 'none';
        }
    });

    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('signup-name').value.trim();
        const email = document.getElementById('signup-email').value.trim();
        const password = document.getElementById('signup-password').value;
        const submitBtn = document.getElementById('btn-signup-submit');

        submitBtn.querySelector('.btn-text').style.display = 'none';
        submitBtn.querySelector('.spinner').style.display = 'inline-block';
        errorEl.style.display = 'none';

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Pre-seed Firestore doc with clean slate for new users
            const userDocRef = doc(db, "users", user.uid);
            await setDoc(userDocRef, {
                profile: {
                    name: name,
                    niche: "Tech & Lifestyle",
                    bio: "Helping creators and coders simplify business setups with minimal aesthetics and tools.",
                    youtubeSubs: 0,
                    instagramFollowers: 0,
                    avgViews: 0,
                    engagementRate: 0.0,
                    rateDedicated: 0,
                    rateIntegrated: 0
                },
                invoices: [],
                campaigns: [],
                dmConfig: {
                    varA: "Hey {name}! Thanks for joining. What type of content interests you the most?",
                    varB: "Welcome aboard, {name}! Glad to connect. Let me know if you need help with creator resources.",
                    varC: "Hello {name}! Thanks for the follow. I post weekly tutorials. Let me know your feedback!",
                    delay: "15"
                }
            });
        } catch (err) {
            showAuthError(err);
            submitBtn.querySelector('.btn-text').style.display = 'inline';
            submitBtn.querySelector('.spinner').style.display = 'none';
        }
    });

    googleAuthBtn.addEventListener('click', async () => {
        const provider = new GoogleAuthProvider();
        errorEl.style.display = 'none';

        try {
            await signInWithPopup(auth, provider);
        } catch (err) {
            showAuthError(err);
        }
    });
}
