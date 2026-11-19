import React from 'react';
import { NativeModules, Text } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BootstrapService } from '../../../api/bootstrap.service';
import { AndroidUpdateGate } from '../AppUpdateGate';

jest.mock('../../../api/bootstrap.service', () => ({
  BootstrapService: {
    getBootstrapData: jest.fn(),
  },
}));

const getBootstrapData = BootstrapService.getBootstrapData as jest.Mock;

const waitForSettledGate = async (
  renderer: ReactTestRenderer.ReactTestRenderer,
) => {
  const deadline = Date.now() + 2000;

  await act(async () => {
    while (
      JSON.stringify(renderer.toJSON()).includes('جاري التحقق من إصدار التطبيق')
    ) {
      if (Date.now() > deadline) {
        throw new Error('Timed out waiting for the update gate to settle');
      }

      await new Promise<void>(resolve => setTimeout(resolve, 10));
    }
  });
};

const renderGate = async (initialBootstrap?: unknown) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  if (initialBootstrap) {
    queryClient.setQueryData(['bootstrap'], initialBootstrap);
  }

  let renderer!: ReactTestRenderer.ReactTestRenderer;

  await act(async () => {
    renderer = ReactTestRenderer.create(
      <QueryClientProvider client={queryClient}>
        <AndroidUpdateGate>
          <Text>محتوى التطبيق</Text>
        </AndroidUpdateGate>
      </QueryClientProvider>,
    );
  });

  await waitForSettledGate(renderer);

  return { renderer, queryClient };
};

describe('AndroidUpdateGate', () => {
  const mountedGates: Array<Awaited<ReturnType<typeof renderGate>>> = [];

  beforeEach(() => {
    NativeModules.AppVersion = { versionName: '1.8.2' };
    getBootstrapData.mockReset();
  });

  afterEach(async () => {
    await act(async () => {
      mountedGates.forEach(({ renderer }) => renderer.unmount());
    });
    mountedGates.forEach(({ queryClient }) => queryClient.clear());
    mountedGates.length = 0;
  });

  it('blocks app content when the installed version is below the minimum', async () => {
    getBootstrapData.mockResolvedValue({
      config: { min_app_version: '1.8.3' },
    });

    const gate = await renderGate();
    mountedGates.push(gate);
    const { renderer } = gate;
    const rendered = JSON.stringify(renderer.toJSON());

    expect(rendered).toContain('يتوفر تحديث جديد');
    expect(rendered).not.toContain('محتوى التطبيق');
  });

  it('renders app content when the installed version is supported', async () => {
    getBootstrapData.mockResolvedValue({
      config: { min_app_version: '1.8.2' },
    });

    const gate = await renderGate();
    mountedGates.push(gate);
    const { renderer } = gate;

    expect(JSON.stringify(renderer.toJSON())).toContain('محتوى التطبيق');
  });

  it('fails open when the bootstrap request fails', async () => {
    getBootstrapData.mockRejectedValue(new Error('offline'));

    const gate = await renderGate();
    mountedGates.push(gate);
    const { renderer } = gate;

    expect(JSON.stringify(renderer.toJSON())).toContain('محتوى التطبيق');
  });

  it('keeps blocking when a refresh fails after an outdated version was confirmed', async () => {
    getBootstrapData.mockRejectedValue(new Error('offline'));

    const gate = await renderGate({
      config: { min_app_version: '1.8.3' },
    });
    mountedGates.push(gate);

    await act(async () => {
      await gate.queryClient.refetchQueries({ queryKey: ['bootstrap'] });
    });

    const rendered = JSON.stringify(gate.renderer.toJSON());
    expect(rendered).toContain('يتوفر تحديث جديد');
    expect(rendered).not.toContain('محتوى التطبيق');
  });
});
