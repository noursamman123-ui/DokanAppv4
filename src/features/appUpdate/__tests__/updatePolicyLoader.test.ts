import { BootstrapService } from '../../../api/bootstrap.service';
import {
  UPDATE_CHECK_TIMEOUT_MS,
  loadUpdatePolicy,
} from '../updatePolicyLoader';

jest.mock('../../../api/bootstrap.service', () => ({
  BootstrapService: {
    getBootstrapData: jest.fn(),
  },
}));

const getBootstrapData = BootstrapService.getBootstrapData as jest.Mock;

describe('loadUpdatePolicy', () => {
  afterEach(() => {
    jest.useRealTimers();
    getBootstrapData.mockReset();
  });

  it('rejects and aborts a bootstrap request that exceeds the startup deadline', async () => {
    jest.useFakeTimers();
    let receivedSignal: AbortSignal | undefined;
    getBootstrapData.mockImplementation((signal?: AbortSignal) => {
      receivedSignal = signal;
      return new Promise(() => {});
    });

    const result = loadUpdatePolicy();
    await Promise.all([
      expect(result).rejects.toThrow('Update check timed out'),
      jest.advanceTimersByTimeAsync(UPDATE_CHECK_TIMEOUT_MS),
    ]);
    expect(receivedSignal?.aborted).toBe(true);
  });
});
