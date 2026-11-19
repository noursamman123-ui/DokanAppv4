jest.mock('@react-navigation/native', () => ({
  createNavigationContainerRef: () => ({
    isReady: jest.fn(),
    navigate: jest.fn(),
  }),
}));

import {
  flushPendingNavigation,
  navigationRef,
  navigateToNotifications,
} from '../navigationRef';

const mockNavigationRef = navigationRef as unknown as {
  isReady: jest.Mock;
  navigate: jest.Mock;
};

describe('notification navigation queue', () => {
  beforeEach(() => {
    mockNavigationRef.isReady.mockReset();
    mockNavigationRef.navigate.mockReset();
    flushPendingNavigation();
  });

  it('opens notifications immediately when navigation is ready', () => {
    mockNavigationRef.isReady.mockReturnValue(true);

    navigateToNotifications();

    expect(mockNavigationRef.navigate).toHaveBeenCalledWith('Main', {
      screen: 'Account',
      params: { screen: 'Notifications' },
    });
  });

  it('delivers a notification destination once navigation becomes ready', () => {
    mockNavigationRef.isReady.mockReturnValue(false);
    navigateToNotifications();
    expect(mockNavigationRef.navigate).not.toHaveBeenCalled();

    mockNavigationRef.isReady.mockReturnValue(true);
    flushPendingNavigation();

    expect(mockNavigationRef.navigate).toHaveBeenCalledWith('Main', {
      screen: 'Account',
      params: { screen: 'Notifications' },
    });
  });
});
