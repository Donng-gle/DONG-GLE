import * as SecureStore from 'expo-secure-store';

export const swipeHintStorage = {
  hasSeen: async (key: string) => (await SecureStore.getItemAsync(key)) === '1',
  markSeen: (key: string) => SecureStore.setItemAsync(key, '1'),
};
