import type { ElectronContract } from 'src/common/electronContract';

const ensureClient = (): ElectronContract => {
  if (!window?.electronAPI) {
    throw new Error('Electron API is not available in current runtime.');
  }
  return window.electronAPI;
};

export const electronClient: ElectronContract = new Proxy({} as ElectronContract, {
  get: (_, key: keyof ElectronContract) => {
    const client = ensureClient();
    return client[key];
  },
});
