import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

export interface DemoUser {
  uid: string;
  email: string;
  displayName: string;
  isDemo: boolean;
}

interface AuthContextType {
  user: User | DemoUser | null;
  profile: any | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signInDemo: () => void;
  logout: () => Promise<void>;
  authError: string | null;
  setAuthError: (err: string | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | DemoUser | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    // Robust check for URL parameters (supporting both direct and hash paths)
    const getParam = (name: string): string | null => {
      if (typeof window === 'undefined') return null;
      const params = new URLSearchParams(window.location.search);
      let val = params.get(name);
      if (!val && window.location.hash) {
        const idx = window.location.hash.indexOf('?');
        if (idx !== -1) {
          const hashParams = new URLSearchParams(window.location.hash.slice(idx));
          val = hashParams.get(name);
        }
      }
      return val;
    };

    const isDemoParam = getParam('demo') === 'true' || getParam('sandbox') === 'true';

    // Check if demo session exists first or auto-triggered via link
    const demoUserStr = localStorage.getItem('demo_user');
    if (demoUserStr || isDemoParam) {
      try {
        const demoUser = demoUserStr ? JSON.parse(demoUserStr) : {
          uid: 'demo_user_katia',
          email: 'katia-demo@traverdy.app',
          displayName: 'Katia (Démo Sandbox)',
          isDemo: true
        };
        if (isDemoParam) {
          localStorage.setItem('demo_user', JSON.stringify(demoUser));
        }
        setUser(demoUser);
        setProfile({
          email: demoUser.email,
          role: 'operator',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        setLoading(false);
        return;
      } catch (e) {
        localStorage.removeItem('demo_user');
      }
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      if (firebaseUser) {
        // Clear any demo user when live auth starts
        localStorage.removeItem('demo_user');
        
        try {
          const userRef = doc(db, 'users', firebaseUser.uid);
          let userSnap = await getDoc(userRef);
          
          if (!userSnap.exists()) {
            const newProfile = {
              email: firebaseUser.email,
              role: 'operator',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            };
            await setDoc(userRef, newProfile);
            // Re-fetch to get server timestamps if possible, or just set locally
            userSnap = await getDoc(userRef);
          }
          setProfile(userSnap.data());
          setUser(firebaseUser);
        } catch (err: any) {
          console.error("Firestore error loading profile:", err);
          // Set user anyway to avoid locking them out if they have auth
          setUser(firebaseUser);
        }
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signIn = async () => {
    setAuthError(null);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.error("Firebase auth failed:", err);
      if (err.code === 'auth/popup-blocked') {
        setAuthError("Le popup de connexion a été bloqué par votre navigateur ou par l'iframe d'AI Studio. Veuillez cliquer sur l'icône de partage/nouvel onglet en haut à droite pour tester l'application en dehors de l'iframe, ou utilisez le bouton 'Connexion Sandbox / Démo' ci-dessous.");
      } else if (err.code === 'auth/unauthorized-domain') {
        setAuthError("Ce compilateur d'adresse (domaine Run.app / Netlify.app) n'est pas autorisé dans les paramètres d'authentification de votre console Firebase (Authentication > Paramètres > Domaines autorisés). Pour tester immédiatement sans configurer, utilisez la 'Connexion Sandbox / Démo'.");
      } else {
        setAuthError(`Erreur : ${err.message || err}. Utilisez le bouton 'Connexion Sandbox / Démo' ci-dessous pour tester immédiatement.`);
      }
    }
  };

  const signInDemo = () => {
    setAuthError(null);
    const demoUserStr = {
      uid: 'demo_user_katia',
      email: 'katia-demo@traverdy.app',
      displayName: 'Katia (Démo Sandbox)',
      isDemo: true
    };
    localStorage.setItem('demo_user', JSON.stringify(demoUserStr));
    setUser(demoUserStr);
    setProfile({
      email: demoUserStr.email,
      role: 'operator',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  };

  const logout = async () => {
    localStorage.removeItem('demo_user');
    setUser(null);
    setProfile(null);
    try {
      await signOut(auth);
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f4f6f9] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#1db954] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signInDemo, logout, authError, setAuthError }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
