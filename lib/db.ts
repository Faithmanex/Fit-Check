
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { User, SavedOutfit, GenerationEntry } from '../types';

const DB_NAME = 'FitCheckDB';
const DB_VERSION = 3; // Incremented for Generations store
const STORE_USERS = 'users';
const STORE_SESSION = 'session';
const STORE_GENERATIONS = 'generations';

// Singleton DB connection promise to prevent opening/closing heavily
let dbPromise: Promise<IDBDatabase> | null = null;

const openDB = (): Promise<IDBDatabase> => {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            dbPromise = null; // Reset on failure
            reject(request.error);
        };
        
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            
            if (!db.objectStoreNames.contains(STORE_USERS)) {
                db.createObjectStore(STORE_USERS, { keyPath: 'id' });
            }
            
            if (db.objectStoreNames.contains(STORE_SESSION)) {
                db.deleteObjectStore(STORE_SESSION);
            }
            db.createObjectStore(STORE_SESSION);

            // New store for AI result caching
            if (!db.objectStoreNames.contains(STORE_GENERATIONS)) {
                db.createObjectStore(STORE_GENERATIONS, { keyPath: 'key' });
            }
        };
    });

    return dbPromise;
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const db = {
  getUsers: async (): Promise<User[]> => {
    const dbInstance = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = dbInstance.transaction(STORE_USERS, 'readonly');
        const store = transaction.objectStore(STORE_USERS);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result as User[]);
        request.onerror = () => reject(request.error);
    });
  },

  saveUser: async (user: User): Promise<void> => {
    const dbInstance = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = dbInstance.transaction([STORE_USERS, STORE_SESSION], 'readwrite');
        
        const usersStore = transaction.objectStore(STORE_USERS);
        usersStore.put(user);

        const sessionStore = transaction.objectStore(STORE_SESSION);
        const sessionReq = sessionStore.get('current_user');
        
        sessionReq.onsuccess = () => {
             const currentUser = sessionReq.result;
             if (currentUser && currentUser.id === user.id) {
                 sessionStore.put(user, 'current_user');
             }
        };

        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
  },

  findUserByEmail: async (email: string): Promise<User | undefined> => {
    const users = await db.getUsers();
    return users.find(u => u.email === email);
  },

  getCurrentUser: async (): Promise<User | null> => {
    const dbInstance = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = dbInstance.transaction(STORE_SESSION, 'readonly');
        const store = transaction.objectStore(STORE_SESSION);
        const request = store.get('current_user');
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
    });
  },

  login: async (email: string): Promise<User> => {
    await delay(500);
    const user = await db.findUserByEmail(email);
    if (!user) throw new Error('User not found');
    
    const dbInstance = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = dbInstance.transaction(STORE_SESSION, 'readwrite');
        const store = transaction.objectStore(STORE_SESSION);
        store.put(user, 'current_user');
        transaction.oncomplete = () => resolve(user);
        transaction.onerror = () => reject(transaction.error);
    });
  },

  signup: async (email: string, name: string): Promise<User> => {
    await delay(500);
    const existing = await db.findUserByEmail(email);
    if (existing) throw new Error('Email already exists');
    
    const newUser: User = {
      id: Math.random().toString(36).substr(2, 9),
      email,
      name,
      plan: 'free',
      subscriptionStatus: 'inactive',
      generationsUsed: 0,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`,
      savedOutfits: [],
      modelImage: null
    };
    
    await db.saveUser(newUser);
    
    const dbInstance = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = dbInstance.transaction(STORE_SESSION, 'readwrite');
        const store = transaction.objectStore(STORE_SESSION);
        store.put(newUser, 'current_user');
        transaction.oncomplete = () => resolve(newUser);
        transaction.onerror = () => reject(transaction.error);
    });
  },

  logout: async (): Promise<void> => {
    const dbInstance = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = dbInstance.transaction(STORE_SESSION, 'readwrite');
        const store = transaction.objectStore(STORE_SESSION);
        store.delete('current_user');
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
  },

  upgradeSubscription: async (userId: string): Promise<User> => {
    await delay(1000);
    const dbInstance = await openDB();
    return new Promise((resolve, reject) => {
         const transaction = dbInstance.transaction([STORE_USERS, STORE_SESSION], 'readwrite');
         const userStore = transaction.objectStore(STORE_USERS);
         
         const req = userStore.get(userId);
         req.onsuccess = () => {
             const user = req.result as User;
             if (!user) {
                 reject(new Error('User not found'));
                 return;
             }
             user.plan = 'pro';
             user.subscriptionStatus = 'active';
             userStore.put(user);
             
             const sessionStore = transaction.objectStore(STORE_SESSION);
             sessionStore.put(user, 'current_user');
             resolve(user);
         };
         req.onerror = () => reject(req.error);
    });
  },

  saveOutfit: async (userId: string, outfit: SavedOutfit): Promise<User> => {
    const dbInstance = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = dbInstance.transaction([STORE_USERS, STORE_SESSION], 'readwrite');
        const userStore = transaction.objectStore(STORE_USERS);
        
        const req = userStore.get(userId);
        req.onsuccess = () => {
            const user = req.result as User;
            if (!user) {
                reject(new Error('User not found'));
                return;
            }
            if (!user.savedOutfits) user.savedOutfits = [];
            user.savedOutfits.unshift(outfit);
            userStore.put(user);
            
            const sessionStore = transaction.objectStore(STORE_SESSION);
            sessionStore.put(user, 'current_user');
            resolve(user);
        };
        req.onerror = () => reject(req.error);
    });
  },

  deleteOutfit: async (userId: string, outfitId: string): Promise<User> => {
    const dbInstance = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = dbInstance.transaction([STORE_USERS, STORE_SESSION], 'readwrite');
        const userStore = transaction.objectStore(STORE_USERS);
        
        const req = userStore.get(userId);
        req.onsuccess = () => {
            const user = req.result as User;
            if (!user) {
                reject(new Error('User not found'));
                return;
            }
            if (user.savedOutfits) {
                user.savedOutfits = user.savedOutfits.filter(o => o.id !== outfitId);
                userStore.put(user);
                
                const sessionStore = transaction.objectStore(STORE_SESSION);
                sessionStore.put(user, 'current_user');
            }
            resolve(user);
        };
        req.onerror = () => reject(req.error);
    });
  },

  updateUser: async (userId: string, updates: Partial<User>): Promise<User> => {
    const dbInstance = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = dbInstance.transaction([STORE_USERS, STORE_SESSION], 'readwrite');
        const userStore = transaction.objectStore(STORE_USERS);
        
        const req = userStore.get(userId);
        req.onsuccess = () => {
            const user = req.result as User;
            if (!user) {
                reject(new Error('User not found'));
                return;
            }
            const updatedUser = { ...user, ...updates };
            userStore.put(updatedUser);
            
            const sessionStore = transaction.objectStore(STORE_SESSION);
            sessionStore.put(updatedUser, 'current_user');
            resolve(updatedUser);
        };
        req.onerror = () => reject(req.error);
    });
  },

  // --- Caching Methods ---

  getGeneration: async (key: string): Promise<string | null> => {
      const dbInstance = await openDB();
      return new Promise((resolve) => {
          const transaction = dbInstance.transaction(STORE_GENERATIONS, 'readonly');
          const store = transaction.objectStore(STORE_GENERATIONS);
          const req = store.get(key);
          req.onsuccess = () => {
              const result = req.result as GenerationEntry;
              resolve(result ? result.data : null);
          };
          req.onerror = () => resolve(null); // Fail gracefully
      });
  },

  saveGeneration: async (key: string, data: string): Promise<void> => {
      const dbInstance = await openDB();
      return new Promise((resolve) => {
          const transaction = dbInstance.transaction(STORE_GENERATIONS, 'readwrite');
          const store = transaction.objectStore(STORE_GENERATIONS);
          store.put({ key, data, timestamp: Date.now() });
          transaction.oncomplete = () => resolve();
          transaction.onerror = () => resolve(); // Fail gracefully
      });
  }
};
