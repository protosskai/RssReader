import type { ElectronContract } from 'src/common/electronContract';

let cachedClient: ElectronContract | null = null;

const getClient = (): ElectronContract => {
  if (cachedClient) return cachedClient;
  if (!window?.electronAPI) {
    throw new Error('Electron API is not available in current runtime.');
  }
  cachedClient = window.electronAPI;
  return cachedClient;
};

/** Reset cached client (logout / app restart). */
export const resetElectronClient = (): void => {
  cachedClient = null;
};

export const electronClient: ElectronContract = new Proxy(
  {} as ElectronContract,
  {
    get: (_, key: keyof ElectronContract) => {
      const client = getClient();
      return client[key];
    },
  },
);
