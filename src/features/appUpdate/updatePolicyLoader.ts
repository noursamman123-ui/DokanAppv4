import { BootstrapService } from '../../api/bootstrap.service';
import { BootstrapData } from '../../types';

export const UPDATE_CHECK_TIMEOUT_MS = 5000;

export const loadUpdatePolicy = async (): Promise<BootstrapData> => {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_resolve, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      reject(new Error('Update check timed out'));
    }, UPDATE_CHECK_TIMEOUT_MS);
  });

  try {
    return await Promise.race([
      BootstrapService.getBootstrapData(controller.signal),
      timeout,
    ]);
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
};
