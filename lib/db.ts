
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { User, SavedOutfit, GenerationEntry, LookEntry, LookPage, WardrobeItem } from '../types';

const DB_NAME = 'FitCheckDB';
const DB_VERSION = 4; // Incremented for Looks history + persisted wardrobes
const STORE_USERS = 'users';
const STORE_SESSION = 'session';
const STORE_GENERATIONS = 'generations';
const STORE_LOOKS = 'looks';
const STORE_WARDROBES = 'wardrobes';

/** Maximum number of looks retained per user (oldest trimmed first). */
export const MAX_LOOKS_PER_USER = 60;
/** Maximum number of custom wardrobe items persisted per user. */
export const MAX_WARDROBE_ITEMS = 60;

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

            // New store for the "My Looks" generation history
            if (!db.objectStoreNames.contains(STORE_LOOKS)) {
                const looks = db.createObjectStore(STORE_LOOKS, { keyPath: 'id' });
                looks.createIndex('by_user', 'userId', { unique: false });
            }

            // New store for persisted per-user wardrobes (custom uploads)
            if (!db.objectStoreNames.contains(STORE_WARDROBES)) {
                db.createObjectStore(STORE_WARDROBES);
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
  },

  // --- My Looks history ---

  /** Records a look and trims the per-user history to MAX_LOOKS_PER_USER. */
  saveLook: async (userId: string, look: Omit<LookEntry, 'id' | 'userId'> & { id?: string }): Promise<LookEntry | null> => {
      const dbInstance = await openDB();
      return new Promise((resolve) => {
          const entry: LookEntry = {
              id: look.id ?? `look_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
              userId,
              imageUrl: look.imageUrl,
              timestamp: look.timestamp ?? Date.now(),
              dateLabel: look.dateLabel,
              garmentNames: look.garmentNames?.length ? look.garmentNames : ['Base Model'],
              poseLabel: look.poseLabel,
              source: look.source ?? 'auto',
              favorite: look.favorite ?? false,
          };
          const transaction = dbInstance.transaction(STORE_LOOKS, 'readwrite');
          const store = transaction.objectStore(STORE_LOOKS);
          store.put(entry);

          // Trim oldest beyond the cap (single-user scope keeps this simple).
          // Favorited looks are trimmed last so a full history never evicts them first.
          const index = store.index('by_user');
          const cursorReq = index.openCursor(IDBKeyRange.only(userId));
          const all: LookEntry[] = [];
          cursorReq.onsuccess = () => {
              const cursor = cursorReq.result;
              if (cursor) {
                  all.push(cursor.value as LookEntry);
                  cursor.continue();
              }
          };
          transaction.oncomplete = () => {
              all.sort((a, b) => b.timestamp - a.timestamp);
              if (all.length > MAX_LOOKS_PER_USER) {
                  const overflow = all.slice(MAX_LOOKS_PER_USER);
                  const stale = [
                      ...overflow.filter((l) => !l.favorite),
                      ...overflow.filter((l) => l.favorite),
                  ].slice(0, all.length - MAX_LOOKS_PER_USER);
                  const tx = dbInstance.transaction(STORE_LOOKS, 'readwrite');
                  const trimStore = tx.objectStore(STORE_LOOKS);
                  for (const item of stale) {
                      trimStore.delete(item.id);
                  }
                  tx.oncomplete = () => resolve(entry);
                  tx.onerror = () => resolve(entry); // Trim failure is non-fatal
              } else {
                  resolve(entry);
              }
          };
          transaction.onerror = () => resolve(null); // Fail gracefully
      });
  },

  /** Offset-paginated look history for a user, newest first. */
  getLooksPage: async (userId: string, page = 1, pageSize = 12, favoritesOnly = false): Promise<LookPage> => {
      const empty: LookPage = { items: [], total: 0, page: 1, pageSize, totalPages: 1 };
      try {
          const dbInstance = await openDB();
          return await new Promise<LookPage>((resolve) => {
              const transaction = dbInstance.transaction(STORE_LOOKS, 'readonly');
              const request = transaction.objectStore(STORE_LOOKS).getAll();
              request.onsuccess = () => {
                  const mine = (request.result as LookEntry[])
                      .filter((look) => look.userId === userId && (!favoritesOnly || look.favorite === true))
                      .sort((a, b) => b.timestamp - a.timestamp);
                  const totalPages = Math.max(1, Math.ceil(mine.length / pageSize));
                  const safePage = Math.min(Math.max(1, page), totalPages);
                  const start = (safePage - 1) * pageSize;
                  resolve({
                      items: mine.slice(start, start + pageSize),
                      total: mine.length,
                      page: safePage,
                      pageSize,
                      totalPages,
                  });
              };
              request.onerror = () => resolve(empty);
          });
      } catch {
          return empty;
      }
  },

  getLookCount: async (userId: string): Promise<number> => {
      try {
          const dbInstance = await openDB();
          return await new Promise<number>((resolve) => {
              const transaction = dbInstance.transaction(STORE_LOOKS, 'readonly');
              const request = transaction.objectStore(STORE_LOOKS).getAll();
              request.onsuccess = () => {
                  resolve((request.result as LookEntry[]).filter((l) => l.userId === userId).length);
              };
              request.onerror = () => resolve(0);
          });
      } catch {
          return 0;
      }
  },

  /** Number of favorited looks for a user. */
  getFavoriteCount: async (userId: string): Promise<number> => {
      try {
          const dbInstance = await openDB();
          return await new Promise<number>((resolve) => {
              const transaction = dbInstance.transaction(STORE_LOOKS, 'readonly');
              const request = transaction.objectStore(STORE_LOOKS).getAll();
              request.onsuccess = () => {
                  resolve((request.result as LookEntry[]).filter((l) => l.userId === userId && l.favorite === true).length);
              };
              request.onerror = () => resolve(0);
          });
      } catch {
          return 0;
      }
  },

  /** Toggles the heart on a look; returns the updated entry or null if not found/owned. */
  setLookFavorite: async (userId: string, lookId: string, favorite: boolean): Promise<LookEntry | null> => {
      try {
          const dbInstance = await openDB();
          return await new Promise<LookEntry | null>((resolve) => {
              const transaction = dbInstance.transaction(STORE_LOOKS, 'readwrite');
              const store = transaction.objectStore(STORE_LOOKS);
              const req = store.get(lookId);
              req.onsuccess = () => {
                  const look = req.result as LookEntry | undefined;
                  if (!look || look.userId !== userId) {
                      resolve(null);
                      return;
                  }
                  const updated: LookEntry = { ...look, favorite };
                  store.put(updated);
                  resolve(updated);
              };
              req.onerror = () => resolve(null);
          });
      } catch {
          return null;
      }
  },

  deleteLook: async (userId: string, lookId: string): Promise<void> => {
      const dbInstance = await openDB();
      return new Promise((resolve, reject) => {
          const transaction = dbInstance.transaction(STORE_LOOKS, 'readwrite');
          const store = transaction.objectStore(STORE_LOOKS);
          const req = store.get(lookId);
          req.onsuccess = () => {
              const look = req.result as LookEntry | undefined;
              if (look && look.userId === userId) {
                  store.delete(lookId);
              }
          };
          transaction.oncomplete = () => resolve();
          transaction.onerror = () => reject(transaction.error);
      });
  },

  // --- Persisted wardrobes ---

  getWardrobe: async (userId: string): Promise<WardrobeItem[]> => {
      try {
          const dbInstance = await openDB();
          return await new Promise<WardrobeItem[]>((resolve) => {
              const transaction = dbInstance.transaction(STORE_WARDROBES, 'readonly');
              const request = transaction.objectStore(STORE_WARDROBES).get(userId);
              request.onsuccess = () => resolve((request.result as WardrobeItem[]) || []);
              request.onerror = () => resolve([]);
          });
      } catch {
          return [];
      }
  },

  setWardrobe: async (userId: string, items: WardrobeItem[]): Promise<void> => {
      const capped = items.slice(0, MAX_WARDROBE_ITEMS);
      const dbInstance = await openDB();
      return new Promise((resolve, reject) => {
          const transaction = dbInstance.transaction(STORE_WARDROBES, 'readwrite');
          transaction.objectStore(STORE_WARDROBES).put(capped, userId);
          transaction.oncomplete = () => resolve();
          transaction.onerror = () => reject(transaction.error);
      });
  }
};
